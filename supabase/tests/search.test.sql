-- 20261114001900: header search folding, generated search text and trigram indexes. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

select has_extension('extensions', 'pg_trgm', 'pg_trgm is installed in the extensions schema');
select has_extension('extensions', 'unaccent', 'unaccent is installed in the extensions schema');
select volatility_is('public', 'search_fold', array['text'], 'immutable', 'search_fold can be stored and indexed');
select is(public.search_fold('Café Ñandú ÉKÒ'), 'cafe nandu eko', 'search_fold lowers case and removes accents');
select is(public.search_fold(null), null, 'search_fold keeps null');
select has_index('public', 'events', 'events_search_trgm_idx', 'events have the search index');
select has_index('public', 'profiles', 'profiles_search_trgm_idx', 'profiles have the search index');

insert into auth.users (id, email, aud, role) values
  ('c5190000-0000-0000-0000-000000000001', 'c519-host@example.com', 'authenticated', 'authenticated'),
  ('c5190000-0000-0000-0000-000000000002', 'c519-guest@example.com', 'authenticated', 'authenticated');
insert into public.profiles (id, email) values
  ('c5190000-0000-0000-0000-000000000001', 'c519-host@example.com'),
  ('c5190000-0000-0000-0000-000000000002', 'c519-guest@example.com')
  on conflict (id) do nothing;
update public.profiles set full_name = 'Zoë Adébáyọ̀', handle = 'zoe-lagos' where id = 'c5190000-0000-0000-0000-000000000001';
update public.profiles set full_name = 'Guest Without Handle' where id = 'c5190000-0000-0000-0000-000000000002';
insert into public.events (id, owner_id, title, slug, category, starts_at, venue_name, city)
  values ('c5190000-0000-0000-0000-0000000000e1', 'c5190000-0000-0000-0000-000000000001', 'Soirée Jazz', 'c519-jazz', 'Music',
          now() + interval '7 days', 'Café Neo', 'Lomé');

select is((select search_text from public.events where id = 'c5190000-0000-0000-0000-0000000000e1'), 'soiree jazz cafe neo lome',
  'an event''s search text is its title, venue and city, folded');
select is((select search_text from public.profiles where id = 'c5190000-0000-0000-0000-000000000001'), 'zoe adebayo zoe-lagos',
  'a host''s search text is the name and handle, folded');
select is((select search_text from public.profiles where id = 'c5190000-0000-0000-0000-000000000002'), null,
  'a profile without a handle has no search text');

set local role gventz_api;
select lives_ok(
  $$update public.events set city = 'Accra' where id = 'c5190000-0000-0000-0000-0000000000e1'$$,
  'gventz_api edits an event as before');
select is((select search_text from public.events where id = 'c5190000-0000-0000-0000-0000000000e1'), 'soiree jazz cafe neo accra',
  'the search text follows the edit');
select throws_ok(
  $$update public.events set search_text = 'x' where id = 'c5190000-0000-0000-0000-0000000000e1'$$,
  '428C9', null, 'nobody writes the search text');
reset role;

-- The touch trigger still tells an active_count-only update from a real change.
alter table public.events disable trigger events_touch;
update public.events set updated_at = '2026-01-01T00:00:00Z' where id = 'c5190000-0000-0000-0000-0000000000e1';
alter table public.events enable trigger events_touch;
update public.events set active_count = active_count + 1 where id = 'c5190000-0000-0000-0000-0000000000e1';
select is((select updated_at from public.events where id = 'c5190000-0000-0000-0000-0000000000e1'), '2026-01-01T00:00:00Z'::timestamptz,
  'an active_count-only update still leaves updated_at alone');
update public.events set title = 'Soirée Jazz II' where id = 'c5190000-0000-0000-0000-0000000000e1';
select ok((select updated_at from public.events where id = 'c5190000-0000-0000-0000-0000000000e1') > '2026-01-01T00:00:00Z'::timestamptz,
  'a real change still stamps now()');

-- The planner uses both indexes for a contains-search written as the API writes it.
create function pg_temp.plan_of(query text) returns text language plpgsql as $f$
declare
  line text;
  result text := '';
begin
  for line in execute 'explain ' || query loop
    result := result || line || E'\n';
  end loop;
  return result;
end
$f$;
-- Enough listed events and hosts that scanning them all costs more than the index.
insert into auth.users (id, email, aud, role)
  select ('c5191000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'c519-' || n || '@example.com', 'authenticated', 'authenticated'
  from generate_series(1, 2000) n;
insert into public.profiles (id, email, full_name, handle)
  select ('c5191000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'c519-' || n || '@example.com', 'Host ' || n, 'c519-host-' || n
  from generate_series(1, 2000) n
  on conflict (id) do update set full_name = excluded.full_name, handle = excluded.handle;
insert into public.events (owner_id, title, slug, category, starts_at, status, visibility, venue_name, city)
  select ('c5191000-0000-0000-0000-' || lpad((1 + n % 2000)::text, 12, '0'))::uuid, 'C519 event ' || n, 'c519-event-' || n, 'Music',
    now() + n * interval '1 hour', 'published', 'public', 'Hall ' || n, (array['Abuja', 'Accra', 'Nairobi', 'Kigali'])[1 + n % 4]
  from generate_series(1, 5000) n;
-- Move the new rows out of the GIN pending lists (autovacuum does this on a live database).
select ok(gin_clean_pending_list('public.events_search_trgm_idx'::regclass) >= 0, 'the events index pending list is flushed');
select ok(gin_clean_pending_list('public.profiles_search_trgm_idx'::regclass) >= 0, 'the profiles index pending list is flushed');
analyze public.events;
analyze public.profiles;
select matches(
  pg_temp.plan_of($q$select id from public.events where status = 'published' and visibility = 'public' and search_text like '%lagos%'$q$),
  'events_search_trgm_idx', 'the event search uses its trigram index');
select matches(
  pg_temp.plan_of($q$select id from public.profiles where handle is not null and search_text like '%okafor%'$q$),
  'profiles_search_trgm_idx', 'the host search uses its trigram index');
select * from finish();
rollback;
