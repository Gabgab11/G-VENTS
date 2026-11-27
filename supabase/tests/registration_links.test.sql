-- Database tests for registration links (Change 6, FR-41..FR-47).
-- Run by `supabase test db`. Rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Structure, security and grants (same posture as discount_codes: API role only).
select has_table('public', 'registration_links', 'registration links are stored');
select has_column('public', 'events', 'access_code', 'events carry an optional event-level access code');
select has_column('public', 'ticket_tiers', 'registration_link_id', 'tiers belong to a registration link');
select has_column('public', 'event_questions', 'registration_link_id', 'questions belong to a registration link');
select has_column('public', 'registrations', 'registration_link_id', 'registrations record their link');
select has_column('public', 'orders', 'registration_link_id', 'orders record their link');
select is((select relrowsecurity from pg_class where oid = 'public.registration_links'::regclass), true, 'row-level security is on');
select table_privs_are('public', 'registration_links', 'gventz_api', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'the API reads and writes registration links');
select table_privs_are('public', 'registration_links', 'anon', array[]::text[], 'visitors have no rights on registration links');
select table_privs_are('public', 'registration_links', 'authenticated', array[]::text[], 'signed-in users have no rights on registration links');

-- A new event gets exactly one default link automatically.
insert into auth.users (id, email, aud, role) values
  ('c6000000-0000-0000-0000-000000000001', 'c6-host@example.com', 'authenticated', 'authenticated');
insert into public.events (id, owner_id, title, slug, category, starts_at)
  values ('c6000000-0000-0000-0000-0000000000e1', 'c6000000-0000-0000-0000-000000000001', 'C6 links', 'c6-test', 'Business', now() + interval '7 days');

select is(
  (select count(*)::int from public.registration_links where event_id = 'c6000000-0000-0000-0000-0000000000e1' and is_default),
  1, 'a new event gets exactly one default link');
select matches(
  (select token from public.registration_links where event_id = 'c6000000-0000-0000-0000-0000000000e1' and is_default),
  '^[0-9a-f]{32}$', 'the default link gets an unguessable 128-bit token');

-- Two default links on one event are refused (partial unique index).
select throws_ok(
  $$insert into public.registration_links (event_id, name, is_default) values ('c6000000-0000-0000-0000-0000000000e1', 'Second default', true)$$,
  '23505', null, 'an event cannot have two default links');

-- A non-default link holds exactly one tier (default link may hold many).
insert into public.registration_links (id, event_id, name, is_default)
  values ('c6000000-0000-0000-0000-0000000000a1', 'c6000000-0000-0000-0000-0000000000e1', 'Volunteer', false);
insert into public.ticket_tiers (id, event_id, registration_link_id, name)
  values ('c6000000-0000-0000-0000-0000000000f1', 'c6000000-0000-0000-0000-0000000000e1', 'c6000000-0000-0000-0000-0000000000a1', 'Volunteer ticket');
select throws_ok(
  $$insert into public.ticket_tiers (event_id, registration_link_id, name)
    values ('c6000000-0000-0000-0000-0000000000e1', 'c6000000-0000-0000-0000-0000000000a1', 'Second volunteer tier')$$,
  'P0001', 'registration_links_single_tier', 'a non-default link holds exactly one tier');

-- The link's active_count tracks confirmed + pending registrations.
insert into public.registrations (event_id, tier_id, registration_link_id, attendee_name, attendee_email, status)
  values ('c6000000-0000-0000-0000-0000000000e1', 'c6000000-0000-0000-0000-0000000000f1', 'c6000000-0000-0000-0000-0000000000a1', 'Ada', 'ada@example.com', 'confirmed');
select is(
  (select active_count from public.registration_links where id = 'c6000000-0000-0000-0000-0000000000a1'),
  1, 'the link active_count counts a confirmed registration');

select * from finish();
rollback;
