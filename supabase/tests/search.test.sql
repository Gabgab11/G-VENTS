-- 20261114001900: header search folding and trigram indexes. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select has_extension('extensions', 'pg_trgm', 'pg_trgm is installed in the extensions schema');
select has_extension('extensions', 'unaccent', 'unaccent is installed in the extensions schema');
select volatility_is('public', 'search_fold', array['text'], 'immutable', 'search_fold can be indexed');
select is(public.search_fold('Café Ñandú ÉKÒ'), 'cafe nandu eko', 'search_fold lowers case and removes accents');
select is(public.search_fold(null), null, 'search_fold keeps null');
select has_index('public', 'events', 'events_search_trgm_idx', 'events have the search index');
select has_index('public', 'profiles', 'profiles_search_trgm_idx', 'profiles have the search index');

set local role gventz_api;
select is(public.search_fold('Zoë'), 'zoe', 'gventz_api can call search_fold');
reset role;

-- The planner can use both indexes for a contains-search written as the API writes it.
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
  select ('c5190000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'c519-' || n || '@example.com', 'authenticated', 'authenticated'
  from generate_series(1, 2000) n;
insert into public.profiles (id, email, full_name, handle)
  select ('c5190000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'c519-' || n || '@example.com', 'Host ' || n, 'c519-host-' || n
  from generate_series(1, 2000) n
  on conflict (id) do update set full_name = excluded.full_name, handle = excluded.handle;
insert into public.events (owner_id, title, slug, category, starts_at, status, visibility, venue_name, city)
  select ('c5190000-0000-0000-0000-' || lpad((1 + n % 2000)::text, 12, '0'))::uuid, 'C519 event ' || n, 'c519-event-' || n, 'Music',
    now() + n * interval '1 hour', 'published', 'public', 'Hall ' || n, (array['Abuja', 'Accra', 'Nairobi', 'Kigali'])[1 + n % 4]
  from generate_series(1, 5000) n;
-- Move the new rows out of the GIN pending lists (autovacuum does this on a live database).
select ok(gin_clean_pending_list('public.events_search_trgm_idx'::regclass) >= 0, 'the events index pending list is flushed');
select ok(gin_clean_pending_list('public.profiles_search_trgm_idx'::regclass) >= 0, 'the profiles index pending list is flushed');
analyze public.events;
analyze public.profiles;
select matches(
  pg_temp.plan_of($q$select id from public.events where status = 'published' and visibility = 'public'
    and public.search_fold(title || ' ' || coalesce(venue_name, '') || ' ' || coalesce(city, '')) like '%lagos%'$q$),
  'events_search_trgm_idx', 'the event search uses its trigram index');
select matches(
  pg_temp.plan_of($q$select id from public.profiles where handle is not null
    and public.search_fold(coalesce(full_name, '') || ' ' || handle) like '%ada%'$q$),
  'profiles_search_trgm_idx', 'the host search uses its trigram index');
select * from finish();
rollback;
