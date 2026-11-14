-- Payment integrity after the security review of M5 (B1, B2 and follow-ups). Tightens only:
-- payment records can no longer be deleted with their event or host, the ledger can't be rewritten,
-- refunds can't add up to more than was paid, and webhook payloads drop card and customer details.
-- Expand-safe: nothing the API reads is removed.

-- ---------------------------------------------------------------------------------------------
-- B1. Payment records outlive their order, event and host.
-- ---------------------------------------------------------------------------------------------
alter table public.payments drop constraint if exists payments_order_id_fkey;
alter table public.payments add constraint payments_order_id_fkey
  foreign key (order_id) references public.orders(id) on delete restrict;
alter table public.refunds drop constraint if exists refunds_order_id_fkey;
alter table public.refunds add constraint refunds_order_id_fkey
  foreign key (order_id) references public.orders(id) on delete restrict;
alter table public.disputes drop constraint if exists disputes_order_id_fkey;
alter table public.disputes add constraint disputes_order_id_fkey
  foreign key (order_id) references public.orders(id) on delete restrict;

alter table public.host_applications drop constraint if exists host_applications_host_id_fkey;
alter table public.host_applications add constraint host_applications_host_id_fkey
  foreign key (host_id) references public.profiles(id) on delete restrict;
alter table public.payout_accounts drop constraint if exists payout_accounts_host_id_fkey;
alter table public.payout_accounts add constraint payout_accounts_host_id_fkey
  foreign key (host_id) references public.profiles(id) on delete restrict;

-- The ledger keeps plain ids: no foreign key may ever rewrite (set null) a ledger row.
alter table public.ledger_entries drop constraint if exists ledger_entries_order_id_fkey;
alter table public.ledger_entries drop constraint if exists ledger_entries_host_id_fkey;
alter table public.ledger_entries drop constraint if exists ledger_entries_refund_id_fkey;
alter table public.ledger_entries drop constraint if exists ledger_entries_dispute_id_fkey;

create or replace function public.ledger_entries_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'ledger entries are append-only' using errcode = '42501';
end;
$$;
revoke execute on function public.ledger_entries_append_only() from public, anon, authenticated;

drop trigger if exists ledger_entries_append_only on public.ledger_entries;
create trigger ledger_entries_append_only
  before update or delete on public.ledger_entries
  for each row execute function public.ledger_entries_append_only();

-- ---------------------------------------------------------------------------------------------
-- Money columns: bigint, like the ledger (integer caps an order near NGN 21m).
-- ---------------------------------------------------------------------------------------------
alter table public.payments alter column amount_minor type bigint;
alter table public.payments alter column provider_charge_minor type bigint;
alter table public.refunds alter column amount_minor type bigint;
alter table public.refunds alter column host_debt_minor type bigint;
alter table public.disputes alter column amount_minor type bigint;

-- ---------------------------------------------------------------------------------------------
-- B2. Refunds that haven't failed never add up to more than the successful payment.
-- ---------------------------------------------------------------------------------------------
create or replace function public.refunds_within_payment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  paid bigint;
  refunded bigint;
begin
  if new.status = 'failed' then
    return new;
  end if;
  -- One order at a time, so two refunds of the same order can't both pass the check.
  perform pg_advisory_xact_lock(hashtextextended('refunds:' || new.order_id::text, 0));
  select p.amount_minor into paid from public.payments p
    where p.order_id = new.order_id and p.status in ('success', 'late_refunded');
  if paid is null then
    raise exception 'refund for order % has no successful payment', new.order_id using errcode = '23514';
  end if;
  select coalesce(sum(r.amount_minor), 0) into refunded from public.refunds r
    where r.order_id = new.order_id and r.status <> 'failed' and r.id <> new.id;
  if refunded + new.amount_minor > paid then
    raise exception 'refunds for order % would exceed the payment', new.order_id using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.refunds_within_payment() from public, anon, authenticated;

drop trigger if exists refunds_within_payment on public.refunds;
create trigger refunds_within_payment
  before insert or update of amount_minor, status on public.refunds
  for each row execute function public.refunds_within_payment();

-- ---------------------------------------------------------------------------------------------
-- Webhook inbox: a lease so one worker processes an item at a time, the transaction reference as
-- its own indexed column, and no card authorization or customer details kept.
-- ---------------------------------------------------------------------------------------------
alter table public.webhook_inbox add column if not exists reference text;
alter table public.webhook_inbox add column if not exists locked_until timestamptz;
alter table public.webhook_inbox drop constraint if exists webhook_inbox_reference_check;
alter table public.webhook_inbox add constraint webhook_inbox_reference_check
  check (reference is null or char_length(reference) <= 200);

update public.webhook_inbox
  set reference = coalesce(
        nullif(payload -> 'data' ->> 'reference', ''),
        nullif(payload -> 'data' ->> 'transaction_reference', ''),
        nullif(payload -> 'data' -> 'transaction' ->> 'reference', '')),
      payload = payload #- '{data,authorization}' #- '{data,customer}'
  where reference is null or payload -> 'data' ? 'authorization' or payload -> 'data' ? 'customer';

create index if not exists webhook_inbox_reference_idx on public.webhook_inbox (reference) where reference is not null;
