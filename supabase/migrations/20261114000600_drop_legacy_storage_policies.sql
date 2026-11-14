-- Drop the old app's storage policies on the event-covers bucket, and the helper only they used.
--
-- Who uses the bucket now:
--   - gventz-api, with the project's secret key, which skips RLS: it signs upload URLs, reads the
--     uploaded file's first bytes, lists and removes objects (gventz-api
--     src/modules/media/infrastructure/supabase-storage.ts).
--   - Hosts' browsers upload to those signed URLs. The signed token authorises the upload, not RLS.
--   - Everyone reads flyers through /storage/v1/object/public/event-covers/...: the bucket is
--     public, and public URLs don't go through RLS.
-- The website no longer uses Supabase Storage directly.
--
-- So none of these policies is needed, and they widen access:
--   - "event covers are public" (SELECT, to public) lets anyone holding the publishable key list the
--     whole bucket, and with it the folder names, which are event ids, including drafts and
--     private events.
--   - The "hosts ... their event covers" set and the event_covers_* set both grant signed-in users
--     direct writes, bypassing the API's checks (the event permission, the file type check on the
--     first bytes, the size limit and the flyer path format).
-- The "hosts ..." set and the SELECT policy were created by hand on the live databases (not in any
-- migration), hence `if exists`.
--
-- Not changed: the bucket itself (public, 5 MB, jpeg/png/webp), its objects, has_event_role
-- (the events_guard trigger uses it).

set lock_timeout = '5s';

drop policy if exists "event covers are public" on storage.objects;
drop policy if exists "hosts upload their event covers" on storage.objects;
drop policy if exists "hosts replace their event covers" on storage.objects;
drop policy if exists "hosts delete their event covers" on storage.objects;
drop policy if exists "event_covers_insert" on storage.objects;
drop policy if exists "event_covers_update" on storage.objects;
drop policy if exists "event_covers_delete" on storage.objects;

drop function if exists public.can_manage_event_folder(text);
