-- Checkout groups and recipients (20261114001800): group_size and description on ticket types,
-- group_size fixed once sold, wider ticket counts, recipient_email, buyer phone and gender on
-- orders and profiles. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'host@example.com', 'authenticated', 'authenticated');
insert into public.profiles (id, email) values ('11111111-1111-1111-1111-111111111111', 'host@example.com')
  on conflict (id) do nothing;
insert into public.events (id, owner_id, title, slug, category, starts_at, status, visibility) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Groups', 'groups-recipients',
   'Music', now() + interval '7 days', 'published', 'public');
insert into public.ticket_tiers (id, event_id, name) values
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Single');
insert into public.orders (id, event_id, buyer_id, status, ticket_count, currency) values
  ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'completed', 1, 'NGN');

select col_default_is('public', 'ticket_tiers', 'group_size', '1', 'group_size defaults to 1');
select is((select group_size from public.ticket_tiers where id = '44444444-4444-4444-4444-444444444444'), 1::smallint,
  'existing ticket types are ordinary tickets');
select col_is_null('public', 'ticket_tiers', 'description', 'description is optional');

set local role gventz_api;

-- Ticket types
select lives_ok(
  $$insert into public.ticket_tiers (id, event_id, name, group_size, description) values
    ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'Table of 20', 20, repeat('d', 300))$$,
  'a group of 20 with a 300-character description');
select throws_ok(
  $$insert into public.ticket_tiers (event_id, name, group_size) values ('33333333-3333-3333-3333-333333333333', 'Big', 21)$$,
  '23514', null, 'groups are at most 20');
select throws_ok(
  $$insert into public.ticket_tiers (event_id, name, group_size) values ('33333333-3333-3333-3333-333333333333', 'None', 0)$$,
  '23514', null, 'groups are at least 1');
select throws_ok(
  $$insert into public.ticket_tiers (event_id, name, description) values ('33333333-3333-3333-3333-333333333333', 'Long', repeat('d', 301))$$,
  '23514', null, 'descriptions are at most 300 characters');
select lives_ok(
  $$update public.ticket_tiers set group_size = 4 where id = '55555555-5555-5555-5555-555555555555'$$,
  'group_size can change while nothing is sold');
update public.ticket_tiers set sold = 4 where id = '55555555-5555-5555-5555-555555555555';
select throws_ok(
  $$update public.ticket_tiers set group_size = 2 where id = '55555555-5555-5555-5555-555555555555'$$,
  'P0001', 'The group size can''t change once tickets are sold.', 'group_size is fixed once sold');
select lives_ok(
  $$update public.ticket_tiers set name = 'Table of 4', description = null where id = '55555555-5555-5555-5555-555555555555'$$,
  'other fields still change once sold');

-- Orders and tickets: up to 200 entries
select lives_ok(
  $$update public.orders set ticket_count = 200 where id = '66666666-6666-6666-6666-666666666666'$$,
  'an order holds up to 200 entries');
select throws_ok(
  $$update public.orders set ticket_count = 201 where id = '66666666-6666-6666-6666-666666666666'$$,
  '23514', null, 'but not 201');
select lives_ok(
  $$insert into public.registrations (id, event_id, tier_id, user_id, attendee_name, attendee_email, status, order_id, ticket_number, guest_name, recipient_email)
    values ('77777777-7777-7777-7777-777777777777', '33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555',
            '11111111-1111-1111-1111-111111111111', 'Host Person', 'host@example.com', 'confirmed',
            '66666666-6666-6666-6666-666666666666', 150, 'Ada Friend', 'ada.friend@example.com')$$,
  'ticket 150 of an order, sent to a recipient');
select throws_ok(
  $$insert into public.registrations (event_id, tier_id, attendee_name, attendee_email, order_id, ticket_number)
    values ('33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555', 'X', 'x@example.com',
            '66666666-6666-6666-6666-666666666666', 201)$$,
  '23514', null, 'ticket numbers stop at 200');
select throws_ok(
  $$update public.registrations set recipient_email = 'Ada@Example.com' where id = '77777777-7777-7777-7777-777777777777'$$,
  '23514', null, 'recipient emails are lower-case');
select throws_ok(
  $$update public.registrations set recipient_email = 'not-an-email' where id = '77777777-7777-7777-7777-777777777777'$$,
  '23514', null, 'recipient emails look like emails');
select throws_ok(
  $$update public.registrations set recipient_email = repeat('a', 250) || '@x.io' where id = '77777777-7777-7777-7777-777777777777'$$,
  '23514', null, 'recipient emails are at most 254 characters');
select lives_ok(
  $$update public.registrations set recipient_email = null where id = '77777777-7777-7777-7777-777777777777'$$,
  'a ticket can stay with the buyer');

-- Buyer phone and gender on orders
select lives_ok(
  $$update public.orders set buyer_phone = '+2348012345678', buyer_gender = 'female' where id = '66666666-6666-6666-6666-666666666666'$$,
  'an E.164 phone and a gender on the order');
select throws_ok(
  $$update public.orders set buyer_phone = '08012345678' where id = '66666666-6666-6666-6666-666666666666'$$,
  '23514', null, 'order phones start with +');
select throws_ok(
  $$update public.orders set buyer_phone = '+0123456789' where id = '66666666-6666-6666-6666-666666666666'$$,
  '23514', null, 'order phones have no leading 0 country code');
select throws_ok(
  $$update public.orders set buyer_phone = '+1234567890123456' where id = '66666666-6666-6666-6666-666666666666'$$,
  '23514', null, 'order phones are at most 15 digits');
select throws_ok(
  $$update public.orders set buyer_gender = 'other' where id = '66666666-6666-6666-6666-666666666666'$$,
  '23514', null, 'order genders are female, male or unspecified');
select lives_ok(
  $$update public.orders set buyer_gender = 'unspecified' where id = '66666666-6666-6666-6666-666666666666'$$,
  'prefer not to say is stored as unspecified');

-- Phone and gender on profiles
select lives_ok(
  $$update public.profiles set phone = '+233201234567', gender = 'male' where id = '11111111-1111-1111-1111-111111111111'$$,
  'the profile remembers phone and gender');
select throws_ok(
  $$update public.profiles set phone = '+234 801 234 5678' where id = '11111111-1111-1111-1111-111111111111'$$,
  '23514', null, 'profile phones have no spaces');
select throws_ok(
  $$update public.profiles set gender = 'Female' where id = '11111111-1111-1111-1111-111111111111'$$,
  '23514', null, 'profile genders are lower-case codes');
select lives_ok(
  $$update public.profiles set phone = null, gender = null where id = '11111111-1111-1111-1111-111111111111'$$,
  'both can be cleared');

select * from finish();
rollback;
