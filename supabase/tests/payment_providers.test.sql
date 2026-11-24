-- Payment providers (20261114002100, Change 5 chunk 4, PS7, PS10-PS13, PS21). Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, aud, role) values
  ('44444444-4444-4444-4444-444444444444', 'fw-host@example.com', 'authenticated', 'authenticated');
insert into public.profiles (id, email) values ('44444444-4444-4444-4444-444444444444', 'fw-host@example.com')
  on conflict (id) do nothing;

select has_table('public', 'payout_subaccounts', 'payout_subaccounts exists');
select has_column('public', 'orders', 'provider', 'orders.provider exists');
select has_column('public', 'ledger_entries', 'provider', 'ledger_entries.provider exists');

-- Seven more payout countries.
insert into public.payout_accounts (id, host_id, country, currency, bank_code, account_number, business_name)
values ('a4444444-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'UG', 'UGX', '044', '0123456789', 'FW Host');
select pass('a Ugandan payout account is accepted');

set local role gventz_api;

select lives_ok(
  $$insert into public.payout_subaccounts (payout_account_id, provider, status)
    values ('a4444444-0000-0000-0000-000000000001', 'flutterwave', 'pending')$$,
  'the API adds a Flutterwave subaccount');
select throws_ok(
  $$insert into public.payout_subaccounts (payout_account_id, provider, status)
    values ('a4444444-0000-0000-0000-000000000001', 'flutterwave', 'pending')$$,
  '23505', null, 'one subaccount per payout account and provider');
select throws_ok(
  $$update public.payout_subaccounts set status = 'active'
     where payout_account_id = 'a4444444-0000-0000-0000-000000000001'$$,
  '23514', null, 'an active subaccount needs its code');
select throws_ok(
  $$insert into public.payout_subaccounts (payout_account_id, provider) values ('a4444444-0000-0000-0000-000000000001', 'stripe')$$,
  '23514', null, 'only paystack and flutterwave');

-- Webhook events: once per provider, country and id; Flutterwave's have no country.
select lives_ok(
  $$insert into public.webhook_inbox (provider, country, event_id, type, payload)
    values ('flutterwave', null, 'fw-1', 'charge.completed', '{}'::jsonb)$$,
  'a Flutterwave event is stored without a country');
select throws_ok(
  $$insert into public.webhook_inbox (provider, country, event_id, type, payload)
    values ('flutterwave', null, 'fw-1', 'charge.completed', '{}'::jsonb)$$,
  '23505', null, 'the same Flutterwave event is stored once');
select lives_ok(
  $$insert into public.webhook_inbox (provider, country, event_id, type, payload)
    values ('paystack', 'NG', 'fw-1', 'charge.success', '{}'::jsonb)$$,
  'the same id from another provider is a different event');
select throws_ok(
  $$insert into public.webhook_inbox (provider, country, event_id, type, payload)
    values ('paystack', null, 'ps-2', 'charge.success', '{}'::jsonb)$$,
  '23514', null, 'Paystack events need their country');

reset role;

-- The settings are seeded.
select ok(
  (select value ? 'flutterwave' from public.platform_settings where key = 'payments'),
  'the payments switches include flutterwave');
select is(
  (select (value -> 'flutterwave' -> 'UG' ->> 'confirmed')::boolean from public.platform_settings where key = 'provider_charges'),
  false, 'Flutterwave rates start unconfirmed');

select * from finish();
rollback;
