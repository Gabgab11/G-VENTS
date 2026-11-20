-- Discount codes (20261114001400): code format and uniqueness, values per kind, the uses limit,
-- one redemption per order, the `discount` ledger kind, and access for the API role only. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'host@example.com', 'authenticated', 'authenticated');
insert into public.events (id, owner_id, title, slug, category, starts_at, status, visibility) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Paid', 'paid-discount',
   'Music', now() + interval '7 days', 'published', 'public');
insert into public.orders (id, event_id, buyer_id, status, ticket_count, currency, kind) values
  ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'awaiting_payment', 1, 'NGN', 'paid');

select has_table('public', 'discount_codes', 'discount_codes exists');
select has_table('public', 'discount_redemptions', 'discount_redemptions exists');

set local role gventz_api;
select lives_ok(
  $$insert into public.discount_codes (id, event_id, code, kind, value, max_uses) values
    ('77777777-7777-7777-7777-777777777777', '33333333-3333-3333-3333-333333333333', 'EARLY-BIRD_25', 'percent', 2500, 1)$$,
  'the API role creates a percent code');
select throws_ok(
  $$insert into public.discount_codes (event_id, code, kind, value) values
    ('33333333-3333-3333-3333-333333333333', 'EARLY-BIRD_25', 'fixed', 100)$$,
  '23505', null, 'codes are unique per event');
select throws_ok(
  $$insert into public.discount_codes (event_id, code, kind, value) values
    ('33333333-3333-3333-3333-333333333333', 'lower', 'free', 0)$$,
  '23514', null, 'codes are stored upper-case');
select throws_ok(
  $$insert into public.discount_codes (event_id, code, kind, value) values
    ('33333333-3333-3333-3333-333333333333', 'AB', 'free', 0)$$,
  '23514', null, 'codes have at least 3 characters');
select throws_ok(
  $$insert into public.discount_codes (event_id, code, kind, value) values
    ('33333333-3333-3333-3333-333333333333', 'TOOMUCH', 'percent', 10001)$$,
  '23514', null, 'a percent code is at most 10000 basis points');
select throws_ok(
  $$insert into public.discount_codes (event_id, code, kind, value) values
    ('33333333-3333-3333-3333-333333333333', 'NOTHING', 'fixed', 0)$$,
  '23514', null, 'a fixed code takes something off');
select throws_ok(
  $$insert into public.discount_codes (event_id, code, kind, value, starts_at, ends_at) values
    ('33333333-3333-3333-3333-333333333333', 'BACKWARDS', 'free', 0, now(), now() - interval '1 day')$$,
  '23514', null, 'the window ends after it starts');

select lives_ok(
  $$update public.discount_codes set uses = uses + 1 where id = '77777777-7777-7777-7777-777777777777'$$,
  'a use within the limit is counted');
select throws_ok(
  $$update public.discount_codes set uses = uses + 1 where id = '77777777-7777-7777-7777-777777777777'$$,
  '23514', null, 'uses never pass max_uses');

select lives_ok(
  $$insert into public.discount_redemptions (code_id, order_id, amount_minor) values
    ('77777777-7777-7777-7777-777777777777', '66666666-6666-6666-6666-666666666666', 125000)$$,
  'a redemption is written with the order');
select throws_ok(
  $$insert into public.discount_redemptions (code_id, order_id, amount_minor) values
    ('77777777-7777-7777-7777-777777777777', '66666666-6666-6666-6666-666666666666', 125000)$$,
  '23505', null, 'one redemption per order');
select lives_ok(
  $$insert into public.ledger_entries (order_id, host_id, kind, account, amount_minor, currency) values
    ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'discount', 'host', -125000, 'NGN'),
    ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'discount', 'guest', 125000, 'NGN')$$,
  'the ledger takes the discount kind');
select throws_ok(
  $$insert into public.ledger_entries (order_id, kind, account, amount_minor, currency) values
    ('66666666-6666-6666-6666-666666666666', 'coupon', 'host', -1, 'NGN')$$,
  '23514', null, 'other ledger kinds are still refused');
reset role;

set local role authenticated;
select throws_ok($$select * from public.discount_codes$$, '42501', null, 'signed-in users cannot read codes directly');
reset role;
set local role anon;
select throws_ok($$select * from public.discount_redemptions$$, '42501', null, 'anonymous users cannot read redemptions');
reset role;

select * from finish();
rollback;
