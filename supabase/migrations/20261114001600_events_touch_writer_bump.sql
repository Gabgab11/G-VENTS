-- events.updated_at may be moved forward by its writer (Change 4, FR-29.3).
-- The share card's address carries the event's updated_at, so a link preview refreshes when the event
-- changes. gventz-api moves updated_at itself when only the event's ticket types change (no events
-- column changes then). The touch trigger from 20261026000300 put the old value back in that case,
-- because it ignores updates where nothing but updated_at and active_count differ. Now an update that
-- moves updated_at forward keeps it; everything else behaves as before: a real change stamps now(),
-- and an active_count-only update (registrations) leaves updated_at alone.

set local lock_timeout = '5s';

create or replace function public.events_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.updated_at > old.updated_at then
    return new;
  end if;
  if (to_jsonb(new) - 'active_count' - 'updated_at') = (to_jsonb(old) - 'active_count' - 'updated_at') then
    new.updated_at = old.updated_at;
  else
    new.updated_at = now();
  end if;
  return new;
end;
$$;

comment on function public.events_touch_updated_at() is
  'Stamps events.updated_at on real changes; keeps it for active_count-only updates; keeps a value the writer moved forward.';
