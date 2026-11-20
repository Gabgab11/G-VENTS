-- Discount codes (Change 4, FR-33.1, services S4) and the `discount` ledger kind.
--
-- A host (owner or admin) creates codes per event: percent off (basis points 1-10000), a fixed
-- amount off each ticket (integer minor units of the event's currency) or free; an optional usage
-- limit, start and end, the paid ticket types it applies to (empty = every paid type), and a pause
-- switch. Codes are stored upper-case, 3-32 characters of A-Z 0-9 - _, unique per event, so
-- `summer-25` and `SUMMER-25` are the same code.
--
-- gventz-api checks a code when it prices an order, and again inside the order transaction: it
-- locks the code row (select ... for update), re-checks the uses, writes one redemption with the
-- order and adds one use. The check `uses <= max_uses` makes the limit hold even if that ever went
-- wrong. A hold that expires unpaid gives its use back (the redemption row is deleted). The money
-- itself goes in the ledger when the payment is confirmed, as two `discount` lines that sum to zero.
--
-- Only gventz-api reads and writes these tables: row-level security on, a policy for gventz_api
-- only. Additive: two new tables, and the ledger kind check widened (existing rows already pass it).

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------
-- Codes.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.discount_codes (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events(id) on delete cascade,
  code             text not null check (code ~ '^[A-Z0-9_-]{3,32}$'),
  kind             text not null check (kind in ('percent', 'fixed', 'free')),
  value            bigint not null,
  max_uses         integer check (max_uses is null or max_uses >= 1),
  uses             integer not null default 0 check (uses >= 0),
  starts_at        timestamptz,
  ends_at          timestamptz,
  ticket_type_ids  uuid[] not null default '{}'::uuid[],
  paused           boolean not null default false,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (event_id, code),
  constraint discount_codes_value_check check (
       (kind = 'percent' and value between 1 and 10000)
    or (kind = 'fixed' and value between 1 and 100000000000)
    or (kind = 'free' and value = 0)),
  constraint discount_codes_uses_limit_check check (max_uses is null or uses <= max_uses),
  constraint discount_codes_window_check check (starts_at is null or ends_at is null or ends_at > starts_at),
  constraint discount_codes_ticket_types_check check (cardinality(ticket_type_ids) <= 50)
);

comment on table public.discount_codes is
  'Discount codes per event (FR-33.1). Written through gventz-api only; kind and value are locked once used.';
comment on column public.discount_codes.code is 'Upper-case, 3-32 of A-Z 0-9 - _; unique per event (case-insensitive by storing upper-case).';
comment on column public.discount_codes.value is 'percent: basis points 1-10000; fixed: minor units off each ticket, in the event currency; free: 0.';
comment on column public.discount_codes.max_uses is 'Orders that may use the code; null = unlimited.';
comment on column public.discount_codes.uses is 'Orders holding or having paid with the code; never above max_uses.';
comment on column public.discount_codes.ticket_type_ids is 'Paid ticket types it applies to; empty = every paid type of the event.';

-- ---------------------------------------------------------------------------------------------
-- Redemptions: one per order, written in the order transaction.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.discount_redemptions (
  id            uuid primary key default gen_random_uuid(),
  code_id       uuid not null references public.discount_codes(id) on delete cascade,
  order_id      uuid not null unique references public.orders(id) on delete cascade,
  amount_minor  bigint not null check (amount_minor > 0),
  created_at    timestamptz not null default now()
);

create index if not exists discount_redemptions_code_idx on public.discount_redemptions (code_id);

comment on table public.discount_redemptions is
  'One row per order that used a discount code: the discount in minor units of the order currency. Deleted when the hold expires unpaid.';

-- ---------------------------------------------------------------------------------------------
-- Ledger: the `discount` kind (host gives it, guest receives it; the two lines sum to zero).
-- ---------------------------------------------------------------------------------------------
alter table public.ledger_entries drop constraint if exists ledger_entries_kind_check;
alter table public.ledger_entries add constraint ledger_entries_kind_check check (kind in (
  'charge', 'gventz_fee', 'vat', 'provider_charge', 'host_share', 'refund',
  'host_debt', 'debt_recovery', 'dispute_loss', 'dispute_reversal', 'discount')) not valid;
alter table public.ledger_entries validate constraint ledger_entries_kind_check;

-- ---------------------------------------------------------------------------------------------
-- Row-level security and grants: the API role only.
-- ---------------------------------------------------------------------------------------------
alter table public.discount_codes enable row level security;
alter table public.discount_redemptions enable row level security;
revoke all on table public.discount_codes from anon, authenticated;
revoke all on table public.discount_redemptions from anon, authenticated;

grant select, insert, update on table public.discount_codes to gventz_api;
grant select, insert, delete on table public.discount_redemptions to gventz_api;
drop policy if exists "api_all" on public.discount_codes;
create policy "api_all" on public.discount_codes for all to gventz_api using (true) with check (true);
drop policy if exists "api_all" on public.discount_redemptions;
create policy "api_all" on public.discount_redemptions for all to gventz_api using (true) with check (true);
