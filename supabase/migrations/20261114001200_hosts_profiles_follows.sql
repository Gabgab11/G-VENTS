-- Host profiles and follows (Change 4, D83, FR-32): a public profile at /h/{handle}, followers who
-- are emailed when the host publishes a new public event, and a verified badge given by staff.
--
-- profiles gets the host fields. Handles are 3-30 characters of a-z, 0-9 and single inner hyphens,
-- stored lower-case and unique ignoring case; gventz-api also refuses reserved words and handles
-- still in profile_handle_history (an old handle redirects to its profile and can't be taken by
-- someone else for 90 days). Social links are https URLs that gventz-api checks and normalises.
--
-- Only gventz-api reads and writes the new columns and tables: it already has update on profiles,
-- and the new tables have row-level security with a policy for gventz_api only. Signed-in users'
-- direct column grants on profiles are not widened. Additive: nullable columns, new tables, and
-- indexes on profiles (small) and events (a partial index for the profile's event lists).

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------
-- profiles: the host fields.
-- ---------------------------------------------------------------------------------------------
alter table public.profiles
  add column if not exists handle      text,
  add column if not exists bio         text,
  add column if not exists location    text,
  add column if not exists avatar_path text,
  add column if not exists cover_path  text,
  add column if not exists instagram   text,
  add column if not exists facebook    text,
  add column if not exists x           text,
  add column if not exists website     text,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references public.profiles(id) on delete set null;

alter table public.profiles drop constraint if exists profiles_handle_check;
alter table public.profiles add constraint profiles_handle_check check (
  handle is null or (char_length(handle) between 3 and 30 and handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$'));
alter table public.profiles drop constraint if exists profiles_bio_check;
alter table public.profiles add constraint profiles_bio_check check (bio is null or char_length(bio) <= 500);
alter table public.profiles drop constraint if exists profiles_location_check;
alter table public.profiles add constraint profiles_location_check check (location is null or char_length(location) <= 120);
alter table public.profiles drop constraint if exists profiles_image_paths_check;
alter table public.profiles add constraint profiles_image_paths_check check (
  (avatar_path is null or char_length(avatar_path) <= 300) and (cover_path is null or char_length(cover_path) <= 300));
alter table public.profiles drop constraint if exists profiles_socials_check;
alter table public.profiles add constraint profiles_socials_check check (
      (instagram is null or (char_length(instagram) <= 300 and instagram ~ '^https://'))
  and (facebook  is null or (char_length(facebook)  <= 300 and facebook  ~ '^https://'))
  and (x         is null or (char_length(x)         <= 300 and x         ~ '^https://'))
  and (website   is null or (char_length(website)   <= 300 and website   ~ '^https://')));

create unique index if not exists profiles_handle_lower_idx on public.profiles (lower(handle)) where handle is not null;

comment on column public.profiles.handle is 'Public profile handle (/h/{handle}): 3-30 of a-z 0-9 and inner hyphens, lower-case, unique. Set through gventz-api.';
comment on column public.profiles.bio is 'Host bio, at most 500 characters.';
comment on column public.profiles.location is 'Host location as written, at most 120 characters.';
comment on column public.profiles.avatar_path is 'Avatar image path in the event-covers bucket (hosts/{profileId}/...).';
comment on column public.profiles.cover_path is 'Profile cover image path in the event-covers bucket (hosts/{profileId}/...).';
comment on column public.profiles.instagram is 'Normalised https URL on instagram.com.';
comment on column public.profiles.facebook is 'Normalised https URL on facebook.com.';
comment on column public.profiles.x is 'Normalised https URL on x.com.';
comment on column public.profiles.website is 'Normalised https URL, at most 300 characters.';
comment on column public.profiles.verified_at is 'When G-ventZ staff gave the verified badge; null = not verified.';
comment on column public.profiles.verified_by is 'The staff member who gave the verified badge.';

-- ---------------------------------------------------------------------------------------------
-- Handle history: an old handle points at its profile (redirect) until someone else may take it.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.profile_handle_history (
  old_handle  text primary key check (char_length(old_handle) between 3 and 30 and old_handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  changed_at  timestamptz not null default now()
);

create index if not exists profile_handle_history_profile_idx on public.profile_handle_history (profile_id);

comment on table public.profile_handle_history is
  'Handles a profile used before. GET /v1/hosts/{old} answers with the current handle; another profile may take it 90 days after changed_at.';

-- ---------------------------------------------------------------------------------------------
-- Follows: a signed-in user follows a host. The token is the unsubscribe link in follower emails.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.host_follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  host_id      uuid not null references public.profiles(id) on delete cascade,
  token        text not null default replace(gen_random_uuid()::text, '-', '') unique,
  created_at   timestamptz not null default now(),
  primary key (follower_id, host_id),
  constraint host_follows_not_self check (follower_id <> host_id)
);

-- Follower counts and the new-event fan-out page through a host's followers.
create index if not exists host_follows_host_idx on public.host_follows (host_id, follower_id);

comment on table public.host_follows is
  'Who follows which host (FR-32). Followers are emailed when the host publishes a public event; the token unsubscribes from that host.';

-- ---------------------------------------------------------------------------------------------
-- The profile's Upcoming / Past lists: a host's published public events by start.
-- ---------------------------------------------------------------------------------------------
create index if not exists events_owner_public_idx on public.events (owner_id, starts_at, id)
  where status = 'published' and visibility = 'public';

-- ---------------------------------------------------------------------------------------------
-- Row-level security and grants: the API role only.
-- ---------------------------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['profile_handle_history', 'host_follows'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('drop policy if exists "api_all" on public.%I', t);
    execute format('create policy "api_all" on public.%I for all to gventz_api using (true) with check (true)', t);
  end loop;
end
$$;

-- A handle given up again moves its history row to the latest profile and time (upsert).
grant select, insert, update, delete on table public.profile_handle_history to gventz_api;
-- Follows are added and removed, never edited.
grant select, insert, delete on table public.host_follows to gventz_api;
