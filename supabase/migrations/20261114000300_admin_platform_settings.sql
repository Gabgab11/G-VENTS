-- G-ventZ admin dashboard (Change 2 / M4, D62, D65, FR-19, FR-21).
--
-- platform_settings: key/value settings that G-ventZ staff change from the admin dashboard
-- through the API: the payment provider switches (all off until M5), the standard G-ventZ fee
-- for every currency (`default_fee`, JSON null until set), per-currency fee overrides (`fees`,
-- empty until set) and the settlement delay in working days. Every change is audited by the
-- API with the value before and after; `updated_by` is the staff member's profile id.
--
-- profiles.suspended_at / suspended_reason: a suspended host can't create, publish or edit
-- events and their events take no new registrations (enforced by the API). Only the API role
-- writes them; signed-in users keep their column-level update grant on display fields only.
--
-- Additive only (expand before contract): existing rows and the current API release keep working.

set lock_timeout = '5s';

create table if not exists public.platform_settings (
  key         text primary key check (key ~ '^[a-z][a-z0-9_]{0,63}$'),
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);

alter table public.platform_settings enable row level security;
-- Supabase's default privileges give new public tables to anon and authenticated; take them back.
revoke all on table public.platform_settings from anon, authenticated;

grant select, insert, update on table public.platform_settings to gventz_api;

drop policy if exists "api_read" on public.platform_settings;
create policy "api_read" on public.platform_settings for select to gventz_api using (true);
drop policy if exists "api_insert" on public.platform_settings;
create policy "api_insert" on public.platform_settings for insert to gventz_api with check (true);
drop policy if exists "api_update" on public.platform_settings;
create policy "api_update" on public.platform_settings for update to gventz_api using (true) with check (true);

insert into public.platform_settings (key, value) values
  ('payments', '{"paystack":{"enabled":false},"interswitch":{"enabled":false},"stripe":{"enabled":false}}'::jsonb),
  ('default_fee', 'null'::jsonb),
  ('fees', '{}'::jsonb),
  ('settlement_delay_working_days', '3'::jsonb)
on conflict (key) do nothing;

-- Host suspension. gventz_api already has select/insert/update on public.profiles.
alter table public.profiles add column if not exists suspended_at timestamptz;
alter table public.profiles add column if not exists suspended_reason text;

alter table public.profiles drop constraint if exists profiles_suspended_reason_check;
alter table public.profiles add constraint profiles_suspended_reason_check
  check (suspended_reason is null or char_length(suspended_reason) <= 500);
