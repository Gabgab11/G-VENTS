-- Database tests for orders, ticket columns and events.active_count (Change 1 / U4).
-- Run by `supabase test db`. Each test runs inside a transaction that is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

select is((select relrowsecurity from pg_class where oid = 'public.orders'::regclass), true,
  'row-level security is on for orders');
select table_privs_are('public', 'orders', 'gventz_api', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'the API can read and write orders');
select table_privs_are('public', 'orders', 'authenticated', array[]::text[],
  'signed-in users have no direct rights on orders');
select hasnt_index('public', 'registrations', 'registrations_one_active_per_user',
  'one buyer may hold several tickets for an event');

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'host@example.com', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'guest@example.com', 'authenticated', 'authenticated');
insert into public.events (id, owner_id, title, slug, category, starts_at, status, visibility, updated_at) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Party', 'party-ev',
   'Music', now() + interval '7 days', 'published', 'public', '2020-01-01T00:00:00Z');
insert into public.ticket_tiers (id, event_id, name) values
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Free');

-- The current app's register_guest, as a signed-in guest.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select lives_ok(
  $$select public.register_guest('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', 'Guest Person', '', '{}')$$,
  'register_guest still works');
select throws_ok(
  $$select public.register_guest('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', 'Guest Person', '', '{}')$$,
  'You are already registered for this event', 'register_guest still refuses a second registration');
reset role;

select is((select active_count from public.events where id = '33333333-3333-3333-3333-333333333333'), 1,
  'a ticket from register_guest is counted');

-- The API: one order with three tickets.
set local role gventz_api;
insert into public.orders (id, event_id, buyer_id, status, ticket_count, currency) values
  ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'completed', 3, 'NGN');
insert into public.registrations
  (event_id, tier_id, user_id, attendee_name, attendee_email, status, order_id, ticket_number, guest_name)
select '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444',
       '11111111-1111-1111-1111-111111111111', 'Host Person', 'host@example.com', 'confirmed',
       '66666666-6666-6666-6666-666666666666', n, case when n > 1 then 'Guest ' || n end
  from generate_series(1, 3) n;
select is((select active_count from public.events where id = '33333333-3333-3333-3333-333333333333'), 4,
  'the API''s tickets are counted (several per buyer)');

update public.registrations set status = 'declined'
 where order_id = '66666666-6666-6666-6666-666666666666' and ticket_number = 3;
select is((select active_count from public.events where id = '33333333-3333-3333-3333-333333333333'), 3,
  'a declined ticket leaves the count');

insert into public.registrations (event_id, tier_id, user_id, attendee_name, attendee_email, status)
values ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444',
        '11111111-1111-1111-1111-111111111111', 'Host Person', 'host@example.com', 'waitlisted');
select is((select active_count from public.events where id = '33333333-3333-3333-3333-333333333333'), 3,
  'a waitlisted ticket is not counted');

delete from public.registrations
 where order_id = '66666666-6666-6666-6666-666666666666' and ticket_number = 2;
select is((select active_count from public.events where id = '33333333-3333-3333-3333-333333333333'), 2,
  'a deleted ticket leaves the count');

select is((select updated_at from public.events where id = '33333333-3333-3333-3333-333333333333'),
  '2020-01-01T00:00:00Z'::timestamptz, 'count changes do not move updated_at');

update public.events set title = 'Party 2' where id = '33333333-3333-3333-3333-333333333333';
select isnt((select updated_at from public.events where id = '33333333-3333-3333-3333-333333333333'),
  '2020-01-01T00:00:00Z'::timestamptz, 'a host change still moves updated_at');

select throws_ok(
  $$insert into public.registrations (event_id, tier_id, attendee_name, attendee_email, status, order_id, ticket_number)
    values ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', 'X Y', 'x@y.co',
            'confirmed', '66666666-6666-6666-6666-666666666666', 1)$$,
  '23505', null, 'a ticket number is used once per order');

select throws_ok(
  $$update public.events set active_count = -1 where id = '33333333-3333-3333-3333-333333333333'$$,
  '23514', null, 'the count cannot go below zero');

select lives_ok($$delete from public.events where id = '33333333-3333-3333-3333-333333333333'$$,
  'deleting an event with orders and tickets still works');

select * from finish();
rollback;
