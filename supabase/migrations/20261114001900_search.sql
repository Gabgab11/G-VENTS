-- Header search (Change 5, FR-34, D92): GET /v1/search in gventz-api matches events by title, venue
-- and city, and hosts by name and handle, ignoring case and accents ("cafe" finds "Café").
-- pg_trgm lets `like '%text%'` use an index; unaccent removes accents. Both are standard Supabase
-- extensions and go in the `extensions` schema, as on the hosted projects.
--
-- public.search_fold(text) is the one folding rule: lower case, accents removed. unaccent() is only
-- stable (its dictionary could change), so the wrapper names the dictionary and is declared
-- immutable, the usual way to index unaccented text. The folded text is stored in a generated
-- column so a search never folds rows itself: trigram matches are rechecked against the row, and
-- folding thousands of rows per keystroke costs more than the rest of the search together.
--
-- Expand only: two new generated columns and two indexes. Nothing writes the columns.

set local lock_timeout = '5s';

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create or replace function public.search_fold(value text)
returns text
language sql
immutable
parallel safe
strict
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, value))
$$;

comment on function public.search_fold(text) is
  'Lower case, accents removed: the matching rule of GET /v1/search. Immutable so it can be stored and indexed.';

-- The Data API stays closed (20261113000100): only the API role calls it.
revoke execute on function public.search_fold(text) from public;
grant execute on function public.search_fold(text) to gventz_api;

-- Events: title, venue name and city in one text. The index covers listed events only (published
-- and public), which is all the search returns.
alter table public.events
  add column if not exists search_text text
  generated always as (public.search_fold(title || ' ' || coalesce(venue_name, '') || ' ' || coalesce(city, ''))) stored;

comment on column public.events.search_text is
  'search_fold(title, venue_name, city) for GET /v1/search. Generated; never written.';

create index if not exists events_search_trgm_idx on public.events
  using gin (search_text extensions.gin_trgm_ops)
  where status = 'published' and visibility = 'public';

-- Hosts: name and handle; null without a handle (no public host page, never searched).
alter table public.profiles
  add column if not exists search_text text
  generated always as (public.search_fold(coalesce(full_name, '') || ' ' || handle)) stored;

comment on column public.profiles.search_text is
  'search_fold(full_name, handle) for GET /v1/search; null without a handle. Generated; never written.';

create index if not exists profiles_search_trgm_idx on public.profiles
  using gin (search_text extensions.gin_trgm_ops)
  where handle is not null;

-- The touch trigger compares the whole row to tell an active_count-only update from a real change.
-- Generated columns aren't computed yet in a BEFORE trigger, so search_text is left out of that
-- comparison (it only follows title, venue_name and city, which are compared). Otherwise as in
-- 20261114001600.
create or replace function public.events_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.updated_at > old.updated_at then
    return new;
  end if;
  if (to_jsonb(new) - 'active_count' - 'updated_at' - 'search_text') = (to_jsonb(old) - 'active_count' - 'updated_at' - 'search_text') then
    new.updated_at = old.updated_at;
  else
    new.updated_at = now();
  end if;
  return new;
end;
$$;
