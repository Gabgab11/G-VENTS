-- Registration links (Change 6, FR-41..FR-47): public vs private events, optional registration
-- access codes, and multiple registration links per event (e.g. Attendee, Volunteer), each with its
-- own share token, cap, access code and questions.
--
-- Model: Event -> RegistrationLink -> TicketTier. Every event has exactly one DEFAULT link (plain
-- /e/<slug>); a host may add more links, shared as /e/<slug>?r=<token>. A non-default link holds
-- exactly one tier; the default link may hold several (today's paid "pick your price" page). A link
-- may carry an access code; so may the event. `visibility` is unchanged and still only controls
-- Discover listing — it is NOT access control.
--
-- Access codes are stored upper-case, 4-32 of A-Z 0-9, and are never returned to the public: like
-- discount_codes these tables are gventz-api-only (RLS, a gventz_api policy). The API keeps the code
-- and token out of public responses; verification is done server-side and returns only yes/no.
--
-- A link's cap limits TICKETS (confirmed + pending), like events.capacity. active_count is kept by
-- the same per-statement trigger that maintains events.active_count, counting the same statuses.
--
-- Additive and backward compatible: a new table and nullable columns, a backfilled default link per
-- event, and existing tiers/questions/registrations/orders reparented onto it. Existing event URLs,
-- tiers and issued tickets are unchanged; a single-link event behaves exactly as before.

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------
-- Registration links.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.registration_links (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 60),
  token         text not null unique default encode(gen_random_bytes(16), 'hex'),
  cap           integer check (cap is null or cap >= 0),
  access_code   text check (access_code is null or access_code ~ '^[A-Z0-9]{4,32}$'),
  is_default    boolean not null default false,
  is_active     boolean not null default true,
  position      integer not null default 0,
  active_count  integer not null default 0,
  created_at    timestamptz not null default now()
);

-- One default link per event; a fast lookup by share token and by event order.
create unique index if not exists registration_links_one_default_idx
  on public.registration_links (event_id) where is_default;
create index if not exists registration_links_event_idx
  on public.registration_links (event_id, position);

comment on table public.registration_links is
  'Registration links per event (Change 6, FR-41). Event -> RegistrationLink -> TicketTier. gventz-api only.';
comment on column public.registration_links.token is 'Unguessable share token (128-bit hex) used by /e/<slug>?r=<token>; not a secret credential but not listable by anon.';
comment on column public.registration_links.cap is 'Max TICKETS (confirmed + pending) under this link; null = unlimited. Enforced in the order transaction.';
comment on column public.registration_links.access_code is 'Optional link code, upper-case 4-32 of A-Z 0-9; never returned to the public.';
comment on column public.registration_links.is_default is 'Exactly one per event; plain /e/<slug>; may hold several tiers; cannot be archived/deleted.';
comment on column public.registration_links.active_count is 'Confirmed + pending registrations under the link; kept by the registrations trigger; never written by the API.';

-- ---------------------------------------------------------------------------------------------
-- New columns on existing tables (nullable first; tightened after backfill).
-- ---------------------------------------------------------------------------------------------
alter table public.events          add column if not exists access_code text
  check (access_code is null or access_code ~ '^[A-Z0-9]{4,32}$');
comment on column public.events.access_code is 'Optional event-level registration code (Change 6). visibility stays listing-only; this gates registration.';

alter table public.ticket_tiers    add column if not exists registration_link_id uuid;
alter table public.event_questions add column if not exists registration_link_id uuid;
alter table public.registrations   add column if not exists registration_link_id uuid;
alter table public.orders          add column if not exists registration_link_id uuid;

-- ---------------------------------------------------------------------------------------------
-- Backfill: one default "General" link per event, then reparent existing rows onto it.
-- ---------------------------------------------------------------------------------------------
insert into public.registration_links (event_id, name, is_default, is_active, position)
select e.id, 'General', true, true, 0
from public.events e
where not exists (
  select 1 from public.registration_links l where l.event_id = e.id and l.is_default
);

update public.ticket_tiers t
   set registration_link_id = d.id
  from public.registration_links d
 where d.event_id = t.event_id and d.is_default and t.registration_link_id is null;

update public.event_questions q
   set registration_link_id = d.id
  from public.registration_links d
 where d.event_id = q.event_id and d.is_default and q.registration_link_id is null;

update public.registrations r
   set registration_link_id = d.id
  from public.registration_links d
 where d.event_id = r.event_id and d.is_default and r.registration_link_id is null;

update public.orders o
   set registration_link_id = d.id
  from public.registration_links d
 where d.event_id = o.event_id and d.is_default and o.registration_link_id is null;

-- ---------------------------------------------------------------------------------------------
-- Foreign keys. The columns stay NULLABLE here (expand/contract): U1 backfills every existing row
-- and the events trigger below gives new events a default link, but `set not null` on
-- ticket_tiers/event_questions is deferred to U2, once the application always populates the link on
-- insert. This keeps U1 independently applicable without breaking current event-creation code.
-- ---------------------------------------------------------------------------------------------
alter table public.ticket_tiers
  add constraint ticket_tiers_registration_link_fk
  foreign key (registration_link_id) references public.registration_links(id) on delete cascade;
alter table public.event_questions
  add constraint event_questions_registration_link_fk
  foreign key (registration_link_id) references public.registration_links(id) on delete cascade;
alter table public.registrations
  add constraint registrations_registration_link_fk
  foreign key (registration_link_id) references public.registration_links(id) on delete set null;
alter table public.orders
  add constraint orders_registration_link_fk
  foreign key (registration_link_id) references public.registration_links(id) on delete set null;

create index if not exists ticket_tiers_registration_link_idx    on public.ticket_tiers (registration_link_id);
create index if not exists event_questions_registration_link_idx on public.event_questions (registration_link_id);
create index if not exists registrations_registration_link_idx   on public.registrations (registration_link_id);
create index if not exists orders_registration_link_idx          on public.orders (registration_link_id);

-- ---------------------------------------------------------------------------------------------
-- Non-default link holds exactly one tier (the default link may hold many).
-- ---------------------------------------------------------------------------------------------
create or replace function public.registration_links_single_tier_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.registration_links l
     where l.id = new.registration_link_id and not l.is_default
  ) and exists (
    select 1 from public.ticket_tiers t
     where t.registration_link_id = new.registration_link_id and t.id <> new.id
  ) then
    raise exception 'registration_links_single_tier';  -- P0001: user-visible per the errors convention
  end if;
  return new;
end;
$$;

revoke execute on function public.registration_links_single_tier_guard() from public, anon, authenticated;

drop trigger if exists ticket_tiers_single_tier_guard on public.ticket_tiers;
create trigger ticket_tiers_single_tier_guard
  before insert or update of registration_link_id on public.ticket_tiers
  for each row execute function public.registration_links_single_tier_guard();

-- ---------------------------------------------------------------------------------------------
-- Counters: the per-statement registrations trigger now maintains registration_links.active_count
-- too, using the same {confirmed, pending} rule as events.active_count.
-- ---------------------------------------------------------------------------------------------
create or replace function public.registrations_active_count_stmt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.events e set active_count = e.active_count + d.n
      from (select event_id, count(*)::int as n from new_rows where status in ('confirmed', 'pending') group by event_id) d
     where e.id = d.event_id;
    update public.registration_links l set active_count = l.active_count + d.n
      from (select registration_link_id, count(*)::int as n from new_rows
             where status in ('confirmed', 'pending') and registration_link_id is not null
             group by registration_link_id) d
     where l.id = d.registration_link_id;
  elsif tg_op = 'DELETE' then
    update public.events e set active_count = e.active_count - d.n
      from (select event_id, count(*)::int as n from old_rows where status in ('confirmed', 'pending') group by event_id) d
     where e.id = d.event_id;
    update public.registration_links l set active_count = l.active_count - d.n
      from (select registration_link_id, count(*)::int as n from old_rows
             where status in ('confirmed', 'pending') and registration_link_id is not null
             group by registration_link_id) d
     where l.id = d.registration_link_id;
  else
    update public.events e set active_count = e.active_count + d.n
      from (
        select event_id, sum(n)::int as n from (
          select event_id, 1 as n from new_rows where status in ('confirmed', 'pending')
          union all
          select event_id, -1 as n from old_rows where status in ('confirmed', 'pending')
        ) x group by event_id having sum(n) <> 0
      ) d
     where e.id = d.event_id;
    update public.registration_links l set active_count = l.active_count + d.n
      from (
        select registration_link_id, sum(n)::int as n from (
          select registration_link_id, 1 as n from new_rows where status in ('confirmed', 'pending') and registration_link_id is not null
          union all
          select registration_link_id, -1 as n from old_rows where status in ('confirmed', 'pending') and registration_link_id is not null
        ) x group by registration_link_id having sum(n) <> 0
      ) d
     where l.id = d.registration_link_id;
  end if;
  return null;
end;
$$;

revoke execute on function public.registrations_active_count_stmt() from public, anon, authenticated;

-- Seed link counters from existing registrations (same status rule).
update public.registration_links l set active_count = coalesce(c.n, 0)
  from (select registration_link_id, count(*)::int as n from public.registrations
         where status in ('confirmed', 'pending') and registration_link_id is not null
         group by registration_link_id) c
 where l.id = c.registration_link_id;
update public.registration_links l set active_count = 0
 where not exists (select 1 from public.registrations r
                    where r.registration_link_id = l.id and r.status in ('confirmed', 'pending'));

-- ---------------------------------------------------------------------------------------------
-- Every new event gets its default "General" link automatically, so the one-default-per-event
-- invariant always holds and event creation does not depend on the application remembering to.
-- ---------------------------------------------------------------------------------------------
create or replace function public.events_create_default_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.registration_links (event_id, name, is_default, is_active, position)
  values (new.id, 'General', true, true, 0);
  return null;
end;
$$;

revoke execute on function public.events_create_default_link() from public, anon, authenticated;

drop trigger if exists events_create_default_link on public.events;
create trigger events_create_default_link
  after insert on public.events
  for each row execute function public.events_create_default_link();

-- ---------------------------------------------------------------------------------------------
-- Row-level security and grants: the API role only (same posture as discount_codes).
-- ---------------------------------------------------------------------------------------------
alter table public.registration_links enable row level security;
revoke all on table public.registration_links from anon, authenticated;
grant select, insert, update, delete on table public.registration_links to gventz_api;
drop policy if exists "api_all" on public.registration_links;
create policy "api_all" on public.registration_links for all to gventz_api using (true) with check (true);

-- ---------------------------------------------------------------------------------------------
-- Rollback (forward-only migrations; documented for reference):
--   drop trigger events_create_default_link on public.events;
--   drop function public.events_create_default_link();
--   drop trigger ticket_tiers_single_tier_guard on public.ticket_tiers;
--   drop function public.registration_links_single_tier_guard();
--   -- restore public.registrations_active_count_stmt() to its 20261026000500 body;
--   alter table public.ticket_tiers    drop constraint ticket_tiers_registration_link_fk,    drop column registration_link_id;
--   alter table public.event_questions drop constraint event_questions_registration_link_fk, drop column registration_link_id;
--   alter table public.registrations   drop constraint registrations_registration_link_fk,   drop column registration_link_id;
--   alter table public.orders          drop constraint orders_registration_link_fk,          drop column registration_link_id;
--   alter table public.events          drop column access_code;
--   drop table public.registration_links;
