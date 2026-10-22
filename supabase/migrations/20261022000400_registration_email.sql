-- ============================================================
-- Ticket emails go to the guest's verified account email (review finding M1).
-- register_guest used to store whatever address was typed into the form, and
-- the ticket email (and the waiting-list promotion email) went there, which
-- let anyone use G-ventZ's sending domain to mail arbitrary addresses.
-- The signature is unchanged so the app keeps working during deploys;
-- p_email is now ignored.
-- ============================================================
create or replace function public.register_guest(
  p_event   uuid,
  p_tier    uuid,
  p_name    text,
  p_email   text,
  p_answers jsonb default '{}'::jsonb
)
returns public.registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  e        public.events;
  t        public.ticket_tiers;
  q        record;
  v_value  text;
  v_clean  jsonb := '{}'::jsonb;
  v_taken  integer;
  v_status text;
  r        public.registrations;
  v_email  text;
begin
  if v_user is null then
    raise exception 'Sign in to register';
  end if;
  if p_name is null or char_length(trim(p_name)) not between 2 and 120 then
    raise exception 'Enter your full name';
  end if;
  select u.email into v_email from auth.users u where u.id = v_user;
  if v_email is null or v_email = '' then
    raise exception 'Your account has no email address';
  end if;

  select * into e from public.events where id = p_event for update;
  if not found or e.status <> 'published' then
    raise exception 'This event is not open for registration';
  end if;
  if not e.registration_open then
    raise exception 'Registration for this event is closed';
  end if;

  if exists (select 1 from public.registrations
             where event_id = e.id and user_id = v_user and status not in ('cancelled','refunded')) then
    raise exception 'You are already registered for this event';
  end if;

  select * into t from public.ticket_tiers where id = p_tier and event_id = e.id for update;
  if not found or not t.is_active then
    raise exception 'Choose a ticket';
  end if;
  if t.price_minor > 0 then
    raise exception 'Paid tickets are not available yet';
  end if;
  if t.sales_start is not null and now() < t.sales_start then
    raise exception 'Ticket sales have not started yet';
  end if;
  if t.sales_end is not null and now() > t.sales_end then
    raise exception 'Ticket sales have ended';
  end if;

  -- Answers: keyed by question id. Labels come from the database, unknown keys are ignored.
  for q in
    select id, label, kind, options, required
    from public.event_questions where event_id = e.id order by position
  loop
    v_value := left(trim(coalesce(p_answers ->> q.id::text, '')), 1000);
    if q.kind = 'terms' then
      v_value := case when v_value <> '' then 'Accepted' else '' end;
    end if;
    if q.kind = 'options' and v_value <> '' and not (v_value = any (q.options)) then
      raise exception 'Choose one of the options for: %', q.label;
    end if;
    if q.required and v_value = '' then
      raise exception 'Please answer: %', q.label;
    end if;
    if v_value <> '' then
      v_clean := v_clean || jsonb_build_object(q.id::text, jsonb_build_object('label', q.label, 'value', v_value));
    end if;
  end loop;

  -- Event capacity overflows to the waiting list; a sold-out tier does not.
  select count(*) into v_taken from public.registrations
  where event_id = e.id and status in ('confirmed','pending');

  if e.capacity is not null and v_taken >= e.capacity then
    v_status := 'waitlisted';
  else
    if t.quantity is not null and t.sold >= t.quantity then
      raise exception 'Sold out';
    end if;
    v_status := case when e.require_approval then 'pending' else 'confirmed' end;
    update public.ticket_tiers set sold = sold + 1 where id = t.id;
  end if;

  insert into public.registrations
    (event_id, tier_id, user_id, attendee_name, attendee_email, status, amount_minor, answers)
  values
    (e.id, t.id, v_user, trim(p_name), lower(trim(v_email)), v_status, 0, v_clean)
  returning * into r;

  return r;
end;
$$;
