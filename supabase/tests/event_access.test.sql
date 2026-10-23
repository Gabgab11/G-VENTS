-- Database tests, run by `supabase test db` (locally and in CI).
-- Each test runs inside a transaction that is rolled back.
-- Who can create, read and change events.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-1111-1111-1111-111111111111', 'host@example.com', 'authenticated', 'authenticated'),
  ('aaaaaaaa-2222-2222-2222-222222222222', 'stranger@example.com', 'authenticated', 'authenticated');

-- Host
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- Regression: 20261014000200 dropped the owner's read rule, so creating these failed.
select lives_ok(
  $$select public.create_event_with_tiers(
      '{"title":"My draft","slug":"my-draft-t1","category":"Music","starts_at":"2026-12-01T18:00:00Z","status":"draft"}',
      '[{"name":"Free","price_minor":0}]')$$,
  'a host can save an event as a draft');
select lives_ok(
  $$select public.create_event_with_tiers(
      '{"title":"My wedding","slug":"my-wedding-t2","category":"Family","starts_at":"2026-12-02T18:00:00Z","status":"published","visibility":"private"}',
      '[{"name":"Free","price_minor":0}]')$$,
  'a host can create a private event');
select is((select count(*)::int from public.events where slug in ('my-draft-t1', 'my-wedding-t2')), 2,
  'the host can read their own draft and private events');

-- Stranger
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is((select count(*)::int from public.events where slug in ('my-draft-t1', 'my-wedding-t2')), 0,
  'a stranger cannot list someone else''s draft or private events');
select is(public.get_event_page('my-draft-t1'), null, 'a stranger cannot open a draft by its link');
select is((public.get_event_page('my-wedding-t2') -> 'event' ->> 'can_manage')::boolean, false,
  'a private event opens by link, without management rights');

with changed as (update public.events set title = 'Hacked' where slug = 'my-wedding-t2' returning 1)
select is((select count(*)::int from changed), 0, 'a stranger cannot edit someone else''s event');
select throws_ok(
  $$insert into public.events (owner_id, title, slug, category, starts_at)
    values ('aaaaaaaa-1111-1111-1111-111111111111', 'Fake', 'fake-t3', 'Music', now())$$,
  '42501', null, 'a stranger cannot create an event in someone else''s name');

select * from finish();
rollback;
