-- Staff invitations (Change 2 amendment, FR-21.7; replaces "migration only" in AD15).
--
-- Any G-ventZ staff member (with two-step sign-in) can invite an email address to become staff,
-- withdraw an invitation, and remove another staff member, through the API. An invitation lasts
-- 7 days and is accepted by signing in with exactly that verified email. Nobody can remove
-- themselves and the last staff member stays (enforced by the API under a lock). Every change is
-- audited by the API. Migrations can still add staff.
--
-- Additive only (expand before contract).

set lock_timeout = '5s';

create table if not exists public.platform_staff_invites (
  id           uuid primary key default gen_random_uuid(),
  email        text not null check (email = lower(email) and email like '%_@_%' and char_length(email) <= 320),
  invited_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  accepted_at  timestamptz,
  revoked_at   timestamptz,
  check (expires_at > created_at),
  check (accepted_at is null or revoked_at is null)
);

-- At most one open invitation (not accepted, not withdrawn) per email.
create unique index if not exists platform_staff_invites_open_email_idx
  on public.platform_staff_invites (email)
  where accepted_at is null and revoked_at is null;

alter table public.platform_staff_invites enable row level security;
-- Supabase's default privileges give new public tables to anon and authenticated; take them back.
revoke all on table public.platform_staff_invites from anon, authenticated;

grant select, insert, update on table public.platform_staff_invites to gventz_api;

drop policy if exists "api_read" on public.platform_staff_invites;
create policy "api_read" on public.platform_staff_invites for select to gventz_api using (true);
drop policy if exists "api_insert" on public.platform_staff_invites;
create policy "api_insert" on public.platform_staff_invites for insert to gventz_api with check (true);
drop policy if exists "api_update" on public.platform_staff_invites;
create policy "api_update" on public.platform_staff_invites for update to gventz_api using (true) with check (true);

-- The API now adds (on acceptance) and removes staff; it still can't change existing rows.
grant insert, delete on table public.platform_staff to gventz_api;

drop policy if exists "api_insert" on public.platform_staff;
create policy "api_insert" on public.platform_staff for insert to gventz_api with check (true);
drop policy if exists "api_delete" on public.platform_staff;
create policy "api_delete" on public.platform_staff for delete to gventz_api using (true);

-- Emails stay lower-case (20261024000300 already checks this; re-asserted here by name).
alter table public.platform_staff drop constraint if exists platform_staff_email_lower_check;
alter table public.platform_staff add constraint platform_staff_email_lower_check check (email = lower(email));
