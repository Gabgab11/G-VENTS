-- Host profiles and follows (20261114001200, Change 4 FR-32): handle format and uniqueness, field
-- limits, https-only socials, no self-follow, and only gventz-api can touch the new tables. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email, aud, role) values
  ('31111111-1111-1111-1111-111111111111', 'host-a@example.com', 'authenticated', 'authenticated'),
  ('32222222-2222-2222-2222-222222222222', 'host-b@example.com', 'authenticated', 'authenticated');
insert into public.profiles (id, email) values
  ('31111111-1111-1111-1111-111111111111', 'host-a@example.com'),
  ('32222222-2222-2222-2222-222222222222', 'host-b@example.com')
  on conflict (id) do nothing;

select has_column('public', 'profiles', 'handle', 'profiles have a handle');
select has_column('public', 'profiles', 'verified_at', 'profiles have a verified time');
select has_table('public', 'profile_handle_history', 'the handle history table exists');
select has_table('public', 'host_follows', 'the follows table exists');
select table_privs_are('public', 'host_follows', 'gventz_api', array['SELECT', 'INSERT', 'DELETE'],
  'the API adds and removes follows, never edits one');
select table_privs_are('public', 'profile_handle_history', 'gventz_api', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'the API keeps the handle history');

set local role gventz_api;
select lives_ok(
  $$update public.profiles set handle = 'ada-lagos', bio = 'Hello', location = 'Lagos',
      instagram = 'https://instagram.com/ada', website = 'https://ada.example.com'
    where id = '31111111-1111-1111-1111-111111111111'$$,
  'gventz_api can set a valid handle and host fields');
select throws_ok(
  $$update public.profiles set handle = 'ADA-LAGOS' where id = '32222222-2222-2222-2222-222222222222'$$,
  '23514', null, 'handles are stored lower-case');
select throws_ok(
  $$update public.profiles set handle = 'ab' where id = '32222222-2222-2222-2222-222222222222'$$,
  '23514', null, 'handles have at least 3 characters');
select throws_ok(
  $$update public.profiles set handle = 'a--b' where id = '32222222-2222-2222-2222-222222222222'$$,
  '23514', null, 'doubled hyphens are refused');
select throws_ok(
  $$update public.profiles set handle = '-abc' where id = '32222222-2222-2222-2222-222222222222'$$,
  '23514', null, 'a leading hyphen is refused');
select throws_ok(
  $$update public.profiles set handle = 'ada-lagos' where id = '32222222-2222-2222-2222-222222222222'$$,
  '23505', null, 'handles are unique');
select throws_ok(
  $$update public.profiles set bio = repeat('x', 501) where id = '32222222-2222-2222-2222-222222222222'$$,
  '23514', null, 'bios are at most 500 characters');
select throws_ok(
  $$update public.profiles set facebook = 'http://facebook.com/b' where id = '32222222-2222-2222-2222-222222222222'$$,
  '23514', null, 'social links must be https');
select lives_ok(
  $$insert into public.profile_handle_history (old_handle, profile_id) values ('ada-old', '31111111-1111-1111-1111-111111111111')$$,
  'gventz_api records an old handle');
select throws_ok(
  $$insert into public.profile_handle_history (old_handle, profile_id) values ('ada-old', '32222222-2222-2222-2222-222222222222')$$,
  '23505', null, 'an old handle is held by one profile');
select lives_ok(
  $$insert into public.host_follows (follower_id, host_id) values ('32222222-2222-2222-2222-222222222222', '31111111-1111-1111-1111-111111111111')$$,
  'gventz_api records a follow');
select matches(
  (select token from public.host_follows where host_id = '31111111-1111-1111-1111-111111111111'),
  '^[0-9a-f]{32}$', 'each follow gets a 32-hex unsubscribe token');
select throws_ok(
  $$insert into public.host_follows (follower_id, host_id) values ('31111111-1111-1111-1111-111111111111', '31111111-1111-1111-1111-111111111111')$$,
  '23514', null, 'nobody follows themselves');
reset role;

set local role authenticated;
select throws_ok($$select count(*) from public.host_follows$$, '42501', null, 'signed-in users cannot read follows directly');
select throws_ok($$select count(*) from public.profile_handle_history$$, '42501', null, 'signed-in users cannot read the handle history directly');
reset role;

select * from finish();
rollback;
