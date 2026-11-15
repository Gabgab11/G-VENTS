-- profiles_email_lower_idx (20261114001000): the API's email-language lookup can use an index.
-- Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select has_index('public', 'profiles', 'profiles_email_lower_idx', 'profiles have an index on lower(email)');
select ok(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'profiles_email_lower_idx') ilike '%(lower(email))%',
  'the index is on lower(email), the expression the API filters on');

-- The plan for the API's query uses the index (sequential scans off, as on a large table).
create function pg_temp.lookup_plan() returns text language plpgsql as $$
declare line text; plan text := '';
begin
  for line in execute 'explain select language from public.profiles where lower(email) = ''ada@example.com''' loop
    plan := plan || line || ' ';
  end loop;
  return plan;
end $$;
set local enable_seqscan = off;
select ok(pg_temp.lookup_plan() ilike '%profiles_email_lower_idx%', 'the lookup by lower(email) uses the index');

select * from finish();
rollback;
