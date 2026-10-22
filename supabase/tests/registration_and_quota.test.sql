-- Database tests, run by `supabase test db` (locally and in CI).
-- Each test runs inside a transaction that is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'host@example.com', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'Guest@Example.com', 'authenticated', 'authenticated');
insert into public.events (id, owner_id, title, slug, category, starts_at, status, visibility) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Public', 'public-ev', 'Music', now() + interval '7 days', 'published', 'public'),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Private', 'private-ev', 'Music', now() + interval '7 days', 'published', 'private');
insert into public.ticket_tiers (id, event_id, name) values
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Free');

-- Signed-out visitors
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*)::int from public.events where id = '55555555-5555-5555-5555-555555555555'), 0,
  'private events are not listed for signed-out visitors');
select throws_ok(
  $$select public.register_guest('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', 'Guest Person', 'a@b.co', '{}')$$,
  '42501', null, 'signed-out visitors cannot register');

-- Signed-in guest
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is(
  (select attendee_email from public.register_guest(
    '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444',
    'Guest Person', 'someone-else@example.org', '{}')),
  'guest@example.com',
  'the ticket goes to the account email, not the typed one');
select throws_ok(
  $$select public.register_guest('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', 'Guest Person', '', '{}')$$,
  'You are already registered for this event', 'one registration per person');

select ok(public.take_places_quota(), 'first Places lookup is allowed');
select ok((select bool_and(public.take_places_quota()) from generate_series(2, 60)), 'lookups 2 to 60 in a minute are allowed');
select ok(not public.take_places_quota(), 'the 61st lookup in a minute is refused');
select throws_ok('select * from public.places_usage', '42501', null, 'users cannot read the usage table');

select * from finish();
rollback;
