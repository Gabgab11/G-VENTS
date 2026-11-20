-- Up to 5 pictures per event (Change 4, chunk 3c). Position 0 is the main picture.
--
-- Each row is one file in the `event-covers` bucket (the same bucket, types and size limit as the
-- flyer). gventz-api writes them: it locks the event row, adds, removes or reorders pictures, and in
-- the same transaction sets events.cover_url to the position-0 picture's URL (null when there is
-- none) and moves events.updated_at forward (the share card is versioned by it; the events_touch
-- trigger keeps a value the writer moved forward, 20261114001600). The sync is done by the API, not
-- a trigger, so it goes with the API's EventUpdated fact (page revalidation) and activity entry.
--
-- The 5-picture cap holds in the database too: positions are 0-4 and unique per event (deferrable,
-- so a reorder can swap positions inside one transaction), and a trigger refuses a sixth row with a
-- clear message (P0001).
--
-- Existing flyers are copied in as position 0. storage_path is the object path inside the bucket,
-- taken from the public URL the same way the API does (FlyerPath.fromPublicUrl); it is '' when the
-- URL is not one of the bucket's public URLs, and the API never deletes such a file.
--
-- Only gventz-api reads and writes the table: row-level security on, a policy for gventz_api only
-- (the Data API is closed, 20261113000100; visitors see pictures through the API's event page).
-- Additive: one new table and its trigger.

set local lock_timeout = '5s';

create table if not exists public.event_images (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  storage_path  text not null check (char_length(storage_path) <= 200),
  url           text not null check (char_length(url) between 1 and 2000),
  position      smallint not null check (position between 0 and 4),
  width         integer check (width is null or width between 1 and 20000),
  height        integer check (height is null or height between 1 and 20000),
  created_at    timestamptz not null default now(),
  constraint event_images_event_position_key unique (event_id, position) deferrable initially deferred
);

comment on table public.event_images is
  'Event pictures (Change 4, chunk 3c): 0-5 per event in the host''s order; position 0 is the main picture and equals events.cover_url. Written through gventz-api only.';
comment on column public.event_images.storage_path is 'Object path in the event-covers bucket ({eventId}/{file}); '''' when the URL is not one of the bucket''s.';
comment on column public.event_images.position is '0-4, unique per event (deferred, so reorders can swap); 0 is the main picture.';
comment on column public.event_images.width is 'Pixel width the uploader reported; null when unknown.';
comment on column public.event_images.height is 'Pixel height the uploader reported; null when unknown.';

-- ---------------------------------------------------------------------------------------------
-- At most 5 per event, with a message the API can show.
-- ---------------------------------------------------------------------------------------------
create or replace function public.event_images_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Serialise inserts for one event so two at once can't both see 4.
  perform 1 from public.events where id = new.event_id for no key update;
  if (select count(*) from public.event_images where event_id = new.event_id) >= 5 then
    raise exception using errcode = 'P0001', message = 'An event can have at most 5 pictures.';
  end if;
  return new;
end;
$$;

revoke execute on function public.event_images_limit() from public;

comment on function public.event_images_limit() is 'Refuses a sixth picture for an event (P0001).';

drop trigger if exists event_images_limit on public.event_images;
create trigger event_images_limit
  before insert on public.event_images
  for each row execute function public.event_images_limit();

-- ---------------------------------------------------------------------------------------------
-- Existing flyers become the main picture.
-- ---------------------------------------------------------------------------------------------
insert into public.event_images (event_id, storage_path, url, position, created_at)
select e.id,
       coalesce(substring(e.cover_url from '/storage/v1/object/public/event-covers/([^?#]+)'), ''),
       e.cover_url,
       0,
       e.updated_at
  from public.events e
 where e.cover_url is not null
   and char_length(e.cover_url) between 1 and 2000
   and not exists (select 1 from public.event_images i where i.event_id = e.id);

-- ---------------------------------------------------------------------------------------------
-- Row-level security and grants: the API role only.
-- ---------------------------------------------------------------------------------------------
alter table public.event_images enable row level security;
revoke all on table public.event_images from anon, authenticated;

grant select, insert, update, delete on table public.event_images to gventz_api;
drop policy if exists "api_all" on public.event_images;
create policy "api_all" on public.event_images for all to gventz_api using (true) with check (true);
