-- Sending announcements (change request C2, 2026-10-25).
--
-- Until now announcements were drafts only (D25). A send snapshots the
-- audience into email_campaign_recipients in the same transaction that checks
-- the free-plan limits (sends per event, emails per host per month); the
-- worker then sends one email per row.
--
-- charged_to: the host whose monthly allowance the send used (the event owner
-- at send time), so a later change of owner doesn't move past usage.

set lock_timeout = '5s';

alter table public.email_campaigns
  add column if not exists sent_at timestamptz,
  add column if not exists sent_by uuid references public.profiles(id) on delete set null,
  add column if not exists charged_to uuid references public.profiles(id) on delete set null,
  add column if not exists recipient_count integer not null default 0;

-- Monthly usage per host, and sends per event.
create index if not exists email_campaigns_charged_to_sent
  on public.email_campaigns (charged_to, sent_at) where sent_at is not null;
create index if not exists email_campaigns_event_sent
  on public.email_campaigns (event_id) where sent_at is not null;

create table if not exists public.email_campaign_recipients (
  id           bigint generated always as identity primary key,
  campaign_id  uuid not null references public.email_campaigns(id) on delete cascade,
  email        text not null,
  name         text,
  status       text not null default 'queued' check (status in ('queued', 'sent', 'skipped', 'failed')),
  sent_at      timestamptz,
  -- The unsubscribe link in the email: unguessable, so no signing secret is needed.
  token        text not null default replace(gen_random_uuid()::text, '-', '')
);

-- One email per address per announcement.
create unique index if not exists email_campaign_recipients_one_per_address
  on public.email_campaign_recipients (campaign_id, lower(email));
create unique index if not exists email_campaign_recipients_token
  on public.email_campaign_recipients (token);
create index if not exists email_campaign_recipients_queued
  on public.email_campaign_recipients (campaign_id, id) where status = 'queued';

-- Server-only, like email_suppressions: RLS on, only the API role admitted.
alter table public.email_campaign_recipients enable row level security;
-- Supabase's default privileges give the Data API roles every right on new tables; RLS already
-- blocks them, and this takes the rights away too (SECURITY-06).
revoke all on table public.email_campaign_recipients from anon, authenticated;
grant select, insert, update, delete on table public.email_campaign_recipients to gventz_api;
grant usage, select on all sequences in schema public to gventz_api;
drop policy if exists "api_all" on public.email_campaign_recipients;
create policy "api_all" on public.email_campaign_recipients for all to gventz_api using (true) with check (true);
