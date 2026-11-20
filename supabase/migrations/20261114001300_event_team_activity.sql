-- Event team invitations and the event activity log (Change 4, P2: team roles and activity).
--
-- event_invites: an owner or co-host (admin) invites an email address to an event's team with a
-- role (admin, editor, checkin, finance or viewer; never owner). The link in the email carries a
-- token; only its SHA-256 hash is stored. An invitation lasts 7 days and is used once: accepting
-- it, signed in with exactly that confirmed email, adds the event_members row (done by the API).
--
-- event_activity: what happened on an event and who did it (edits, publishing, cancelling, team
-- changes, check-ins, refunds), newest first for the event's team. Append-only: rows are never
-- changed or deleted, except together with their event. actor_id keeps a plain id (no foreign key)
-- so deleting a profile never rewrites a row. Meta holds which fields changed, never old personal data.
--
-- Only the API role (gventz_api) reads and writes these; row-level security is on with no policy
-- for anon or authenticated. Additive only (expand before contract).

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------
-- Team invitations.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.event_invites (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  email        text not null check (email = lower(email) and email like '%_@_%' and char_length(email) <= 320),
  role         text not null check (role in ('admin', 'editor', 'checkin', 'finance', 'viewer')),
  token_hash   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  accepted_at  timestamptz,
  accepted_by  uuid references public.profiles(id) on delete set null,
  revoked_at   timestamptz,
  check (expires_at > created_at),
  check (accepted_at is null or revoked_at is null),
  check (accepted_by is null or accepted_at is not null)
);

comment on table public.event_invites is
  'Invitations to an event team (Change 4). token_hash = sha256 of the emailed token; 7 days; single use.';

-- At most one unsettled (not accepted, not withdrawn) invitation per event and email.
create unique index if not exists event_invites_open_email_idx
  on public.event_invites (event_id, email)
  where accepted_at is null and revoked_at is null;
create index if not exists event_invites_event_idx on public.event_invites (event_id, created_at desc);

-- ---------------------------------------------------------------------------------------------
-- Activity log.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.event_activity (
  id        bigint generated always as identity primary key,
  event_id  uuid not null references public.events(id) on delete cascade,
  actor_id  uuid,
  action    text not null check (action ~ '^[a-z_]+\.[a-z_]+$' and char_length(action) <= 64),
  subject   text check (subject is null or char_length(subject) <= 320),
  meta      jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object'),
  at        timestamptz not null default now()
);

comment on table public.event_activity is
  'What happened on an event and who did it (Change 4). Append-only; removed only with its event.';

-- The team's activity page: one event, newest first, keyset on id.
create index if not exists event_activity_event_idx on public.event_activity (event_id, id desc);

create or replace function public.event_activity_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Deleting the event cascades to its activity; nothing else may remove or change a row.
  if tg_op = 'DELETE' and not exists (select 1 from public.events e where e.id = old.event_id) then
    return old;
  end if;
  raise exception 'event activity is append-only' using errcode = '42501';
end;
$$;
revoke execute on function public.event_activity_append_only() from public, anon, authenticated;

drop trigger if exists event_activity_append_only on public.event_activity;
create trigger event_activity_append_only
  before update or delete on public.event_activity
  for each row execute function public.event_activity_append_only();

-- ---------------------------------------------------------------------------------------------
-- Row-level security and grants: the API role only.
-- ---------------------------------------------------------------------------------------------
alter table public.event_invites enable row level security;
alter table public.event_activity enable row level security;
-- Supabase's default privileges give new public tables to anon and authenticated; take them back.
revoke all on table public.event_invites from anon, authenticated;
revoke all on table public.event_activity from anon, authenticated;

grant select, insert, update on table public.event_invites to gventz_api;
drop policy if exists "api_read" on public.event_invites;
create policy "api_read" on public.event_invites for select to gventz_api using (true);
drop policy if exists "api_insert" on public.event_invites;
create policy "api_insert" on public.event_invites for insert to gventz_api with check (true);
drop policy if exists "api_update" on public.event_invites;
create policy "api_update" on public.event_invites for update to gventz_api using (true) with check (true);

-- Append-only for the API role, like the audit log and the ledger.
grant select, insert on table public.event_activity to gventz_api;
grant usage, select on sequence public.event_activity_id_seq to gventz_api;
drop policy if exists "api_read" on public.event_activity;
create policy "api_read" on public.event_activity for select to gventz_api using (true);
drop policy if exists "api_insert" on public.event_activity;
create policy "api_insert" on public.event_activity for insert to gventz_api with check (true);
