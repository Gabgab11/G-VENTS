-- Tickets belong to orders (Change 1 / U4 Ticketing, domain-entities `Ticket`).
--
-- Additive, so the current app keeps working until go-live (AD17):
--   order_id       null for tickets the current app creates
--   ticket_number  1..n within the order; null for those tickets
--   guest_name     optional name printed on ticket 2..n (Q2)
--   'declined'     a host turned down an approval request (I4); the current
--                  app's screens filter by the statuses they know
--
-- `registrations_one_active_per_user` is dropped: one buyer can now hold up to
-- the event's per-buyer limit. The current app's register_guest still refuses
-- a second registration itself, under the event row lock.

set lock_timeout = '5s';

alter table public.registrations
  add column if not exists order_id uuid references public.orders(id) on delete cascade;
alter table public.registrations
  add column if not exists ticket_number integer;
alter table public.registrations
  add column if not exists guest_name text;

alter table public.registrations drop constraint if exists registrations_ticket_number_check;
alter table public.registrations add constraint registrations_ticket_number_check
  check (ticket_number is null or ticket_number between 1 and 10);

alter table public.registrations drop constraint if exists registrations_guest_name_check;
alter table public.registrations add constraint registrations_guest_name_check
  check (guest_name is null or char_length(guest_name) between 2 and 120);

alter table public.registrations drop constraint if exists registrations_status_check;
alter table public.registrations add constraint registrations_status_check
  check (status in ('pending', 'confirmed', 'waitlisted', 'declined', 'cancelled', 'refunded'));

-- Tickets of an order, numbered once each.
create unique index if not exists reg_order_number_idx
  on public.registrations (order_id, ticket_number) where order_id is not null;
-- Per-buyer allowance under the event lock.
create index if not exists reg_event_user_status_idx
  on public.registrations (event_id, user_id, status);
-- Guest list default sort (newest first) and CSV keyset paging.
create index if not exists reg_event_created_idx
  on public.registrations (event_id, created_at desc, id desc);

drop index if exists public.registrations_one_active_per_user;
