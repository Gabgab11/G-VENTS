-- Database role for the NestJS API (gventz-api), Change 1 / U1.
--
-- The API connects through the Supabase pooler as `gventz_api` and enforces
-- permissions itself (application design AD11-AD17). Row-level security stays
-- on for every table: the policies below admit only this role, so the Supabase
-- Data API (`anon`, `authenticated`) keeps its existing policies unchanged.
--
-- No password is set here. The owner sets it once per project:
--   alter role gventz_api with password '<generated>';
-- (printed by gventz-api/scripts/generate-secrets.sh), then uses
--   postgres://gventz_api.<project-ref>:<password>@<pooler-host>:6543/postgres
--
-- Grants are explicit per table (least privilege, SECURITY-06). Later
-- migrations grant on the tables they create. `audit_log` is insert-only for
-- the API (SECURITY-13). `places_usage` is not granted: the API keeps Places
-- quotas in Redis.

set lock_timeout = '5s';

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'gventz_api') then
    create role gventz_api login noinherit;
  end if;
end
$$;

-- Lets the migration owner act as the API role, which `supabase test db`
-- needs to check the grants below. Grants the owner nothing it lacks.
grant gventz_api to postgres;

-- Timeouts as role settings, so they apply through the transaction-mode pooler
-- (startup parameters are not forwarded). Longer report queries use SET LOCAL.
alter role gventz_api set statement_timeout = '5s';
alter role gventz_api set idle_in_transaction_session_timeout = '15s';

grant usage on schema public to gventz_api;
-- Column defaults such as registrations.ticket_code call pgcrypto in `extensions`.
grant usage on schema extensions to gventz_api;

grant select, insert, update, delete on table
  public.profiles,
  public.events,
  public.ticket_tiers,
  public.registrations,
  public.event_questions,
  public.event_members,
  public.email_campaigns,
  public.email_suppressions
to gventz_api;

grant select, insert on table public.audit_log to gventz_api;

grant usage, select on all sequences in schema public to gventz_api;

-- One permissive policy per table for the API role. Policies for other roles
-- are untouched, and RLS stays enabled.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'events', 'ticket_tiers', 'registrations', 'event_questions',
    'event_members', 'email_campaigns', 'email_suppressions'
  ] loop
    execute format('drop policy if exists "api_all" on public.%I', t);
    execute format(
      'create policy "api_all" on public.%I for all to gventz_api using (true) with check (true)', t);
  end loop;
end
$$;

drop policy if exists "api_read" on public.audit_log;
create policy "api_read" on public.audit_log for select to gventz_api using (true);
drop policy if exists "api_insert" on public.audit_log;
create policy "api_insert" on public.audit_log for insert to gventz_api with check (true);
