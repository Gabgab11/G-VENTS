-- profiles' email preferences (20261114002000, Change 5 FR-35): three switches, on by default,
-- never null, changed only through gventz-api. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email, aud, role) values
  ('33333333-3333-3333-3333-333333333333', 'prefs@example.com', 'authenticated', 'authenticated');
insert into public.profiles (id, email) values ('33333333-3333-3333-3333-333333333333', 'prefs@example.com')
  on conflict (id) do nothing;

select col_not_null('public', 'profiles', 'email_announcements', 'email_announcements is never null');
select col_not_null('public', 'profiles', 'email_followed_hosts', 'email_followed_hosts is never null');
select col_not_null('public', 'profiles', 'email_product', 'email_product is never null');
select col_type_is('public', 'profiles', 'email_announcements', 'boolean', 'email_announcements is a boolean');
select col_type_is('public', 'profiles', 'email_followed_hosts', 'boolean', 'email_followed_hosts is a boolean');
select col_type_is('public', 'profiles', 'email_product', 'boolean', 'email_product is a boolean');

select results_eq(
  $$select email_announcements, email_followed_hosts, email_product from public.profiles
    where id = '33333333-3333-3333-3333-333333333333'$$,
  $$values (true, true, true)$$,
  'a new profile is opted in to all three');

set local role gventz_api;
select lives_ok(
  $$update public.profiles set email_announcements = false, email_followed_hosts = false, email_product = false
    where id = '33333333-3333-3333-3333-333333333333'$$,
  'gventz_api can switch them off');
select throws_ok(
  $$update public.profiles set email_product = null where id = '33333333-3333-3333-3333-333333333333'$$,
  '23502', null, 'a preference cannot be null');
reset role;

select results_eq(
  $$select email_announcements, email_followed_hosts, email_product from public.profiles
    where id = '33333333-3333-3333-3333-333333333333'$$,
  $$values (false, false, false)$$,
  'the switches were saved');

set local role authenticated;
select throws_ok(
  $$update public.profiles set email_announcements = true where id = '33333333-3333-3333-3333-333333333333'$$,
  '42501', null, 'signed-in users cannot change email_announcements directly');
select throws_ok(
  $$update public.profiles set email_product = true where id = '33333333-3333-3333-3333-333333333333'$$,
  '42501', null, 'signed-in users cannot change email_product directly');
reset role;

select has_index('public', 'event_members', 'event_members_user_accepted_idx', 'accepted roles are indexed by user (GET /v1/me isHost)');

select * from finish();
rollback;
