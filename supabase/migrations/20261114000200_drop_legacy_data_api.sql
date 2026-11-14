-- Drop the old app's Data API functions and table policies (the contract step after
-- 20261113000100_close_legacy_data_api, which revoked them and is live on staging and production).
--
-- Nothing calls these any more: the website goes through gventz-api, which connects as gventz_api
-- and has its own api_* policies on every table. Since the revoke, anon and authenticated can't
-- call or reach them either.
--
-- Kept:
--   - has_event_role: used by the events_guard trigger and by can_manage_event_folder.
--   - can_manage_event_folder: used by the storage.objects policies for event covers.
--   - Trigger functions, the gventz_api (api_*) policies, and storage policies.

set lock_timeout = '5s';

-- Functions.
drop function if exists public.check_in_guest(uuid);
drop function if exists public.create_event_with_tiers(jsonb, jsonb);
drop function if exists public.delete_event(uuid, text);
drop function if exists public.event_delete_check(uuid);
drop function if exists public.get_event_page(text);
drop function if exists public.get_ticket(text);
drop function if exists public.promote_next_waitlisted(uuid);
drop function if exists public.public_attendee_count(uuid);
drop function if exists public.register_guest(uuid, uuid, text, text, jsonb);
drop function if exists public.reserve_ticket(uuid, text, text);
drop function if exists public.take_places_quota();

-- Table policies of the old app. They were TO public; the api_* policies for gventz_api remain.
drop policy if exists audit_staff_read on public.audit_log;
drop policy if exists campaigns_staff on public.email_campaigns;
drop policy if exists members_manage on public.event_members;
drop policy if exists members_read on public.event_members;
drop policy if exists questions_manage on public.event_questions;
drop policy if exists questions_public_read on public.event_questions;
drop policy if exists questions_read on public.event_questions;
drop policy if exists events_create on public.events;
drop policy if exists events_delete on public.events;
drop policy if exists events_edit on public.events;
drop policy if exists events_public_read on public.events;
drop policy if exists profile_own_select on public.profiles;
drop policy if exists profile_own_update on public.profiles;
drop policy if exists reg_guest_read on public.registrations;
drop policy if exists tiers_manage on public.ticket_tiers;
drop policy if exists tiers_public_read on public.ticket_tiers;
