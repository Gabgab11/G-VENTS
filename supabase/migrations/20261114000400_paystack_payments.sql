-- M5 Paystack (Change 2: D61-D64, FR-5, FR-8-FR-10, FR-15, FR-19, FR-20).
-- Design: aidlc-docs/construction/m5-paystack/functional-design/ (PR, HA, FE, CK, RF, DS, WL, LG rules).
--
-- Host approval and payout accounts, paid orders (hold, quote, reference), payments, refunds,
-- disputes, an append-only money ledger, the webhook inbox, daily reconciliation runs and
-- waiting-list offers for paid ticket types. Only the API role (gventz_api) reads and writes these;
-- row-level security is on with no policy for anon or authenticated. Money is integer minor units
-- plus an ISO 4217 currency, never a float.
--
-- Additive only (expand before contract): existing rows and the current API release keep working.

set lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------
-- Host applications (HA1-HA6). One active (submitted or approved) application per host.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.host_applications (
  id                     uuid primary key default gen_random_uuid(),
  host_id                uuid not null references public.profiles(id) on delete cascade,
  legal_name             text not null check (char_length(legal_name) between 2 and 200),
  phone                  text not null check (char_length(phone) between 5 and 40),
  payout_country         text not null check (payout_country in ('NG', 'GH', 'KE', 'ZA')),
  bank_code              text not null check (char_length(bank_code) between 1 and 40),
  bank_name              text check (bank_name is null or char_length(bank_name) <= 200),
  account_number         text not null check (account_number ~ '^[0-9A-Za-z]{4,34}$'),
  resolved_account_name  text check (resolved_account_name is null or char_length(resolved_account_name) <= 200),
  document_path          text not null check (char_length(document_path) <= 300),
  status                 text not null default 'submitted' check (status in ('submitted', 'approved', 'declined', 'revoked')),
  reason                 text check (reason is null or char_length(reason) <= 500),
  decided_by             uuid references public.profiles(id) on delete set null,
  decided_at             timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create unique index if not exists host_applications_one_active_idx
  on public.host_applications (host_id) where status in ('submitted', 'approved');
create index if not exists host_applications_status_idx on public.host_applications (status, created_at desc, id desc);

-- ---------------------------------------------------------------------------------------------
-- Payout accounts (HA3, HA4): replaced, never edited. One current (not replaced) per host.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.payout_accounts (
  id               uuid primary key default gen_random_uuid(),
  host_id          uuid not null references public.profiles(id) on delete cascade,
  application_id   uuid references public.host_applications(id) on delete set null,
  provider         text not null default 'paystack' check (provider in ('paystack')),
  country          text not null check (country in ('NG', 'GH', 'KE', 'ZA')),
  currency         text not null check (currency ~ '^[A-Z]{3}$'),
  subaccount_code  text,
  bank_code        text not null,
  bank_name        text,
  account_number   text not null check (account_number ~ '^[0-9A-Za-z]{4,34}$'),
  account_name     text,
  business_name    text not null,
  status           text not null default 'pending' check (status in ('pending', 'active', 'replaced')),
  last_error       text check (last_error is null or char_length(last_error) <= 500),
  created_at       timestamptz not null default now(),
  activated_at     timestamptz,
  replaced_at      timestamptz,
  check (status <> 'active' or subaccount_code is not null)
);

create unique index if not exists payout_accounts_one_current_idx
  on public.payout_accounts (host_id) where status <> 'replaced';
create unique index if not exists payout_accounts_subaccount_idx
  on public.payout_accounts (subaccount_code) where subaccount_code is not null;

-- ---------------------------------------------------------------------------------------------
-- Paid orders (CK1-CK9): reference, country, fixed quote, 10-minute hold, the non-refundable tick.
-- ---------------------------------------------------------------------------------------------
alter table public.orders add column if not exists reference text;
alter table public.orders add column if not exists country text;
alter table public.orders add column if not exists quote jsonb;
alter table public.orders add column if not exists hold_expires_at timestamptz;
alter table public.orders add column if not exists non_refundable_accepted_at timestamptz;

alter table public.orders drop constraint if exists orders_country_check;
alter table public.orders add constraint orders_country_check check (country is null or country in ('NG', 'GH', 'KE', 'ZA'));

create unique index if not exists orders_reference_idx on public.orders (reference) where reference is not null;
-- The hold-expiry job: paid orders still awaiting payment, by hold end.
create index if not exists orders_awaiting_payment_idx on public.orders (hold_expires_at) where status = 'awaiting_payment';

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in (
  'completed', 'pending_approval', 'waitlisted', 'declined', 'cancelled', 'awaiting_payment', 'expired',
  'failed', 'partially_refunded', 'refunded', 'disputed'));

-- The Paystack country of an event's paid ticket types (PR4); null for free events.
alter table public.events add column if not exists payment_country text;
alter table public.events drop constraint if exists events_payment_country_check;
alter table public.events add constraint events_payment_country_check
  check (payment_country is null or payment_country in ('NG', 'GH', 'KE', 'ZA'));

-- ---------------------------------------------------------------------------------------------
-- Payments (CK5-CK8). One per initialized checkout; at most one successful per order.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.payments (
  id                       uuid primary key default gen_random_uuid(),
  order_id                 uuid not null references public.orders(id) on delete cascade,
  provider                 text not null default 'paystack' check (provider in ('paystack')),
  country                  text not null check (country in ('NG', 'GH', 'KE', 'ZA')),
  reference                text not null unique,
  provider_transaction_id  text,
  amount_minor             integer not null check (amount_minor > 0),
  currency                 text not null check (currency ~ '^[A-Z]{3}$'),
  provider_charge_minor    integer check (provider_charge_minor is null or provider_charge_minor >= 0),
  authorization_url        text,
  access_code              text,
  status                   text not null default 'pending' check (status in ('pending', 'success', 'failed', 'late_refunded')),
  channel                  text,
  verified_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists payments_order_idx on public.payments (order_id);
create unique index if not exists payments_one_success_idx on public.payments (order_id) where status in ('success', 'late_refunded');

-- ---------------------------------------------------------------------------------------------
-- Refunds (RF1-RF7): per ticket(s), retried until refunded or failed.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.refunds (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders(id) on delete cascade,
  payment_id          uuid references public.payments(id) on delete set null,
  ticket_ids          uuid[] not null default '{}'::uuid[],
  amount_minor        integer not null check (amount_minor > 0),
  currency            text not null check (currency ~ '^[A-Z]{3}$'),
  host_debt_minor     integer not null default 0 check (host_debt_minor >= 0),
  reason              text not null check (reason in ('host', 'cancellation', 'late_payment')),
  status              text not null default 'queued' check (status in ('queued', 'processing', 'refunded', 'failed')),
  attempts            integer not null default 0,
  provider_refund_id  text,
  last_error          text check (last_error is null or char_length(last_error) <= 500),
  requested_by        uuid references public.profiles(id) on delete set null,
  next_attempt_at     timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists refunds_order_idx on public.refunds (order_id);
create index if not exists refunds_due_idx on public.refunds (next_attempt_at) where status in ('queued', 'processing');
create unique index if not exists refunds_provider_idx on public.refunds (provider_refund_id) where provider_refund_id is not null;

-- ---------------------------------------------------------------------------------------------
-- Disputes (DS1-DS3).
-- ---------------------------------------------------------------------------------------------
create table if not exists public.disputes (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.orders(id) on delete cascade,
  provider_dispute_id  text not null unique,
  amount_minor         integer not null check (amount_minor >= 0),
  currency             text not null check (currency ~ '^[A-Z]{3}$'),
  status               text not null default 'open' check (status in ('open', 'won', 'lost')),
  opened_at            timestamptz not null default now(),
  resolved_at          timestamptz
);

create index if not exists disputes_order_idx on public.disputes (order_id);

-- ---------------------------------------------------------------------------------------------
-- Ledger (LG1-LG2): append-only, signed integer minor units; each order's entries sum to zero.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.ledger_entries (
  id            bigint generated always as identity primary key,
  order_id      uuid references public.orders(id) on delete set null,
  host_id       uuid references public.profiles(id) on delete set null,
  refund_id     uuid references public.refunds(id) on delete set null,
  dispute_id    uuid references public.disputes(id) on delete set null,
  kind          text not null check (kind in (
                  'charge', 'gventz_fee', 'vat', 'provider_charge', 'host_share', 'refund',
                  'host_debt', 'debt_recovery', 'dispute_loss', 'dispute_reversal')),
  account       text not null check (account in ('guest', 'host', 'gventz', 'paystack')),
  amount_minor  bigint not null,
  currency      text not null check (currency ~ '^[A-Z]{3}$'),
  reference     text,
  created_at    timestamptz not null default now()
);

create index if not exists ledger_entries_order_idx on public.ledger_entries (order_id);
create index if not exists ledger_entries_host_idx on public.ledger_entries (host_id, currency) where host_id is not null;
create index if not exists ledger_entries_reference_idx on public.ledger_entries (reference) where reference is not null;

-- ---------------------------------------------------------------------------------------------
-- Webhook inbox (CK6): stored first, processed once per provider event id.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.webhook_inbox (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null check (provider in ('paystack')),
  country       text not null check (country in ('NG', 'GH', 'KE', 'ZA')),
  event_id      text not null,
  type          text not null,
  payload       jsonb not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  attempts      integer not null default 0,
  outcome       text check (outcome is null or char_length(outcome) <= 500),
  unique (provider, country, event_id)
);

create index if not exists webhook_inbox_unprocessed_idx on public.webhook_inbox (received_at) where processed_at is null;

-- ---------------------------------------------------------------------------------------------
-- Daily reconciliation (LG3).
-- ---------------------------------------------------------------------------------------------
create table if not exists public.reconciliation_runs (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null check (provider in ('paystack')),
  country      text not null check (country in ('NG', 'GH', 'KE', 'ZA')),
  day          date not null,
  matched      integer not null default 0,
  differences  jsonb not null default '[]'::jsonb,
  status       text not null check (status in ('ok', 'differences', 'failed')),
  created_at   timestamptz not null default now(),
  unique (provider, country, day)
);

-- ---------------------------------------------------------------------------------------------
-- Waiting-list offers for paid ticket types (WL1-WL2): 24-hour hold, one open offer per order.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.waitlist_offers (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  event_id    uuid not null references public.events(id) on delete cascade,
  offered_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  status      text not null default 'open' check (status in ('open', 'used', 'expired')),
  check (expires_at > offered_at)
);

create unique index if not exists waitlist_offers_open_idx on public.waitlist_offers (order_id) where status = 'open';
create index if not exists waitlist_offers_due_idx on public.waitlist_offers (expires_at) where status = 'open';

-- ---------------------------------------------------------------------------------------------
-- Row-level security and grants: the API role only.
-- ---------------------------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'host_applications', 'payout_accounts', 'payments', 'refunds', 'disputes',
    'webhook_inbox', 'reconciliation_runs', 'waitlist_offers', 'ledger_entries'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;

  foreach t in array array[
    'host_applications', 'payout_accounts', 'payments', 'refunds', 'disputes',
    'webhook_inbox', 'reconciliation_runs', 'waitlist_offers'
  ] loop
    execute format('grant select, insert, update on table public.%I to gventz_api', t);
    execute format('drop policy if exists "api_all" on public.%I', t);
    execute format('create policy "api_all" on public.%I for all to gventz_api using (true) with check (true)', t);
  end loop;
end
$$;

-- The ledger is append-only for the API role (LG1, SECURITY-13).
grant select, insert on table public.ledger_entries to gventz_api;
grant usage, select on sequence public.ledger_entries_id_seq to gventz_api;
drop policy if exists "api_read" on public.ledger_entries;
create policy "api_read" on public.ledger_entries for select to gventz_api using (true);
drop policy if exists "api_insert" on public.ledger_entries;
create policy "api_insert" on public.ledger_entries for insert to gventz_api with check (true);

-- ---------------------------------------------------------------------------------------------
-- Settings: Paystack per country (PR2, all off) and VAT per currency on the G-ventZ fee (FE2).
-- ---------------------------------------------------------------------------------------------
insert into public.platform_settings (key, value) values
  ('paystack_countries', '{"NG":{"enabled":false},"GH":{"enabled":false},"KE":{"enabled":false},"ZA":{"enabled":false}}'::jsonb),
  ('vat', '{"NGN":{"rateBps":750}}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Private bucket for host identity and business documents (HA1, HA6): staff read them through
-- 5-minute signed links from the API; no public access and no storage policies for users.
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('host-documents', 'host-documents', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
