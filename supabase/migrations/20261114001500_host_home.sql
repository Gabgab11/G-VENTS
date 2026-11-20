-- email_campaigns.template (Change 4, FR-33.3): announcements may carry one of G-ventZ's templates.
-- The template adds G-ventZ's own line, in each recipient's language, before the host's subject and
-- message, which are sent as written. Null keeps today's announcements exactly as they are.
--
-- The host home (GET /v1/host/home) needs no schema change: it reads existing tables through
-- existing indexes. This file is named after that part of Change 4 because the template column is
-- its only schema change.
--
-- gventz_api already has select, insert and update on email_campaigns, and the table already has RLS
-- with a gventz_api policy; nothing else reads it. Adding a nullable column with a check is a
-- metadata change, so the lock is brief.

set local lock_timeout = '5s';

alter table public.email_campaigns
  add column template text
  constraint email_campaigns_template_check check (template in ('reminder', 'reschedule', 'lineup', 'thanks', 'feedback'));

comment on column public.email_campaigns.template is
  'G-ventZ framing around the host''s text: reminder, reschedule, lineup, thanks or feedback; null = none. Set through gventz-api.';
