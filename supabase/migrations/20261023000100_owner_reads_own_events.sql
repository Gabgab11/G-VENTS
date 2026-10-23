-- ============================================================
-- Hosts can create draft and private events again.
--
-- 20261014000200_security_hardening rewrote "events_public_read" and dropped
-- the baseline's `owner_id = auth.uid()`, leaving has_event_role() as the only
-- way an owner reads their own unpublished or private event.
--
-- That breaks creating one: create_event_with_tiers() inserts the event with
-- RETURNING, and Postgres checks RETURNING rows against the SELECT policy.
-- has_event_role() finds the owner by looking the event up, but it can't see
-- a row the same statement is still inserting, so the check fails and the
-- insert is refused ("new row violates row-level security policy").
-- Published public events passed only because they match the first clause.
--
-- The owner check on the row itself is restored. It grants nothing new: the
-- owner could already read these events through has_event_role().
-- ============================================================

drop policy if exists "events_public_read" on public.events;
create policy "events_public_read" on public.events for select
  using (
    (status = 'published' and visibility = 'public')
    or owner_id = auth.uid()
    or public.has_event_role(id, array['owner','admin','editor','checkin','finance','viewer'])
  );
