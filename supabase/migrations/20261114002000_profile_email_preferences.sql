-- Email preferences on profiles (Change 5, chunk 3, FR-35, D93): the three switches on the
-- website's My account page, changed through gventz-api (PATCH /v1/me emailPreferences).
--   email_announcements:  hosts' announcements to their guests
--   email_followed_hosts: "new event" emails from hosts the user follows
--   email_product:        news about G-ventZ itself
-- Tickets, receipts and security emails are always sent; they have no switch.
--
-- Everyone starts opted in (default true), as they are today. gventz_api already has update on
-- profiles; signed-in users' direct column grants are not widened. Adding a column with a constant
-- default is a metadata change in Postgres 11+, so the lock is brief. Expand only.
--
-- GET /v1/me also says whether the user is a host (owns an event or has an accepted role on one).
-- event_members had no index by user, so a small partial one covers the accepted roles.

set local lock_timeout = '5s';

alter table public.profiles
  add column if not exists email_announcements boolean not null default true,
  add column if not exists email_followed_hosts boolean not null default true,
  add column if not exists email_product boolean not null default true;

comment on column public.profiles.email_announcements is
  'Receive hosts'' announcements to their guests. Set through gventz-api.';
comment on column public.profiles.email_followed_hosts is
  'Receive "new event" emails from followed hosts. Set through gventz-api.';
comment on column public.profiles.email_product is
  'Receive news about G-ventZ. Set through gventz-api.';

create index if not exists event_members_user_accepted_idx
  on public.event_members (user_id)
  where user_id is not null and accepted_at is not null;
