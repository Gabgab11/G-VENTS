-- 20261114001600: events.updated_at keeps a value the writer moves forward; otherwise as before. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, aud, role) values
  ('c4160000-0000-0000-0000-000000000001', 'c416-host@example.com', 'authenticated', 'authenticated');
insert into public.events (id, owner_id, title, slug, category, starts_at)
  values ('c4160000-0000-0000-0000-0000000000e1', 'c4160000-0000-0000-0000-000000000001', 'C416 touch', 'c416-touch', 'Business', now() + interval '7 days');
-- A known starting value, set with the trigger off.
alter table public.events disable trigger events_touch;
update public.events set updated_at = '2026-01-01T00:00:00Z' where id = 'c4160000-0000-0000-0000-0000000000e1';
alter table public.events enable trigger events_touch;

update public.events set active_count = active_count + 1 where id = 'c4160000-0000-0000-0000-0000000000e1';
select is((select updated_at from public.events where id = 'c4160000-0000-0000-0000-0000000000e1'), '2026-01-01T00:00:00Z'::timestamptz,
  'an active_count-only update leaves updated_at alone');

update public.events set updated_at = '2026-06-01T00:00:00Z' where id = 'c4160000-0000-0000-0000-0000000000e1';
select is((select updated_at from public.events where id = 'c4160000-0000-0000-0000-0000000000e1'), '2026-06-01T00:00:00Z'::timestamptz,
  'a writer moving updated_at forward (ticket types changed) keeps its value');

update public.events set updated_at = '2026-02-01T00:00:00Z' where id = 'c4160000-0000-0000-0000-0000000000e1';
select is((select updated_at from public.events where id = 'c4160000-0000-0000-0000-0000000000e1'), '2026-06-01T00:00:00Z'::timestamptz,
  'moving updated_at backwards with nothing else changed is ignored');

update public.events set title = 'C416 renamed' where id = 'c4160000-0000-0000-0000-0000000000e1';
select ok((select updated_at from public.events where id = 'c4160000-0000-0000-0000-0000000000e1') > '2026-06-01T00:00:00Z'::timestamptz,
  'a real change stamps now()');

select * from finish();
rollback;
