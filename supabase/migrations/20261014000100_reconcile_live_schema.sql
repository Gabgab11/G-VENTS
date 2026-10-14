-- ============================================================
-- Reconcile the schema in git with what the app already uses.
--
-- These objects were created by hand on gvents-staging / gvents-prod and never
-- committed: event_questions, the extra columns, the 'waitlisted' status, and the
-- register/attendee/waitlist functions. This migration recreates them so a fresh
-- database can be built from git alone.
--
-- BEFORE APPLYING TO AN EXISTING DATABASE: run `supabase db pull` against staging
-- and diff the live definitions with this file. Tables and columns use
-- IF NOT EXISTS, so they leave live objects alone. The functions are REPLACED, and
-- register_guest now enforces registration questions on the server (finding H5).
-- Apply to staging first and test registration end to end.
-- ============================================================

-- ---------- Columns the app reads and writes ----------
alter table public.events   add column if not exists registration_open   boolean not null default true;
alter table public.events   add column if not exists notify_registration boolean not null default false;
alter table public.profiles add column if not exists dashboard_theme     text    not null default 'minimal';
alter table public.registrations add column if not exists answers jsonb not null default '{}'::jsonb;

-- The waiting list writes 'waitlisted', which the original check rejected.
alter table public.registrations drop constraint if exists registrations_status_check;
alter table public.registrations add constraint registrations_status_check
  check (status in ('pending','confirmed','waitlisted','cancelled','refunded'));

-- ---------- Custom registration questions ----------
create table if not exists public.event_questions (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  label       text not null check (char_length(label) between 1 and 200),
  kind        text not null check (kind in ('text','options','social','company','terms','phone','website')),
  options     text[] not null default '{}',
  required    boolean not null default false,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists event_questions_event_idx on public.event_questions (event_id, position);

alter table public.event_questions enable row level security;

drop policy if exists "questions_read" on public.event_questions;
create policy "questions_read" on public.event_questions for select
  using (
    exists (select 1 from public.events e
            where e.id = event_id and e.status = 'published' and e.visibility = 'public')
    or public.has_event_role(event_id, array['owner','admin','editor','checkin','finance','viewer'])
  );

drop policy if exists "questions_manage" on public.event_questions;
create policy "questions_manage" on public.event_questions for all
  using (public.has_event_role(event_id, array['owner','admin','editor']))
  with check (public.has_event_role(event_id, array['owner','admin','editor']));

-- ============================================================
-- Attendee count shown on the public event page.
-- Returns null when the host hides the count (staff always see it).
-- ============================================================
create or replace function public.public_attendee_count(p_event uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when e.show_attendee_count
      or public.has_event_role(e.id, array['owner','admin','editor','checkin','finance','viewer'])
    then (select count(*)::int from public.registrations r
          where r.event_id = e.id and r.status = 'confirmed')
  end
  from public.events e
  where e.id = p_event and (e.status = 'published' or public.has_event_role(e.id, array['owner','admin','editor','checkin','finance','viewer']));
$$;

-- ============================================================
-- Guest registration. The only way a registration row is created from the app.
--   * requires a signed-in user (one active registration per user per event)
--   * locks the event row so capacity checks cannot race
--   * validates answers against the event's own questions (never the browser's copy)
--   * paid tiers are refused until payments exist (finding H6)
-- Errors raised here use plain sentences: the app shows them to the guest as-is.
-- ============================================================
drop function if exists public.register_guest(uuid, uuid, text, text, jsonb);

create function public.register_guest(
  p_event   uuid,
  p_tier    uuid,
  p_name    text,
  p_email   text,
  p_answers jsonb default '{}'::jsonb
)
returns public.registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  e        public.events;
  t        public.ticket_tiers;
  q        record;
  v_value  text;
  v_clean  jsonb := '{}'::jsonb;
  v_taken  integer;
  v_status text;
  r        public.registrations;
begin
  if v_user is null then
    raise exception 'Sign in to register';
  end if;
  if p_name is null or char_length(trim(p_name)) not between 2 and 120 then
    raise exception 'Enter your full name';
  end if;
  if p_email is null or char_length(p_email) > 254 or p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address';
  end if;

  select * into e from public.events where id = p_event for update;
  if not found or e.status <> 'published' then
    raise exception 'This event is not open for registration';
  end if;
  if not e.registration_open then
    raise exception 'Registration for this event is closed';
  end if;

  if exists (select 1 from public.registrations
             where event_id = e.id and user_id = v_user and status not in ('cancelled','refunded')) then
    raise exception 'You are already registered for this event';
  end if;

  select * into t from public.ticket_tiers where id = p_tier and event_id = e.id for update;
  if not found or not t.is_active then
    raise exception 'Choose a ticket';
  end if;
  if t.price_minor > 0 then
    raise exception 'Paid tickets are not available yet';
  end if;
  if t.sales_start is not null and now() < t.sales_start then
    raise exception 'Ticket sales have not started yet';
  end if;
  if t.sales_end is not null and now() > t.sales_end then
    raise exception 'Ticket sales have ended';
  end if;

  -- Answers: keyed by question id. Labels come from the database, unknown keys are ignored.
  for q in
    select id, label, kind, options, required
    from public.event_questions where event_id = e.id order by position
  loop
    v_value := left(trim(coalesce(p_answers ->> q.id::text, '')), 1000);
    if q.kind = 'terms' then
      v_value := case when v_value <> '' then 'Accepted' else '' end;
    end if;
    if q.kind = 'options' and v_value <> '' and not (v_value = any (q.options)) then
      raise exception 'Choose one of the options for: %', q.label;
    end if;
    if q.required and v_value = '' then
      raise exception 'Please answer: %', q.label;
    end if;
    if v_value <> '' then
      v_clean := v_clean || jsonb_build_object(q.id::text, jsonb_build_object('label', q.label, 'value', v_value));
    end if;
  end loop;

  -- Event capacity overflows to the waiting list; a sold-out tier does not.
  select count(*) into v_taken from public.registrations
  where event_id = e.id and status in ('confirmed','pending');

  if e.capacity is not null and v_taken >= e.capacity then
    v_status := 'waitlisted';
  else
    if t.quantity is not null and t.sold >= t.quantity then
      raise exception 'Sold out';
    end if;
    v_status := case when e.require_approval then 'pending' else 'confirmed' end;
    update public.ticket_tiers set sold = sold + 1 where id = t.id;
  end if;

  insert into public.registrations
    (event_id, tier_id, user_id, attendee_name, attendee_email, status, amount_minor, answers)
  values
    (e.id, t.id, v_user, trim(p_name), lower(trim(p_email)), v_status, 0, v_clean)
  returning * into r;

  return r;
end;
$$;

-- ============================================================
-- Host action: confirm the oldest guest on the waiting list.
-- ============================================================
create or replace function public.promote_next_waitlisted(p_event uuid)
returns public.registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.registrations;
begin
  if not public.has_event_role(p_event, array['owner','admin','editor']) then
    raise exception 'You do not manage this event';
  end if;

  perform 1 from public.events where id = p_event for update;

  select * into r from public.registrations
  where event_id = p_event and status = 'waitlisted'
  order by created_at
  limit 1
  for update skip locked;

  if not found then
    raise exception 'Nobody is on the waiting list';
  end if;

  update public.ticket_tiers set sold = sold + 1
  where id = r.tier_id and (quantity is null or sold < quantity);
  if not found then
    raise exception 'The next waiting guest''s ticket type is sold out';
  end if;

  update public.registrations set status = 'confirmed' where id = r.id returning * into r;
  return r;
end;
$$;

revoke execute on function public.public_attendee_count(uuid)                        from public;
revoke execute on function public.register_guest(uuid, uuid, text, text, jsonb)        from public, anon;
revoke execute on function public.promote_next_waitlisted(uuid)                        from public, anon;
grant  execute on function public.public_attendee_count(uuid)                        to anon, authenticated;
grant  execute on function public.register_guest(uuid, uuid, text, text, jsonb)        to authenticated;
grant  execute on function public.promote_next_waitlisted(uuid)                        to authenticated;

-- RLS policies call has_event_role for every reader, including signed-out visitors.
-- It only ever answers "is the current user staff on this event", so anon may run it
-- (this matches the fix already applied by hand on both databases).
grant execute on function public.has_event_role(uuid, text[]) to anon, authenticated;
