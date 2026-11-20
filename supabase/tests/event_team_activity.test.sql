-- Event team invitations and the activity log (20261114001300). Rolled back after the run.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'team-host@example.com', 'authenticated', 'authenticated');
insert into public.events (id, owner_id, title, slug, category, starts_at, status, visibility) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Team', 'team-ev',
   'Music', now() + interval '7 days', 'published', 'public');

select has_table('public', 'event_invites', 'the event invitations table exists');
select has_table('public', 'event_activity', 'the event activity table exists');
select table_privs_are('public', 'event_invites', 'gventz_api', array['SELECT', 'INSERT', 'UPDATE'],
  'the API can read, add and settle invitations, never delete them');
select table_privs_are('public', 'event_activity', 'gventz_api', array['SELECT', 'INSERT'],
  'the API can only read and append activity');

set local role gventz_api;
select lives_ok(
  $$insert into public.event_invites (event_id, email, role, token_hash, invited_by, expires_at) values
    ('33333333-3333-3333-3333-333333333333', 'guest@example.com', 'editor', repeat('a', 64),
     '11111111-1111-1111-1111-111111111111', now() + interval '7 days')$$,
  'the API can store an invitation');
select throws_ok(
  $$insert into public.event_invites (event_id, email, role, token_hash, expires_at) values
    ('33333333-3333-3333-3333-333333333333', 'other@example.com', 'owner', repeat('b', 64), now() + interval '7 days')$$,
  '23514', null, 'nobody can be invited as owner');
select throws_ok(
  $$insert into public.event_invites (event_id, email, role, token_hash, expires_at) values
    ('33333333-3333-3333-3333-333333333333', 'Upper@Example.com', 'viewer', repeat('c', 64), now() + interval '7 days')$$,
  '23514', null, 'invited emails are lower-case');
select throws_ok(
  $$insert into public.event_invites (event_id, email, role, token_hash, expires_at) values
    ('33333333-3333-3333-3333-333333333333', 'raw@example.com', 'viewer', 'not-a-hash', now() + interval '7 days')$$,
  '23514', null, 'only a SHA-256 hex hash is stored, never the token');
select throws_ok(
  $$insert into public.event_invites (event_id, email, role, token_hash, expires_at) values
    ('33333333-3333-3333-3333-333333333333', 'guest@example.com', 'viewer', repeat('d', 64), now() + interval '7 days')$$,
  '23505', null, 'one open invitation per event and email');
select throws_ok(
  $$insert into public.event_invites (event_id, email, role, token_hash, expires_at) values
    ('33333333-3333-3333-3333-333333333333', 'third@example.com', 'viewer', repeat('a', 64), now() + interval '7 days')$$,
  '23505', null, 'token hashes are unique');

select lives_ok(
  $$insert into public.event_activity (event_id, actor_id, action, subject, meta) values
    ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'event.edited', null, '{"fields":["title"]}')$$,
  'the API can append activity');
select throws_ok(
  $$update public.event_activity set action = 'event.published' where event_id = '33333333-3333-3333-3333-333333333333'$$,
  '42501', null, 'activity cannot be changed');
reset role;

select throws_ok(
  $$delete from public.event_activity where event_id = '33333333-3333-3333-3333-333333333333'$$,
  '42501', null, 'activity cannot be deleted on its own, even by the owner');

set local role authenticated;
select throws_ok($$select count(*) from public.event_invites$$, '42501', null, 'signed-in users cannot read invitations');
select throws_ok($$select count(*) from public.event_activity$$, '42501', null, 'signed-in users cannot read activity');
reset role;

delete from public.events where id = '33333333-3333-3333-3333-333333333333';
select is((select count(*)::int from public.event_activity where event_id = '33333333-3333-3333-3333-333333333333'), 0,
  'deleting the event removes its activity');

select * from finish();
rollback;
