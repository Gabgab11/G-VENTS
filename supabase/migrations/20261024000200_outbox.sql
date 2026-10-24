-- Transactional outbox for gventz-api (application design AD18, Change 1 / U1).
--
-- Rows are written in the same transaction as the business change. A worker
-- job claims undispatched rows (FOR UPDATE SKIP LOCKED), queues them in BullMQ
-- under the stored job id, then marks them dispatched. Dispatched rows are
-- deleted after 7 days by the API's maintenance job.
--
-- Only the API role can reach this table: RLS is on with no policy for
-- `anon` or `authenticated`.

set lock_timeout = '5s';

create table if not exists public.outbox_events (
  id             uuid primary key,
  event_type     text not null check (char_length(event_type) between 1 and 120),
  job_queue      text not null check (char_length(job_queue) between 1 and 60),
  job_name       text not null check (char_length(job_name) between 1 and 120),
  job_id         text not null unique check (char_length(job_id) between 1 and 200),
  payload        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  dispatched_at  timestamptz
);

create index if not exists outbox_events_pending_idx
  on public.outbox_events (id)
  where dispatched_at is null;

create index if not exists outbox_events_dispatched_idx
  on public.outbox_events (dispatched_at)
  where dispatched_at is not null;

alter table public.outbox_events enable row level security;

-- Supabase's default privileges give new public tables to anon and authenticated; take them back.
revoke all on table public.outbox_events from anon, authenticated;

grant select, insert, update, delete on table public.outbox_events to gventz_api;

drop policy if exists "api_all" on public.outbox_events;
create policy "api_all" on public.outbox_events for all to gventz_api using (true) with check (true);
