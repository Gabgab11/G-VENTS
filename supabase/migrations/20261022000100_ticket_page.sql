-- ============================================================
-- Ticket page: /t/<ticket_code>
--
-- Every registration already has a random, unguessable ticket_code
-- (24 hex characters, 96 bits). Knowing the code is the guest's access
-- to their ticket, the same way a link to a boarding pass works, so the
-- page needs no sign-in.
--
-- get_ticket returns only what the ticket shows. It never returns the
-- guest's email, answers or payment details. can_check_in is true only
-- for the event's own staff, so a host who scans the QR code sees a
-- "Check in" button and nobody else does.
-- ============================================================

create or replace function public.get_ticket(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id',            r.id,
    'code',          r.ticket_code,
    'name',          r.attendee_name,
    'status',        r.status,
    'checked_in_at', r.checked_in_at,
    'created_at',    r.created_at,
    'tier', jsonb_build_object(
      'name',        t.name,
      'price_minor', t.price_minor,
      'currency',    t.currency
    ),
    'event', jsonb_build_object(
      'title',         e.title,
      'slug',          e.slug,
      'starts_at',     e.starts_at,
      'ends_at',       e.ends_at,
      'timezone',      e.timezone,
      'is_online',     e.is_online,
      'venue_name',    e.venue_name,
      'address',       e.address,
      'city',          e.city,
      'country',       e.country,
      'status',        e.status,
      'refund_policy', e.refund_policy
    ),
    'can_check_in', public.has_event_role(e.id, array['owner','admin','editor','checkin'])
  )
  from public.registrations r
  join public.events e       on e.id = r.event_id
  join public.ticket_tiers t on t.id = r.tier_id
  where p_code ~ '^[0-9a-f]{24}$'
    and r.ticket_code = p_code;
$$;

revoke execute on function public.get_ticket(text) from public;
grant  execute on function public.get_ticket(text) to anon, authenticated;
