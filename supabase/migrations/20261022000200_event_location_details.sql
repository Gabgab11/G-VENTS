-- ============================================================
-- Event location details from the new location fields.
--
-- The form now asks for Country, then State/Region, then the venue
-- (searched with Google Places or typed by hand). Existing columns keep
-- their meaning, so every current page keeps working:
--   country     country name, as before ("Nigeria")
--   city        town from the Google result, or the region when typed by hand
--   venue_name  the venue name, or whatever the host typed
--   address     full address from Google (already existed, now filled in)
--   lat, lng    coordinates from Google (already existed, now filled in)
-- New, all optional, so existing rows are untouched:
--   region        state / region / province ("Lagos", "FCT Abuja")
--   country_code  ISO 3166-1 alpha-2 ("NG")
--   place_id      Google Place ID of the chosen venue
-- ============================================================

alter table public.events add column if not exists region       text;
alter table public.events add column if not exists country_code text;
alter table public.events add column if not exists place_id     text;

alter table public.events drop constraint if exists events_country_code_check;
alter table public.events add constraint events_country_code_check
  check (country_code is null or country_code ~ '^[A-Z]{2}$');

alter table public.events drop constraint if exists events_lat_lng_check;
alter table public.events add constraint events_lat_lng_check
  check ((lat is null or lat between -90 and 90) and (lng is null or lng between -180 and 180))
  not valid;

-- Same function as in 20261014000200_security_hardening, now also saving
-- address, region, country_code, lat, lng and place_id. Keys the app does
-- not send stay null, so older callers keep working.
create or replace function public.create_event_with_tiers(p_event jsonb, p_tiers jsonb)
returns public.events
language plpgsql
security invoker
set search_path = public
as $$
declare
  e public.events;
begin
  if auth.uid() is null then
    raise exception 'Sign in to create an event';
  end if;
  if jsonb_typeof(p_tiers) <> 'array' or jsonb_array_length(p_tiers) = 0 then
    raise exception 'Add at least one ticket';
  end if;

  insert into public.events (
    owner_id, title, slug, category, description, starts_at, ends_at, timezone,
    venue_name, address, city, region, country, country_code, lat, lng, place_id,
    refund_policy, visibility, show_attendee_count,
    require_approval, cover_theme, status
  ) values (
    auth.uid(),
    p_event ->> 'title',
    p_event ->> 'slug',
    p_event ->> 'category',
    nullif(p_event ->> 'description', ''),
    (p_event ->> 'starts_at')::timestamptz,
    nullif(p_event ->> 'ends_at', '')::timestamptz,
    coalesce(p_event ->> 'timezone', 'Africa/Lagos'),
    nullif(p_event ->> 'venue_name', ''),
    nullif(p_event ->> 'address', ''),
    nullif(p_event ->> 'city', ''),
    nullif(p_event ->> 'region', ''),
    nullif(p_event ->> 'country', ''),
    nullif(p_event ->> 'country_code', ''),
    (p_event ->> 'lat')::double precision,
    (p_event ->> 'lng')::double precision,
    nullif(p_event ->> 'place_id', ''),
    nullif(p_event ->> 'refund_policy', ''),
    coalesce(p_event ->> 'visibility', 'public'),
    coalesce((p_event ->> 'show_attendee_count')::boolean, true),
    coalesce((p_event ->> 'require_approval')::boolean, false),
    coalesce(p_event ->> 'cover_theme', 'minimal'),
    coalesce(p_event ->> 'status', 'draft')
  )
  returning * into e;

  insert into public.ticket_tiers (event_id, name, price_minor, currency, quantity)
  select e.id,
         t ->> 'name',
         coalesce((t ->> 'price_minor')::integer, 0),
         'NGN',
         nullif(t ->> 'quantity', '')::integer
  from jsonb_array_elements(p_tiers) as t;

  return e;
end;
$$;

revoke execute on function public.create_event_with_tiers(jsonb, jsonb) from public, anon;
grant  execute on function public.create_event_with_tiers(jsonb, jsonb) to authenticated;
