-- Close the Data API (PostgREST/GraphQL) on the public schema to visitors and signed-in users.
--
-- Why: the website no longer reads or writes data through Supabase. Since the move to gventz-api
-- (U6a) and the server-side sign-in (G-VENTS #44, #46), Supabase is used for sign-in only, and all
-- data goes through the API, which connects as its own role, gventz_api. But the grants and
-- SECURITY DEFINER functions of the old app were still in place. Anyone holding the public
-- (publishable) key, signed in or not, could call them over /rest/v1 and skip the API's rules
-- (per-buyer limits, audit log, outbox, rate limits). Examples: register_guest, check_in_guest,
-- delete_event, get_ticket, get_event_page, reserve_ticket, promote_next_waitlisted, and direct
-- inserts and updates on events, ticket tiers, questions and members under the old policies.
-- The logs show no Data API traffic except the Supabase CLI, so nothing uses these any more.
--
-- Expand before contract: this only revokes privileges, which can be granted again. The old
-- functions and policies stay for now and are dropped in a later migration.
--
-- Not changed here:
--   - gventz_api's own grants, and service_role.
--   - Trigger functions. They can't be called directly, and triggers fire whatever the grants.
--   - can_manage_event_folder: the storage.objects policies for event covers use it. Storage
--     is reviewed on its own.
--   - The auth schema (sign-in) and storage.

-- Tables and sequences in public: no direct access for visitors or signed-in users.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Functions: every callable function in public except can_manage_event_folder. EXECUTE is
-- revoked from PUBLIC too, because anon and authenticated inherit through it.
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.prokind in ('f', 'p')
       and p.prorettype <> 'trigger'::regtype
       and p.proname <> 'can_manage_event_folder'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end
$$;

-- New objects that migrations create (as postgres) aren't exposed either: Supabase grants them
-- to anon and authenticated by default in this schema.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
-- Postgres also lets PUBLIC execute every new function, and a per-schema default can't take that
-- away. So a new function needs its own `revoke execute ... from public`;
-- supabase/tests/data_api_closed.test.sql fails if one is missed.
