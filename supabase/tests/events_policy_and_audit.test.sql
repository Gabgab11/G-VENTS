-- Change 1 / U3: purchase policy columns and audit rows kept on event delete.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'host@example.com', 'authenticated', 'authenticated');
insert into public.events (id, owner_id, title, slug, category, starts_at) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Policy', 'policy-ev', 'Music', now());

select is((select per_buyer_limit from public.events where id = '33333333-3333-3333-3333-333333333333'), 10,
  'new events allow 10 tickets per buyer by default');
select is((select fee_choice from public.events where id = '33333333-3333-3333-3333-333333333333'), 'host_absorbs',
  'the host absorbs fees by default');
select throws_ok($$update public.events set per_buyer_limit = 11 where id = '33333333-3333-3333-3333-333333333333'$$,
  '23514', null, 'the per-buyer limit is at most 10');
select throws_ok($$update public.events set fee_choice = 'split' where id = '33333333-3333-3333-3333-333333333333'$$,
  '23514', null, 'fee choice is host_absorbs or guest_pays');

insert into public.audit_log (event_id, actor_id, action) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'event.deleted');
delete from public.events where id = '33333333-3333-3333-3333-333333333333';
select is((select count(*)::int from public.audit_log where action = 'event.deleted' and event_id is null
  and actor_id = '11111111-1111-1111-1111-111111111111'), 1, 'audit rows survive event deletion');

select * from finish();
rollback;
