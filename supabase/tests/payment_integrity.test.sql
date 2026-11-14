-- Payment integrity (20261114000600, security review B1 and B2): payment records outlive their
-- event, the ledger is append-only, and refunds never exceed the payment. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'host@example.com', 'authenticated', 'authenticated');
insert into public.events (id, owner_id, title, slug, category, starts_at, status, visibility) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Paid', 'paid-ev',
   'Music', now() + interval '7 days', 'published', 'public');
insert into public.orders (id, event_id, buyer_id, status, ticket_count, currency, kind) values
  ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'completed', 2, 'NGN', 'paid');

set local role gventz_api;
insert into public.payments (order_id, country, reference, amount_minor, currency, status) values
  ('66666666-6666-6666-6666-666666666666', 'NG', 'gvz_test_1', 1000000, 'NGN', 'success');
insert into public.ledger_entries (order_id, host_id, kind, account, amount_minor, currency) values
  ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'charge', 'guest', -1000000, 'NGN');

select lives_ok(
  $$insert into public.refunds (order_id, amount_minor, currency, reason) values
    ('66666666-6666-6666-6666-666666666666', 600000, 'NGN', 'host')$$,
  'a refund within the payment is allowed');
select throws_ok(
  $$insert into public.refunds (order_id, amount_minor, currency, reason) values
    ('66666666-6666-6666-6666-666666666666', 400001, 'NGN', 'host')$$,
  '23514', null, 'refunds that have not failed never add up to more than the payment');
select lives_ok(
  $$insert into public.refunds (order_id, amount_minor, currency, reason, status) values
    ('66666666-6666-6666-6666-666666666666', 900000, 'NGN', 'host', 'failed')$$,
  'a failed refund does not count');
select throws_ok(
  $$update public.ledger_entries set amount_minor = 0 where order_id = '66666666-6666-6666-6666-666666666666'$$,
  '42501', null, 'ledger entries cannot be changed');
reset role;

select throws_ok(
  $$delete from public.ledger_entries where order_id = '66666666-6666-6666-6666-666666666666'$$,
  '42501', null, 'ledger entries cannot be deleted, even by the owner');
select throws_ok(
  $$delete from public.events where id = '33333333-3333-3333-3333-333333333333'$$,
  '23503', null, 'an event with payment records cannot be deleted');
select throws_ok(
  $$delete from public.profiles where id = '11111111-1111-1111-1111-111111111111'$$,
  null, null, 'a host with payment history keeps their profile');
select col_type_is('public', 'payments', 'amount_minor', 'bigint', 'payment amounts are bigint');

select * from finish();
rollback;
