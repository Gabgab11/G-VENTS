-- ============================================================
-- Shared per-user limit for Google Places lookups (review finding M4).
-- The app used to count requests in each server instance's memory, which does
-- not hold on Vercel where every instance has its own count. The count now
-- lives here, so every instance sees the same numbers.
-- Limits: 60 lookups a minute and 1000 a day per signed-in user.
-- ============================================================
create table if not exists public.places_usage (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  minute_start timestamptz not null,
  minute_count integer not null,
  day          date not null,
  day_count    integer not null
);

-- Only take_places_quota() reads or writes this table.
alter table public.places_usage enable row level security;
revoke all on public.places_usage from anon, authenticated;

-- Counts one lookup for the signed-in user and returns whether it is allowed.
create or replace function public.take_places_quota()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_minute timestamptz := date_trunc('minute', now());
  v_day    date := (now() at time zone 'utc')::date;
  v_min    integer;
  v_daily  integer;
begin
  if v_user is null then
    return false;
  end if;

  insert into public.places_usage as u (user_id, minute_start, minute_count, day, day_count)
  values (v_user, v_minute, 1, v_day, 1)
  on conflict (user_id) do update set
    minute_count = case when u.minute_start = excluded.minute_start then u.minute_count + 1 else 1 end,
    minute_start = excluded.minute_start,
    day_count    = case when u.day = excluded.day then u.day_count + 1 else 1 end,
    day          = excluded.day
  returning minute_count, day_count into v_min, v_daily;

  return v_min <= 60 and v_daily <= 1000;
end;
$$;

revoke all on function public.take_places_quota() from public, anon;
grant execute on function public.take_places_quota() to authenticated;
