-- Change 5, chunk 4: payment switches and Flutterwave (FR-37, D96-D99, NFR-16, NFR-17).
-- Design: aidlc-docs/construction/c5-chunk4-payments/functional-design/ (PS1-PS26).
--
-- * Flutterwave joins Paystack as a provider; the provider checks widen to both.
-- * Seven more payout countries for Flutterwave (UG, TZ, RW, ZM, CM, CI, SN).
-- * orders.provider: the provider a paid order was taken with, set at the hold, never changed (PS7).
--   payments.provider already exists; it is now also fixed once written.
-- * payout_subaccounts: one subaccount per (payout account, provider) (PS10-PS13). The current
--   payout_accounts.subaccount_code values are copied in as Paystack rows; the column stays for
--   one release (expand before contract).
-- * ledger_entries.provider: which provider an entry concerns (null before this migration = Paystack).
--   The provider's ledger account is named after it ('paystack' | 'flutterwave').
-- * webhook_inbox: Flutterwave has one account for every country, so its events have no country.
-- * platform_settings: flutterwave switch, active_provider, flutterwave_countries, provider_charges.
--
-- Additive only: existing rows and the current API release keep working.

set lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------
-- Countries and providers
-- ---------------------------------------------------------------------------------------------
alter table public.host_applications drop constraint if exists host_applications_payout_country_check;
alter table public.host_applications add constraint host_applications_payout_country_check
  check (payout_country in ('NG', 'GH', 'KE', 'ZA', 'UG', 'TZ', 'RW', 'ZM', 'CM', 'CI', 'SN'));

alter table public.payout_accounts drop constraint if exists payout_accounts_country_check;
alter table public.payout_accounts add constraint payout_accounts_country_check
  check (country in ('NG', 'GH', 'KE', 'ZA', 'UG', 'TZ', 'RW', 'ZM', 'CM', 'CI', 'SN'));
alter table public.payout_accounts drop constraint if exists payout_accounts_provider_check;
alter table public.payout_accounts add constraint payout_accounts_provider_check
  check (provider in ('paystack', 'flutterwave'));

alter table public.orders drop constraint if exists orders_country_check;
alter table public.orders add constraint orders_country_check
  check (country is null or country in ('NG', 'GH', 'KE', 'ZA', 'UG', 'TZ', 'RW', 'ZM', 'CM', 'CI', 'SN'));

alter table public.events drop constraint if exists events_payment_country_check;
alter table public.events add constraint events_payment_country_check
  check (payment_country is null or payment_country in ('NG', 'GH', 'KE', 'ZA', 'UG', 'TZ', 'RW', 'ZM', 'CM', 'CI', 'SN'));

alter table public.payments drop constraint if exists payments_country_check;
alter table public.payments add constraint payments_country_check
  check (country in ('NG', 'GH', 'KE', 'ZA', 'UG', 'TZ', 'RW', 'ZM', 'CM', 'CI', 'SN'));
alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check
  check (provider in ('paystack', 'flutterwave'));

alter table public.reconciliation_runs drop constraint if exists reconciliation_runs_country_check;
alter table public.reconciliation_runs add constraint reconciliation_runs_country_check
  check (country in ('NG', 'GH', 'KE', 'ZA', 'UG', 'TZ', 'RW', 'ZM', 'CM', 'CI', 'SN'));
alter table public.reconciliation_runs drop constraint if exists reconciliation_runs_provider_check;
alter table public.reconciliation_runs add constraint reconciliation_runs_provider_check
  check (provider in ('paystack', 'flutterwave'));

-- ---------------------------------------------------------------------------------------------
-- Webhook inbox: Paystack events carry their country's account; Flutterwave's have none.
-- Stored once per (provider, country or '', event id) (PS21).
-- ---------------------------------------------------------------------------------------------
alter table public.webhook_inbox alter column country drop not null;
alter table public.webhook_inbox drop constraint if exists webhook_inbox_country_check;
alter table public.webhook_inbox add constraint webhook_inbox_country_check
  check (country is null or country in ('NG', 'GH', 'KE', 'ZA', 'UG', 'TZ', 'RW', 'ZM', 'CM', 'CI', 'SN'));
alter table public.webhook_inbox drop constraint if exists webhook_inbox_provider_check;
alter table public.webhook_inbox add constraint webhook_inbox_provider_check
  check (provider in ('paystack', 'flutterwave'));
alter table public.webhook_inbox drop constraint if exists webhook_inbox_provider_country_required;
alter table public.webhook_inbox add constraint webhook_inbox_provider_country_required
  check (provider <> 'paystack' or country is not null);
create unique index if not exists webhook_inbox_provider_event_idx
  on public.webhook_inbox (provider, coalesce(country, ''), event_id);
alter table public.webhook_inbox drop constraint if exists webhook_inbox_provider_country_event_id_key;

-- ---------------------------------------------------------------------------------------------
-- Orders and payments keep their provider (PS7).
-- ---------------------------------------------------------------------------------------------
alter table public.orders add column if not exists provider text;
alter table public.orders drop constraint if exists orders_provider_check;
alter table public.orders add constraint orders_provider_check
  check (provider is null or provider in ('paystack', 'flutterwave'));

-- Every paid order so far went through Paystack.
update public.orders o set provider = 'paystack'
 where o.provider is null
   and (o.reference is not null or exists (select 1 from public.payments p where p.order_id = o.id));

create or replace function public.payment_provider_fixed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.provider is not null and new.provider is distinct from old.provider then
    raise exception 'the payment provider of % % can''t change', tg_table_name, old.id
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.payment_provider_fixed() from public, anon, authenticated;

drop trigger if exists orders_provider_fixed on public.orders;
create trigger orders_provider_fixed
  before update of provider on public.orders
  for each row execute function public.payment_provider_fixed();

drop trigger if exists payments_provider_fixed on public.payments;
create trigger payments_provider_fixed
  before update of provider on public.payments
  for each row execute function public.payment_provider_fixed();

-- ---------------------------------------------------------------------------------------------
-- Payout subaccounts: one per (payout account, provider) (PS10-PS13).
-- ---------------------------------------------------------------------------------------------
create table if not exists public.payout_subaccounts (
  id                  uuid primary key default gen_random_uuid(),
  payout_account_id   uuid not null references public.payout_accounts(id) on delete cascade,
  provider            text not null check (provider in ('paystack', 'flutterwave')),
  subaccount_code     text check (subaccount_code is null or char_length(subaccount_code) between 1 and 100),
  provider_bank_code  text check (provider_bank_code is null or char_length(provider_bank_code) between 1 and 40),
  status              text not null default 'pending' check (status in ('pending', 'active', 'failed', 'needs_host')),
  attempts            integer not null default 0 check (attempts >= 0),
  last_error          text check (last_error is null or char_length(last_error) <= 500),
  next_attempt_at     timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  activated_at        timestamptz,
  unique (payout_account_id, provider),
  check (status <> 'active' or subaccount_code is not null)
);

create unique index if not exists payout_subaccounts_code_idx
  on public.payout_subaccounts (provider, subaccount_code) where subaccount_code is not null;
create index if not exists payout_subaccounts_due_idx
  on public.payout_subaccounts (next_attempt_at) where status = 'pending';
create index if not exists payout_subaccounts_problems_idx
  on public.payout_subaccounts (status) where status in ('failed', 'needs_host');

insert into public.payout_subaccounts
  (payout_account_id, provider, subaccount_code, provider_bank_code, status, attempts, last_error, created_at, updated_at, activated_at)
select pa.id, 'paystack', pa.subaccount_code, pa.bank_code,
       case when pa.subaccount_code is not null then 'active' when pa.last_error is not null then 'failed' else 'pending' end,
       case when pa.subaccount_code is not null then 1 else 0 end,
       pa.last_error, pa.created_at, now(), pa.activated_at
  from public.payout_accounts pa
 where pa.status <> 'replaced'
on conflict (payout_account_id, provider) do nothing;

alter table public.payout_subaccounts enable row level security;
revoke all on table public.payout_subaccounts from anon, authenticated;
grant select, insert, update on table public.payout_subaccounts to gventz_api;
drop policy if exists "api_all" on public.payout_subaccounts;
create policy "api_all" on public.payout_subaccounts for all to gventz_api using (true) with check (true);

-- ---------------------------------------------------------------------------------------------
-- Ledger: the provider's account is named after it; each entry may name its provider.
-- ---------------------------------------------------------------------------------------------
alter table public.ledger_entries add column if not exists provider text;
alter table public.ledger_entries drop constraint if exists ledger_entries_provider_check;
alter table public.ledger_entries add constraint ledger_entries_provider_check
  check (provider is null or provider in ('paystack', 'flutterwave'));
alter table public.ledger_entries drop constraint if exists ledger_entries_account_check;
alter table public.ledger_entries add constraint ledger_entries_account_check
  check (account in ('guest', 'host', 'gventz', 'paystack', 'flutterwave'));

-- ---------------------------------------------------------------------------------------------
-- Settings (PS1-PS4, PS9, PS14-PS15)
-- ---------------------------------------------------------------------------------------------
update public.platform_settings
   set value = value || '{"flutterwave":{"enabled":false}}'::jsonb
 where key = 'payments' and not (value ? 'flutterwave');

insert into public.platform_settings (key, value)
select 'active_provider',
       case when coalesce((select (value -> 'paystack' ->> 'enabled')::boolean from public.platform_settings where key = 'payments'), false)
            then '"paystack"'::jsonb else 'null'::jsonb end
on conflict (key) do nothing;

insert into public.platform_settings (key, value) values
  ('flutterwave_countries',
   '{"NG":{"enabled":false},"GH":{"enabled":false},"KE":{"enabled":false},"ZA":{"enabled":false},
     "UG":{"enabled":false},"TZ":{"enabled":false},"RW":{"enabled":false},"ZM":{"enabled":false},
     "CM":{"enabled":false},"CI":{"enabled":false},"SN":{"enabled":false}}'::jsonb),
  -- Paystack: today's built-in rates (confirmed). Flutterwave: published local rates, unconfirmed
  -- until staff check them in test mode and save them (PS15). Minor units of each country's currency.
  ('provider_charges',
   '{"paystack":{
       "NG":{"percentBps":150,"fixedMinor":10000,"waiveFixedBelow":250000,"capMinor":200000,"confirmed":true},
       "GH":{"percentBps":195,"fixedMinor":0,"waiveFixedBelow":0,"capMinor":null,"confirmed":true},
       "KE":{"percentBps":290,"fixedMinor":0,"waiveFixedBelow":0,"capMinor":null,"confirmed":true},
       "ZA":{"percentBps":290,"fixedMinor":100,"waiveFixedBelow":0,"capMinor":null,"confirmed":true}},
     "flutterwave":{
       "NG":{"percentBps":200,"fixedMinor":0,"waiveFixedBelow":0,"capMinor":200000,"confirmed":false},
       "GH":{"percentBps":195,"fixedMinor":0,"waiveFixedBelow":0,"capMinor":null,"confirmed":false},
       "KE":{"percentBps":290,"fixedMinor":0,"waiveFixedBelow":0,"capMinor":null,"confirmed":false},
       "ZA":{"percentBps":290,"fixedMinor":0,"waiveFixedBelow":0,"capMinor":null,"confirmed":false},
       "UG":{"percentBps":350,"fixedMinor":0,"waiveFixedBelow":0,"capMinor":null,"confirmed":false},
       "TZ":{"percentBps":350,"fixedMinor":0,"waiveFixedBelow":0,"capMinor":null,"confirmed":false},
       "RW":{"percentBps":350,"fixedMinor":0,"waiveFixedBelow":0,"capMinor":null,"confirmed":false},
       "ZM":{"percentBps":350,"fixedMinor":0,"waiveFixedBelow":0,"capMinor":null,"confirmed":false},
       "CM":{"percentBps":350,"fixedMinor":0,"waiveFixedBelow":0,"capMinor":null,"confirmed":false},
       "CI":{"percentBps":350,"fixedMinor":0,"waiveFixedBelow":0,"capMinor":null,"confirmed":false},
       "SN":{"percentBps":350,"fixedMinor":0,"waiveFixedBelow":0,"capMinor":null,"confirmed":false}}}'::jsonb)
on conflict (key) do nothing;
