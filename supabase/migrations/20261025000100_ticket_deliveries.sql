-- ============================================================
-- Delivery log for tickets sent by email (and later WhatsApp).
--
-- One row per attempt. Only the server writes here, using the service-role key,
-- so row-level security is on with no policies: anon and signed-in users can't
-- read or change it. Guests see the latest status through the ticket page.
-- ============================================================

create table if not exists public.ticket_deliveries (
  id          uuid primary key default gen_random_uuid(),
  ticket_code text not null,
  channel     text not null check (channel in ('email', 'whatsapp')),
  destination text not null,
  status      text not null check (status in ('sent', 'failed')),
  error       text,
  created_at  timestamptz not null default now()
);

create index if not exists ticket_deliveries_code_idx
  on public.ticket_deliveries (ticket_code, created_at desc);

alter table public.ticket_deliveries enable row level security;
revoke all on public.ticket_deliveries from anon, authenticated;
