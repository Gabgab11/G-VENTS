-- 20261114001700: event pictures, at most 5 per event, position 0 the main one. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

select has_table('public', 'event_images', 'event_images exists');
select col_is_pk('public', 'event_images', 'id', 'id is the primary key');
select col_type_is('public', 'event_images', 'position', 'smallint', 'position is a smallint');
select ok((select relrowsecurity from pg_class where oid = 'public.event_images'::regclass), 'row-level security is on');
select is(
  (select array_agg(policyname::text) from pg_policies where schemaname = 'public' and tablename = 'event_images' and roles <> array['gventz_api']::name[]),
  null, 'every policy is for gventz_api only');
select ok(not has_table_privilege('anon', 'public.event_images', 'select')
  and not has_table_privilege('authenticated', 'public.event_images', 'select'), 'visitors and signed-in users cannot read it directly');
select ok(has_table_privilege('gventz_api', 'public.event_images', 'select, insert, update, delete'), 'the API role reads and writes it');

insert into auth.users (id, email, aud, role) values
  ('c4170000-0000-0000-0000-000000000001', 'c417-host@example.com', 'authenticated', 'authenticated');
insert into public.events (id, owner_id, title, slug, category, starts_at) values
  ('c4170000-0000-0000-0000-0000000000e1', 'c4170000-0000-0000-0000-000000000001', 'C417 pictures', 'c417-pictures', 'Business', now() + interval '7 days'),
  ('c4170000-0000-0000-0000-0000000000e2', 'c4170000-0000-0000-0000-000000000001', 'C417 other', 'c417-other', 'Business', now() + interval '7 days');

-- Backfill shape: what the migration's backfill wrote for existing flyers.
select is(
  (select count(*)::int from public.events e where e.cover_url is not null
     and not exists (select 1 from public.event_images i where i.event_id = e.id and i.position = 0 and i.url = e.cover_url)),
  0, 'every event that had a flyer has it as picture 0 (as of the migration)');
select is(
  (select count(*)::int from public.event_images
     where storage_path <> '' and url not like '%/storage/v1/object/public/event-covers/' || storage_path || '%'),
  0, 'a backfilled storage_path is the object path from the public URL');

set local role gventz_api;
insert into public.event_images (event_id, storage_path, url, position)
select 'c4170000-0000-0000-0000-0000000000e1', 'c4170000-0000-0000-0000-0000000000e1/' || p || '.jpg', 'https://x.test/' || p || '.jpg', p
  from generate_series(0, 4) p;
select is((select count(*)::int from public.event_images where event_id = 'c4170000-0000-0000-0000-0000000000e1'), 5, 'five pictures are fine');

select throws_ok(
  $$insert into public.event_images (event_id, storage_path, url, position)
    values ('c4170000-0000-0000-0000-0000000000e1', 'x', 'https://x.test/6.jpg', 4)$$,
  'P0001', 'An event can have at most 5 pictures.', 'a sixth picture is refused with a clear message');

select throws_ok(
  $$insert into public.event_images (event_id, storage_path, url, position)
    values ('c4170000-0000-0000-0000-0000000000e2', 'x', 'https://x.test/5.jpg', 5)$$,
  '23514', null, 'positions go from 0 to 4');

-- Two pictures at one position: checked at commit (deferred), so force it now.
insert into public.event_images (event_id, storage_path, url, position)
  values ('c4170000-0000-0000-0000-0000000000e2', 'a', 'https://x.test/a.jpg', 0),
         ('c4170000-0000-0000-0000-0000000000e2', 'b', 'https://x.test/b.jpg', 0);
select throws_ok($$set constraints event_images_event_position_key immediate$$, '23505', null,
  'two pictures cannot share a position');
reset role;
delete from public.event_images where event_id = 'c4170000-0000-0000-0000-0000000000e2';
set constraints event_images_event_position_key deferred;

-- A reorder that swaps positions inside one transaction is fine (deferred unique).
set local role gventz_api;
update public.event_images set position = case position when 0 then 1 when 1 then 0 else position end
 where event_id = 'c4170000-0000-0000-0000-0000000000e1';
select lives_ok($$set constraints event_images_event_position_key immediate$$, 'a swap of two positions passes the unique check');
select is((select url from public.event_images where event_id = 'c4170000-0000-0000-0000-0000000000e1' and position = 0),
  'https://x.test/1.jpg', 'the swap took');
reset role;

delete from public.events where id = 'c4170000-0000-0000-0000-0000000000e1';
select is((select count(*)::int from public.event_images where event_id = 'c4170000-0000-0000-0000-0000000000e1'), 0,
  'deleting the event deletes its pictures');

select * from finish();
rollback;
