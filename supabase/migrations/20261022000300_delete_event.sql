-- ============================================================
-- Hosts can delete their own event, completely.
--
-- Only the event's owner can do it (not admins or editors, who can still
-- cancel). The host must type the event name to confirm; the app checks
-- this too, but the database has the final say.
--
-- Everything is removed in one transaction: registrations (tickets),
-- ticket types, questions, team members, announcements and the audit trail
-- for the event. If any step fails, nothing is deleted. Registrations are
-- removed first because ticket types refuse to go while tickets point at them.
--
-- Events with paid tickets can't be deleted (cancel them instead), so
-- payment records stay available for refunds and accounting.
-- The flyer image is removed by the app before this runs.
-- ============================================================

-- What the host sees before deleting: who owns it, and how many guests it affects.
create or replace function public.event_delete_check(p_event uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'title',    e.title,
    'is_owner', e.owner_id = auth.uid(),
    'guests',   (select count(*) from public.registrations r
                 where r.event_id = e.id and r.status in ('confirmed', 'pending', 'waitlisted')),
    'paid',     (select count(*) from public.registrations r
                 where r.event_id = e.id and r.amount_minor > 0 and r.status in ('confirmed', 'pending'))
  )
  from public.events e
  where e.id = p_event
    and public.has_event_role(e.id, array['owner','admin','editor','checkin','finance','viewer']);
$$;

revoke execute on function public.event_delete_check(uuid) from public, anon;
grant  execute on function public.event_delete_check(uuid) to authenticated;

create or replace function public.delete_event(p_event uuid, p_confirm_title text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.events;
  removed integer;
begin
  select * into e from public.events where id = p_event for update;
  if not found or e.owner_id is distinct from auth.uid() then
    raise exception 'Only the person who created this event can delete it';
  end if;

  -- Same comparison as the form: spaces at the ends and letter case don't matter.
  if lower(btrim(coalesce(p_confirm_title, ''))) <> lower(btrim(e.title)) then
    raise exception 'Type the event name exactly to confirm';
  end if;

  if exists (select 1 from public.registrations r
             where r.event_id = e.id and r.amount_minor > 0 and r.status in ('confirmed', 'pending')) then
    raise exception 'This event has paid tickets, so it can''t be deleted. Cancel it instead.';
  end if;

  delete from public.registrations where event_id = e.id;
  get diagnostics removed = row_count;
  delete from public.events where id = e.id;  -- the rest cascades

  return jsonb_build_object('deleted', true, 'registrations_removed', removed);
end;
$$;

revoke execute on function public.delete_event(uuid, text) from public, anon;
grant  execute on function public.delete_event(uuid, text) to authenticated;
