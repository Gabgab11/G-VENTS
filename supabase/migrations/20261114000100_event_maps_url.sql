-- A Google Maps link per venue (LO6): the host can paste one when creating or editing an event, and
-- guests' "Get directions" opens it. Optional and additive, so existing rows and the current API
-- release keep working (expand before contract). The API validates the host (google.*/maps,
-- maps.google.*, maps.app.goo.gl, goo.gl/maps); the database only keeps it https and bounded.
-- gventz_api already has select/insert/update on public.events, which covers the new column.

set lock_timeout = '5s';

alter table public.events add column if not exists maps_url text;

alter table public.events drop constraint if exists events_maps_url_check;
alter table public.events add constraint events_maps_url_check
  check (maps_url is null or (maps_url like 'https://%' and length(maps_url) <= 500));
