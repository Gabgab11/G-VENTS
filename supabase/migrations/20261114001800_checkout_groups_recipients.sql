-- Checkout: group tickets, ticket-type descriptions, tickets for other people, buyer phone and
-- gender (Change 4, chunk 3d; D89, D90).
--
-- Group tickets (D90): a ticket type can admit N people per purchase (group_size 2-20; 1 is an
-- ordinary ticket). One purchase creates N registrations rows (entries), each with its own code,
-- all in one order. Capacity (events.active_count), ticket_tiers.quantity and ticket_tiers.sold keep
-- counting entries, so the existing trigger (registrations_active_count_stmt) and the legacy
-- functions (reserve_ticket, register_guest, promote_next_waitlisted), which all count one per
-- registrations row, stay right. The per-person limit (events.per_buyer_limit) counts a group
-- purchase as one; gventz-api does that count. group_size can't change once any are sold (a
-- trigger, so a group's entries always agree with its type).
--
-- An order holds up to 10 purchases; with groups of up to 20 that is up to 200 entries, so
-- orders.ticket_count and registrations.ticket_number widen from 10 to 200.
--
-- Tickets for other people (D89): registrations.recipient_email is the address a ticket was sent
-- to, when the buyer gave one for that ticket. The recipient's name reuses guest_name. The ticket
-- still belongs to the buyer (user_id, attendee_email stay the buyer's), so a mistyped address
-- loses nothing.
--
-- Phone and gender (4b): saved with each order (orders.buyer_phone, orders.buyer_gender) and
-- remembered on the profile (profiles.phone, profiles.gender) to prefill the next checkout. Phones
-- are E.164. Only gventz-api reads these (the Data API is closed, 20261113000100).
--
-- Additive: new nullable or defaulted columns, two widened checks, one trigger.

set local lock_timeout = '5s';

-- Ticket types --------------------------------------------------------------------------------

alter table public.ticket_tiers
  add column if not exists group_size smallint not null default 1,
  add column if not exists description text;

alter table public.ticket_tiers
  drop constraint if exists ticket_tiers_group_size_check,
  add constraint ticket_tiers_group_size_check check (group_size between 1 and 20),
  drop constraint if exists ticket_tiers_description_check,
  add constraint ticket_tiers_description_check check (description is null or char_length(description) <= 300);

comment on column public.ticket_tiers.group_size is
  'People admitted per purchase (D90): 1 = an ordinary ticket, 2-20 = a group. A purchase creates group_size entries. Fixed once any are sold.';
comment on column public.ticket_tiers.description is 'Optional text shown under the ticket type, up to 300 characters.';
comment on column public.ticket_tiers.quantity is 'Entries for sale (a group purchase uses group_size of them); null = unlimited.';
comment on column public.ticket_tiers.sold is 'Confirmed + pending entries of this type.';

create or replace function public.ticket_tiers_group_size_locked()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.group_size is distinct from old.group_size and old.sold > 0 then
    raise exception 'The group size can''t change once tickets are sold.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists ticket_tiers_group_size_locked on public.ticket_tiers;
create trigger ticket_tiers_group_size_locked
  before update of group_size on public.ticket_tiers
  for each row execute function public.ticket_tiers_group_size_locked();

-- Orders and tickets ----------------------------------------------------------------------------

alter table public.orders
  drop constraint if exists orders_ticket_count_check,
  add constraint orders_ticket_count_check check (ticket_count between 1 and 200);

alter table public.registrations
  drop constraint if exists registrations_ticket_number_check,
  add constraint registrations_ticket_number_check check (ticket_number is null or ticket_number between 1 and 200);

alter table public.registrations
  add column if not exists recipient_email text;

alter table public.registrations
  drop constraint if exists registrations_recipient_email_check,
  add constraint registrations_recipient_email_check check (
    recipient_email is null or (
      char_length(recipient_email) between 3 and 254
      and recipient_email = lower(recipient_email)
      and recipient_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
  );

comment on column public.registrations.recipient_email is
  'Where this ticket was emailed when the buyer sent it to someone else (D89); lower-case. The name is guest_name. The ticket still belongs to the buyer.';

alter table public.orders
  add column if not exists buyer_phone text,
  add column if not exists buyer_gender text;

alter table public.orders
  drop constraint if exists orders_buyer_phone_check,
  add constraint orders_buyer_phone_check check (buyer_phone is null or buyer_phone ~ '^\+[1-9][0-9]{6,14}$'),
  drop constraint if exists orders_buyer_gender_check,
  add constraint orders_buyer_gender_check check (buyer_gender is null or buyer_gender in ('female', 'male', 'unspecified'));

comment on column public.orders.buyer_phone is 'The buyer''s phone at checkout, E.164 (+2348012345678).';
comment on column public.orders.buyer_gender is 'female | male | unspecified (prefer not to say); null = not asked.';

-- Profiles --------------------------------------------------------------------------------------

alter table public.profiles
  add column if not exists phone text,
  add column if not exists gender text;

alter table public.profiles
  drop constraint if exists profiles_phone_check,
  add constraint profiles_phone_check check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  drop constraint if exists profiles_gender_check,
  add constraint profiles_gender_check check (gender is null or gender in ('female', 'male', 'unspecified'));

comment on column public.profiles.phone is 'Last phone given at checkout, E.164; prefills the next checkout.';
comment on column public.profiles.gender is 'Last gender given at checkout: female | male | unspecified; null = never given.';
