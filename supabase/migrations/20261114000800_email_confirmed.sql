-- public.email_confirmed(user, email): whether a Supabase account has confirmed this email, for
-- gventz-api's staff check (security review of gventz-api #45, item 3).
--
-- Staff were recognised by the email in the sign-in token alone. That is safe only while every
-- way to sign in proves the address (email codes, Google). This makes the API also require that
-- the account's email is confirmed in Supabase Auth, is still the account's email, and that the
-- account is not deleted, banned or anonymous. gventz_api has no access to the auth schema, so it
-- asks through this function, which reads one row and returns only true or false.
--
-- Only gventz_api may call it: EXECUTE is revoked from PUBLIC (new functions are executable by
-- PUBLIC by default), anon and authenticated (supabase/tests/data_api_closed.test.sql).

create or replace function public.email_confirmed(p_user uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from auth.users u
     where u.id = p_user
       and lower(u.email) = lower(trim(p_email))
       and u.email_confirmed_at is not null
       and u.deleted_at is null
       and coalesce(u.is_anonymous, false) = false
       and (u.banned_until is null or u.banned_until <= now())
  );
$$;

comment on function public.email_confirmed(uuid, text) is
  'gventz-api only: true when the account has confirmed this email and is active. Staff check.';

revoke execute on function public.email_confirmed(uuid, text) from public, anon, authenticated;
grant execute on function public.email_confirmed(uuid, text) to gventz_api;
