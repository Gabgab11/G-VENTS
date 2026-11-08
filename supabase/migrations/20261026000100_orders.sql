-- Orders for gventz-api (Change 1 / U4 Ticketing, domain-entities `Order`).
--
-- One purchase by one buyer for one event. Each ticket the API creates is a
-- `registrations` row pointing at its order (next migration). Free orders only
-- until U7; `awaiting_payment` and `expired` are reserved for paid checkout.
--
-- Only the API role can reach this table: RLS is on with no policy for
-- `anon` or `authenticated`. The current app doesn't read it.

set lock_timeout = '5s';

create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  buyer_id       uuid references public.profiles(id) on delete set null,
  kind           text not null default 'free' check (kind in ('free', 'paid')),
  status         text not null check (status in (
                   'completed', 'pending_approval', 'waitlisted', 'declined',
                   'cancelled', 'awaiting_payment', 'expired')),
  ticket_count   integer not null check (ticket_count between 1 and 10),
  answers        jsonb not null default '{}'::jsonb,
  currency       text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor   integer not null default 0 check (amount_minor >= 0),
  decided_at     timestamptz,
  decided_by     uuid references public.profiles(id) on delete set null,
  decision_note  text check (decision_note is null or char_length(decision_note) <= 500),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- My tickets: a buyer's orders, newest first (keyset on created_at, id).
create index if not exists orders_buyer_idx on public.orders (buyer_id, created_at desc, id desc);
-- Waiting list: oldest waitlisted order first, per event.
create index if not exists orders_event_status_idx on public.orders (event_id, status, created_at);

alter table public.orders enable row level security;

-- Supabase's default privileges give new public tables to anon and authenticated; take them back.
revoke all on table public.orders from anon, authenticated;

grant select, insert, update, delete on table public.orders to gventz_api;

drop policy if exists "api_all" on public.orders;
create policy "api_all" on public.orders for all to gventz_api using (true) with check (true);
