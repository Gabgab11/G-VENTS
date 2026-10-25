-- events_guard() steps aside for the API role (Change 1 / U3 delta Δ6).
--
-- The trigger already did nothing when auth.uid() is null (service jobs, migrations), which is
-- always the case for API connections. But calling auth.uid() needs rights on the `auth` schema,
-- which belongs to Supabase and can't be granted from migrations, so the call itself failed for
-- `gventz_api` ("permission denied for schema auth"). The API enforces the same rules in its
-- domain: the owner and slug never change; only the owner or an admin changes the status.
-- Behaviour for every other role is unchanged.

set lock_timeout = '5s';

create or replace function public.events_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- The NestJS API (gventz-api) checks these rules itself.
  if current_user = 'gventz_api' then
    return new;
  end if;
  -- Service-role jobs and migrations have no signed-in user.
  if auth.uid() is null then
    return new;
  end if;
  if new.owner_id is distinct from old.owner_id then
    raise exception 'The event owner cannot be changed';
  end if;
  if new.slug is distinct from old.slug then
    raise exception 'The event link cannot be changed';
  end if;
  if new.status is distinct from old.status
     and not public.has_event_role(old.id, array['owner','admin']) then
    raise exception 'Only the owner or an admin can publish or cancel this event';
  end if;
  return new;
end;
$$;
