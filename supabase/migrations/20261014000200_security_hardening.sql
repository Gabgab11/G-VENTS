-- ============================================================
-- Security hardening from the architecture review (October 2026).
-- Each block names the finding it closes. Apply after
-- 20261014000100_reconcile_live_schema.sql, on staging first.
-- ============================================================

-- ------------------------------------------------------------
-- H2: private events must not be listable through the API.
-- The broad policy let anyone with the anon key list every published event.
-- Lists now see public events only; a private event is reachable only by
-- its slug, through get_event_page().
-- ------------------------------------------------------------
drop policy if exists "events_public_read" on public.events;
create policy "events_public_read" on public.events for select
  using (
    (status = 'published' and visibility = 'public')
    or public.has_event_role(id, array['owner','admin','editor','checkin','finance','viewer'])
  );

drop policy if exists "tiers_public_read" on public.ticket_tiers;
create policy "tiers_public_read" on public.ticket_tiers for select
  using (exists (
    select 1 from public.events e
    where e.id = event_id
      and ((e.status = 'published' and e.visibility = 'public')
           or public.has_event_role(e.id, array['owner','admin','editor','finance','viewer']))
  ));

-- Everything the public event page needs, for public and private events alike.
-- Knowing the slug is what grants access to a private event.
create or replace function public.get_event_page(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'event', jsonb_build_object(
      'id', e.id, 'title', e.title, 'slug', e.slug, 'category', e.category,
      'description', e.description, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
      'timezone', e.timezone, 'venue_name', e.venue_name, 'city', e.city, 'country', e.country,
      'status', e.status, 'visibility', e.visibility, 'refund_policy', e.refund_policy,
      'cover_theme', e.cover_theme, 'cover_url', e.cover_url,
      'registration_open', e.registration_open and e.status = 'published',
      'can_manage', public.has_event_role(e.id, array['owner','admin','editor'])
    ),
    'tiers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'name', t.name, 'price_minor', t.price_minor,
               'quantity', t.quantity, 'sold', t.sold)
             order by t.price_minor, t.created_at)
      from public.ticket_tiers t where t.event_id = e.id and t.is_active
    ), '[]'::jsonb),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', q.id, 'label', q.label, 'kind', q.kind,
               'options', to_jsonb(q.options), 'required', q.required)
             order by q.position)
      from public.event_questions q where q.event_id = e.id
    ), '[]'::jsonb)
  )
  from public.events e
  where e.slug = p_slug
    and (e.status = 'published'
         or public.has_event_role(e.id, array['owner','admin','editor','checkin','finance','viewer']));
$$;

revoke execute on function public.get_event_page(text) from public;
grant  execute on function public.get_event_page(text) to anon, authenticated;

-- ------------------------------------------------------------
-- H3: nobody can reserve tickets anonymously or more than once.
-- reserve_ticket has no UI and allowed unlimited anonymous reservations.
-- Registration goes through register_guest(), which requires sign-in.
-- If the unique index fails to build, duplicates already exist: list them with
--   select event_id, user_id, count(*) from registrations
--   where status not in ('cancelled','refunded') group by 1,2 having count(*) > 1;
-- ------------------------------------------------------------
revoke execute on function public.reserve_ticket(uuid, text, text) from public, anon, authenticated;

create unique index if not exists registrations_one_active_per_user
  on public.registrations (event_id, user_id)
  where user_id is not null and status not in ('cancelled','refunded');

-- ------------------------------------------------------------
-- M1: users cannot claim someone else's email address.
-- profiles.email is unique and was user-editable, so setting it to another
-- person's address blocked their sign-up. Profiles are created by the
-- sign-up trigger; users may only edit these display fields.
-- ------------------------------------------------------------
revoke insert, update on public.profiles from anon, authenticated;
grant  update (full_name, country, dashboard_theme) on public.profiles to authenticated;
drop policy if exists "profile_own_insert" on public.profiles;

-- ------------------------------------------------------------
-- M2: staff permissions are scoped to what each role should change.
-- Editors could reassign the owner or change the status; check-in staff could
-- rewrite any registration column.
-- ------------------------------------------------------------
create or replace function public.events_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Service-role jobs and migrations have no signed-in user.
  if auth.uid() is null then
    return new;
  end if;
  if new.owner_id is distinct from old.owner_id then
    raise exception 'The event owner cannot be changed';
  end if;
  if new.slug is distinct from old.slug then
    raise exception 'The event link cannot be changed';
  end if;
  if new.status is distinct from old.status
     and not public.has_event_role(old.id, array['owner','admin']) then
    raise exception 'Only the owner or an admin can publish or cancel this event';
  end if;
  return new;
end;
$$;

drop trigger if exists events_guard on public.events;
create trigger events_guard before update on public.events
for each row execute function public.events_guard();

-- Registrations are no longer updated directly from the app.
drop policy if exists "reg_staff_update" on public.registrations;

create or replace function public.check_in_guest(p_registration uuid)
returns public.registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.registrations;
begin
  select * into r from public.registrations where id = p_registration for update;
  if not found
     or not public.has_event_role(r.event_id, array['owner','admin','editor','checkin']) then
    raise exception 'Guest not found';
  end if;
  if r.status <> 'confirmed' then
    raise exception 'Only confirmed guests can be checked in';
  end if;
  if r.checked_in_at is not null then
    raise exception 'This guest is already checked in';
  end if;

  update public.registrations
  set checked_in_at = now(), checked_in_by = auth.uid()
  where id = r.id
  returning * into r;
  return r;
end;
$$;

revoke execute on function public.check_in_guest(uuid) from public, anon;
grant  execute on function public.check_in_guest(uuid) to authenticated;

-- ------------------------------------------------------------
-- M3: only known page styles are stored.
-- Keep in sync with THEMES in src/lib/themes.ts.
-- NOT VALID skips existing rows; run VALIDATE CONSTRAINT after cleaning them.
-- ------------------------------------------------------------
alter table public.events drop constraint if exists events_cover_theme_check;
alter table public.events add constraint events_cover_theme_check
  check (cover_theme in ('minimal','sunset','ocean','forest','night','ember','blush','mint','lavender','christmas'))
  not valid;

alter table public.profiles drop constraint if exists profiles_dashboard_theme_check;
alter table public.profiles add constraint profiles_dashboard_theme_check
  check (dashboard_theme in ('minimal','sunset','ocean','forest','night','ember','blush','mint','lavender','christmas'))
  not valid;

-- ------------------------------------------------------------
-- M8: an event and its tickets are saved in one transaction.
-- SECURITY INVOKER, so the normal row-level security still applies.
-- ------------------------------------------------------------
create or replace function public.create_event_with_tiers(p_event jsonb, p_tiers jsonb)
returns public.events
language plpgsql
security invoker
set search_path = public
as $$
declare
  e public.events;
begin
  if auth.uid() is null then
    raise exception 'Sign in to create an event';
  end if;
  if jsonb_typeof(p_tiers) <> 'array' or jsonb_array_length(p_tiers) = 0 then
    raise exception 'Add at least one ticket';
  end if;

  insert into public.events (
    owner_id, title, slug, category, description, starts_at, ends_at, timezone,
    venue_name, city, country, refund_policy, visibility, show_attendee_count,
    require_approval, cover_theme, status
  ) values (
    auth.uid(),
    p_event ->> 'title',
    p_event ->> 'slug',
    p_event ->> 'category',
    nullif(p_event ->> 'description', ''),
    (p_event ->> 'starts_at')::timestamptz,
    nullif(p_event ->> 'ends_at', '')::timestamptz,
    coalesce(p_event ->> 'timezone', 'Africa/Lagos'),
    nullif(p_event ->> 'venue_name', ''),
    nullif(p_event ->> 'city', ''),
    nullif(p_event ->> 'country', ''),
    nullif(p_event ->> 'refund_policy', ''),
    coalesce(p_event ->> 'visibility', 'public'),
    coalesce((p_event ->> 'show_attendee_count')::boolean, true),
    coalesce((p_event ->> 'require_approval')::boolean, false),
    coalesce(p_event ->> 'cover_theme', 'minimal'),
    coalesce(p_event ->> 'status', 'draft')
  )
  returning * into e;

  insert into public.ticket_tiers (event_id, name, price_minor, currency, quantity)
  select e.id,
         t ->> 'name',
         coalesce((t ->> 'price_minor')::integer, 0),
         'NGN',
         nullif(t ->> 'quantity', '')::integer
  from jsonb_array_elements(p_tiers) as t;

  return e;
end;
$$;

revoke execute on function public.create_event_with_tiers(jsonb, jsonb) from public, anon;
grant  execute on function public.create_event_with_tiers(jsonb, jsonb) to authenticated;

-- ------------------------------------------------------------
-- M9: flyer storage rules, now in git.
-- Objects live at "<event id>/<file>". Only that event's owner, admins and
-- editors may write there. The bucket itself enforces type and size.
--
-- Storage policies are OR'ed together: after applying, list the existing ones
--   select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects';
-- and drop any older, broader event-covers policy, or it keeps allowing writes.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-covers', 'event-covers', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_manage_event_folder(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event uuid;
begin
  begin
    v_event := (storage.foldername(p_name))[1]::uuid;
  exception when others then
    return false;
  end;
  return public.has_event_role(v_event, array['owner','admin','editor']);
end;
$$;

revoke execute on function public.can_manage_event_folder(text) from public, anon;
grant  execute on function public.can_manage_event_folder(text) to authenticated;

drop policy if exists "event_covers_insert" on storage.objects;
create policy "event_covers_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'event-covers' and public.can_manage_event_folder(name));

drop policy if exists "event_covers_update" on storage.objects;
create policy "event_covers_update" on storage.objects for update to authenticated
  using (bucket_id = 'event-covers' and public.can_manage_event_folder(name));

drop policy if exists "event_covers_delete" on storage.objects;
create policy "event_covers_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'event-covers' and public.can_manage_event_folder(name));
