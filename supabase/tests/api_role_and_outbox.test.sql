-- Database tests for the gventz-api role and the outbox (Change 1 / U1).
-- Run by `supabase test db`. Each test runs inside a transaction that is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select has_role('gventz_api', 'the API role exists');

select col_is_null('public', 'outbox_events', 'run_at', 'outbox rows may carry a run-at time (U5)');

select table_privs_are('public', 'audit_log', 'gventz_api', array['SELECT', 'INSERT'],
  'the API can only read and append the audit log');

select table_privs_are('public', 'registrations', 'gventz_api', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'the API can read and write registrations');

select is(
  (select count(*)::int from information_schema.role_table_grants
    where grantee = 'gventz_api' and table_schema = 'public' and table_name = 'places_usage'),
  0, 'the API has no rights on places_usage (quotas live in Redis)');

select is(
  (select relrowsecurity from pg_class where oid = 'public.outbox_events'::regclass),
  true, 'row-level security is on for the outbox');

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'host@example.com', 'authenticated', 'authenticated');
insert into public.events (id, owner_id, title, slug, category, starts_at, status, visibility) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Draft', 'draft-ev',
   'Music', now() + interval '7 days', 'draft', 'public');
insert into public.outbox_events (id, event_type, job_queue, job_name, job_id)
  values ('01890000-0000-7000-8000-000000000001', 'test.happened', 'email', 'test', 'test.1');

-- The API role sees rows that RLS hides from signed-out visitors.
set local role gventz_api;
select is((select count(*)::int from public.events where id = '33333333-3333-3333-3333-333333333333'), 1,
  'the API role can read a draft event');
select is((select count(*)::int from public.outbox_events), 1, 'the API role can read the outbox');
select throws_ok($$delete from public.audit_log$$, '42501', null, 'the API role cannot delete audit rows');
select lives_ok($$update public.events set status = 'published' where id = '33333333-3333-3333-3333-333333333333'$$,
  'the API role can change event status (events_guard steps aside; the API checks permissions)');

reset role;
set local role anon;
select throws_ok($$select count(*) from public.outbox_events$$, '42501', null,
  'signed-out visitors cannot read the outbox');

select * from finish();
rollback;
