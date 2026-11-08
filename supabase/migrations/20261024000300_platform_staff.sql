-- G-ventZ platform staff (Change 1 / U2, application design AD15).
--
-- Staff can change fee rates and see reconciliation (from M4). Rows are added
-- and removed by migration only, so every change is reviewed and recorded.
-- Matched by verified email (lowercase), not user id, so someone can be added
-- before their first sign-in. The API also requires two-step sign-in (aal2)
-- for staff routes (D54).

set lock_timeout = '5s';

create table if not exists public.platform_staff (
  email     text primary key check (email = lower(email) and email like '%_@_%'),
  note      text check (note is null or char_length(note) <= 200),
  added_at  timestamptz not null default now()
);

alter table public.platform_staff enable row level security;
revoke all on table public.platform_staff from anon, authenticated;

grant select on table public.platform_staff to gventz_api;
drop policy if exists "api_read" on public.platform_staff;
create policy "api_read" on public.platform_staff for select to gventz_api using (true);

insert into public.platform_staff (email, note)
values ('stefaneey@gmail.com', 'founder')
on conflict (email) do nothing;
