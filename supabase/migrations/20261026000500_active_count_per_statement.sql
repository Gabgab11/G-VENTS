-- events.active_count, maintained per statement instead of per row (Change 1 / U4, found in
-- Build and Test). The row trigger updated the event row once per ticket, each update also running
-- events_touch and events_guard, inside the order transaction that holds the event lock; under load
-- that dominated the lock time. Now an order of n tickets updates the event row once. Same counting
-- rule: tickets entering or leaving {confirmed, pending}.

set lock_timeout = '5s';

create or replace function public.registrations_active_count_stmt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- plpgsql plans each statement on first use, so only the branch for this operation touches
  -- the transition tables it has.
  if tg_op = 'INSERT' then
    update public.events e set active_count = e.active_count + d.n
      from (select event_id, count(*)::int as n from new_rows where status in ('confirmed', 'pending') group by event_id) d
     where e.id = d.event_id;
  elsif tg_op = 'DELETE' then
    -- After a cascaded event delete the event row is gone and this updates nothing.
    update public.events e set active_count = e.active_count - d.n
      from (select event_id, count(*)::int as n from old_rows where status in ('confirmed', 'pending') group by event_id) d
     where e.id = d.event_id;
  else
    update public.events e set active_count = e.active_count + d.n
      from (
        select event_id, sum(n)::int as n from (
          select event_id, 1 as n from new_rows where status in ('confirmed', 'pending')
          union all
          select event_id, -1 as n from old_rows where status in ('confirmed', 'pending')
        ) x group by event_id having sum(n) <> 0
      ) d
     where e.id = d.event_id;
  end if;
  return null;
end;
$$;

revoke execute on function public.registrations_active_count_stmt() from public, anon, authenticated;

-- Swap triggers in one statement, with registrations locked, so no write is counted twice or missed.
do $$
begin
  lock table public.registrations in share row exclusive mode;
  drop trigger if exists registrations_active_count on public.registrations;
  drop trigger if exists registrations_active_count_ins on public.registrations;
  drop trigger if exists registrations_active_count_upd on public.registrations;
  drop trigger if exists registrations_active_count_del on public.registrations;
  create trigger registrations_active_count_ins after insert on public.registrations
    referencing new table as new_rows for each statement execute function public.registrations_active_count_stmt();
  create trigger registrations_active_count_upd after update on public.registrations
    referencing old table as old_rows new table as new_rows for each statement execute function public.registrations_active_count_stmt();
  create trigger registrations_active_count_del after delete on public.registrations
    referencing old table as old_rows for each statement execute function public.registrations_active_count_stmt();
end
$$;

drop function if exists public.registrations_active_count();
