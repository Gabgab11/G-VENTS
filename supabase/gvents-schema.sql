-- ============================================================
-- G-vents database schema (Supabase / Postgres)
-- Matches the live state of gvents-staging and gvents-prod.
-- Change this file first, test on gvents-staging, then apply to gvents-prod.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Users ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text unique,
  country     text,
  created_at  timestamptz not null default now()
);

-- ---------- Events ----------
create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete restrict,
  title        text not null check (char_length(title) between 3 and 140),
  slug         text not null unique check (slug ~ '^[a-z0-9-]+$'),
  description  text,
  category     text not null check (category in (
                 'Music','Conferences','Tech','Faith','Arts','Food','Sports','Business',
                 'Nightlife','Education','Community','Charity','Family','Other')),
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  timezone     text not null default 'Africa/Lagos',
  is_online    boolean not null default false,
  venue_name   text,
  address      text,
  city         text,
  country      text,
  lat          double precision,
  lng          double precision,
  cover_url    text,
  capacity     integer check (capacity is null or capacity > 0),
  refund_policy text,
  status       text not null default 'draft' check (status in ('draft','published','cancelled')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists events_status_starts_idx on public.events (status, starts_at);
create index if not exists events_city_idx on public.events (country, city);
create index if not exists events_owner_idx on public.events (owner_id);

-- ---------- Ticket tiers ----------
create table if not exists public.ticket_tiers (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  name         text not null,
  price_minor  integer not null default 0 check (price_minor >= 0),  -- smallest unit (kobo, cents)
  currency     text not null default 'NGN',
  quantity     integer check (quantity is null or quantity > 0),     -- null = unlimited
  sold         integer not null default 0 check (sold >= 0),
  sales_start  timestamptz,
  sales_end    timestamptz,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  check (quantity is null or sold <= quantity)
);

create index if not exists tiers_event_idx on public.ticket_tiers (event_id);

-- ---------- Registrations (one row per attendee ticket) ----------
create table if not exists public.registrations (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  tier_id         uuid not null references public.ticket_tiers(id) on delete restrict,
  user_id         uuid references public.profiles(id) on delete set null,
  attendee_name   text not null,
  attendee_email  text not null,
  status          text not null default 'pending'
                  check (status in ('pending','confirmed','cancelled','refunded')),
  amount_minor    integer not null default 0 check (amount_minor >= 0),
  payment_ref     text unique,
  ticket_code     text not null unique default encode(gen_random_bytes(12), 'hex'),
  checked_in_at   timestamptz,
  checked_in_by   uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists reg_event_idx on public.registrations (event_id, status);
create index if not exists reg_email_idx on public.registrations (lower(attendee_email));

-- ---------- Team members and roles ----------
create table if not exists public.event_members (
  event_id       uuid not null references public.events(id) on delete cascade,
  user_id        uuid references public.profiles(id) on delete cascade,
  invited_email  text,
  role           text not null check (role in ('owner','admin','editor','checkin','finance','viewer')),
  invited_at     timestamptz not null default now(),
  accepted_at    timestamptz,
  check (user_id is not null or invited_email is not null)
);

create unique index if not exists event_members_unique
  on public.event_members (event_id, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(invited_email, ''));

-- ---------- Email campaigns and suppression ----------
create table if not exists public.email_campaigns (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  created_by    uuid not null references public.profiles(id) on delete restrict,
  subject       text not null,
  body          text not null,
  segment       text not null check (segment in ('all','paid','checked_in','not_checked_in','waitlist')),
  status        text not null default 'draft' check (status in ('draft','scheduled','sending','sent','failed')),
  scheduled_at  timestamptz,
  sent_count    integer not null default 0,
  created_at    timestamptz not null default now()
);

-- Server-only table: no browser policies, written by the service role.
create table if not exists public.email_suppressions (
  email       text not null,
  event_id    uuid references public.events(id) on delete cascade,
  reason      text not null check (reason in ('unsubscribed','bounced','complaint')),
  created_at  timestamptz not null default now()
);

create unique index if not exists email_suppressions_unique
  on public.email_suppressions (lower(email), coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ---------- Audit log ----------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  event_id    uuid references public.events(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- Helper: is the current user a member of this event with one of the roles?
-- Used by row-level security policies, so signed-in users can run it.
-- ============================================================
create or replace function public.has_event_role(p_event uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_members m
    where m.event_id = p_event
      and m.user_id = auth.uid()
      and m.accepted_at is not null
      and m.role = any (p_roles)
  )
  or exists (
    select 1 from public.events e
    where e.id = p_event and e.owner_id = auth.uid()
  );
$$;

-- ============================================================
-- Safe ticket selling: locks the tier row so two buyers cannot
-- take the last ticket at the same moment. Uses the signed-in
-- user if there is one (never a user id from the browser).
-- Anonymous guests can call it for guest checkout.
-- ============================================================
create or replace function public.reserve_ticket(
  p_tier uuid,
  p_name text,
  p_email text
)
returns public.registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.ticket_tiers;
  r public.registrations;
begin
  if p_name is null or char_length(trim(p_name)) < 2 then
    raise exception 'Enter the attendee name';
  end if;
  if p_email is null or p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address';
  end if;

  select * into t from public.ticket_tiers where id = p_tier for update;

  if not found or not t.is_active then
    raise exception 'This ticket is not available';
  end if;
  if t.sales_start is not null and now() < t.sales_start then
    raise exception 'Ticket sales have not started yet';
  end if;
  if t.sales_end is not null and now() > t.sales_end then
    raise exception 'Ticket sales have ended';
  end if;
  if t.quantity is not null and t.sold >= t.quantity then
    raise exception 'Sold out';
  end if;

  update public.ticket_tiers set sold = sold + 1 where id = p_tier;

  insert into public.registrations (event_id, tier_id, user_id, attendee_name, attendee_email, status, amount_minor)
  values (t.event_id, t.id, auth.uid(), trim(p_name), lower(p_email),
          case when t.price_minor = 0 then 'confirmed' else 'pending' end,
          t.price_minor)
  returning * into r;

  return r;
end;
$$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles           enable row level security;
alter table public.events             enable row level security;
alter table public.ticket_tiers       enable row level security;
alter table public.registrations      enable row level security;
alter table public.event_members      enable row level security;
alter table public.email_campaigns    enable row level security;
alter table public.email_suppressions enable row level security;
alter table public.audit_log          enable row level security;

-- Profiles: users see and edit only their own profile
create policy "profile_own_select" on public.profiles for select using (id = auth.uid());
create policy "profile_own_update" on public.profiles for update using (id = auth.uid());
create policy "profile_own_insert" on public.profiles for insert with check (id = auth.uid());

-- Events: anyone can read published events; members manage their own events
create policy "events_public_read" on public.events for select
  using (status = 'published' or owner_id = auth.uid() or public.has_event_role(id, array['owner','admin','editor','checkin','finance','viewer']));
create policy "events_create" on public.events for insert with check (owner_id = auth.uid());
create policy "events_edit" on public.events for update
  using (public.has_event_role(id, array['owner','admin','editor']));
create policy "events_delete" on public.events for delete
  using (owner_id = auth.uid());

-- Ticket tiers: public read for published events; editors manage
create policy "tiers_public_read" on public.ticket_tiers for select
  using (exists (select 1 from public.events e where e.id = event_id and (e.status = 'published' or public.has_event_role(e.id, array['owner','admin','editor','finance','viewer']))));
create policy "tiers_manage" on public.ticket_tiers for all
  using (public.has_event_role(event_id, array['owner','admin','editor']))
  with check (public.has_event_role(event_id, array['owner','admin','editor']));

-- Registrations: a guest sees their own; event staff see the guest list.
-- Inserts happen through reserve_ticket(), not directly from the browser.
create policy "reg_guest_read" on public.registrations for select
  using (user_id = auth.uid() or public.has_event_role(event_id, array['owner','admin','editor','checkin','finance','viewer']));
create policy "reg_staff_update" on public.registrations for update
  using (public.has_event_role(event_id, array['owner','admin','editor','checkin']));

-- Team: owners and admins manage members; members can see their own rows
create policy "members_read" on public.event_members for select
  using (user_id = auth.uid() or public.has_event_role(event_id, array['owner','admin']));
create policy "members_manage" on public.event_members for all
  using (public.has_event_role(event_id, array['owner','admin']))
  with check (public.has_event_role(event_id, array['owner','admin']));

-- Campaigns: only editors and admins can send messages
create policy "campaigns_staff" on public.email_campaigns for all
  using (public.has_event_role(event_id, array['owner','admin','editor']))
  with check (public.has_event_role(event_id, array['owner','admin','editor']));

-- Audit log: owners and admins can read, nobody can edit from the browser
create policy "audit_staff_read" on public.audit_log for select
  using (public.has_event_role(event_id, array['owner','admin']));

-- ============================================================
-- Keep updated_at fresh on events
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_touch on public.events;
create trigger events_touch before update on public.events
for each row execute function public.touch_updated_at();

-- ============================================================
-- Create a profile automatically when a user signs up (trigger only)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================
-- Grants: lock down who can call what over the API
-- ============================================================
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.has_event_role(uuid, text[]) from public, anon;
grant execute on function public.has_event_role(uuid, text[]) to authenticated;
revoke execute on function public.reserve_ticket(uuid, text, text) from public;
grant execute on function public.reserve_ticket(uuid, text, text) to anon, authenticated;

-- ============================================================
-- Event privacy and design fields (applied to staging and production)
-- ============================================================
alter table public.events add column if not exists visibility text not null default 'public' check (visibility in ('public','private'));
alter table public.events add column if not exists show_attendee_count boolean not null default true;
alter table public.events add column if not exists require_approval boolean not null default false;
alter table public.events add column if not exists cover_theme text not null default 'minimal';
create index if not exists events_visibility_idx on public.events (visibility, status, starts_at);
