-- The Data API is closed on the public schema (20261113000100): visitors (anon) and signed-in
-- users (authenticated) can't read, write or call anything there directly. All data goes
-- through gventz-api, which connects as gventz_api. Run by `supabase test db`; rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- Every table and sequence, now and in future migrations.
select is(
  (select array_agg(c.relname order by c.relname) from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and (has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate, references, trigger')
        or has_table_privilege('authenticated', c.oid, 'select, insert, update, delete, truncate, references, trigger'))),
  null, 'no table or view in public is open to anon or authenticated');
select is(
  (select array_agg(c.relname order by c.relname) from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'S'
      and (has_sequence_privilege('anon', c.oid, 'usage, select, update')
        or has_sequence_privilege('authenticated', c.oid, 'usage, select, update'))),
  null, 'no sequence in public is open to anon or authenticated');

-- Every callable function. A new function needs `revoke execute ... from public` (PUBLIC can
-- execute new functions by default). Only can_manage_event_folder stays, for the storage
-- policies on event covers.
select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')
      and p.prorettype <> 'trigger'::regtype and p.proname <> 'can_manage_event_folder'
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
  null, 'no function in public can be called by anon or authenticated');

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'host@example.com', 'authenticated', 'authenticated');
insert into public.events (id, owner_id, title, slug, category, starts_at, status, visibility) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Public', 'public-ev',
   'Music', now() + interval '7 days', 'published', 'public');
insert into public.ticket_tiers (id, event_id, name) values
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Free');

-- What the old app did, refused now.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select count(*) from public.events$$, '42501', null, 'visitors cannot list events directly');
select throws_ok($$select public.get_event_page('public-ev')$$, '42501', null, 'visitors cannot call get_event_page');
select throws_ok($$select public.get_ticket('ffffffffffffffffffffffff')$$, '42501', null, 'visitors cannot look up tickets');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok(
  $$select public.register_guest('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', 'Guest Person', '', '{}')$$,
  '42501', null, 'signed-in users cannot register outside the API');
select throws_ok(
  $$update public.events set title = 'Changed' where id = '33333333-3333-3333-3333-333333333333'$$,
  '42501', null, 'the owner cannot edit their event outside the API');
select throws_ok(
  $$select public.delete_event('33333333-3333-3333-3333-333333333333', 'Public')$$,
  '42501', null, 'the owner cannot delete their event outside the API');
select throws_ok($$select public.take_places_quota()$$, '42501', null, 'the old Places quota is closed (quotas live in Redis)');

-- The API is unaffected.
reset role;
set local role gventz_api;
select is((select count(*)::int from public.events where id = '33333333-3333-3333-3333-333333333333'), 1,
  'the API role still reads events');
select lives_ok(
  $$update public.events set title = 'Renamed by the API' where id = '33333333-3333-3333-3333-333333333333'$$,
  'the API role still writes events (triggers still fire)');

select * from finish();
rollback;
