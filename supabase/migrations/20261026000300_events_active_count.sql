-- events.active_count: confirmed + pending tickets per event (Change 1 / U4,
-- business-logic-model §3; replaces counting registrations on every order).
--
-- Kept by a trigger so it stays right whichever app writes registrations until
-- go-live (AD17). The function is security definer because staff using the
-- current app change ticket statuses under their own role, which has no right
-- to update events. The order transaction already holds the event row, so the
-- update adds no waiting.
--
-- events_touch no longer moves updated_at when only the count changed, so
-- "updated" still means the host changed something.

set lock_timeout = '5s';

alter table public.events
  add column if not exists active_count integer not null default 0;

alter table public.events drop constraint if exists events_active_count_check;
alter table public.events add constraint events_active_count_check check (active_count >= 0);

create or replace function public.registrations_active_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old integer := 0;
  v_new integer := 0;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.status in ('confirmed', 'pending') then
    v_old := 1;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.status in ('confirmed', 'pending') then
    v_new := 1;
  end if;

  if tg_op = 'UPDATE' and old.event_id is distinct from new.event_id then
    update public.events set active_count = active_count - v_old where id = old.event_id and v_old <> 0;
    update public.events set active_count = active_count + v_new where id = new.event_id and v_new <> 0;
  elsif v_new - v_old <> 0 then
    -- After a cascaded event delete the row is gone and this updates nothing.
    update public.events set active_count = active_count + (v_new - v_old)
     where id = coalesce(new.event_id, old.event_id);
  end if;
  return null;
end;
$$;

revoke execute on function public.registrations_active_count() from public, anon, authenticated;

create or replace function public.events_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (to_jsonb(new) - 'active_count' - 'updated_at') = (to_jsonb(old) - 'active_count' - 'updated_at') then
    new.updated_at = old.updated_at;
  else
    new.updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists events_touch on public.events;
create trigger events_touch before update on public.events
for each row execute function public.events_touch_updated_at();

-- Backfill, then create the trigger, in one statement: registrations are locked
-- against writes until it ends, so no ticket is missed in between. (Migrations
-- may run statement by statement, outside a transaction block.)
do $$
begin
  lock table public.registrations in share row exclusive mode;

  update public.events e
     set active_count = c.n
    from (select event_id, count(*)::int as n
            from public.registrations
           where status in ('confirmed', 'pending')
           group by event_id) c
   where c.event_id = e.id and e.active_count <> c.n;

  drop trigger if exists registrations_active_count on public.registrations;
  create trigger registrations_active_count
  after insert or delete or update of status, event_id on public.registrations
  for each row execute function public.registrations_active_count();
end
$$;
