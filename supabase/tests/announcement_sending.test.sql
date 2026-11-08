-- Database tests for sending announcements (change request C2).
-- Run by `supabase test db`. Rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select has_table('public', 'email_campaign_recipients', 'sent announcements keep their audience');
select table_privs_are('public', 'email_campaign_recipients', 'gventz_api', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'the API reads and writes recipients');
select table_privs_are('public', 'email_campaign_recipients', 'anon', array[]::text[], 'visitors have no rights on recipients');
select table_privs_are('public', 'email_campaign_recipients', 'authenticated', array[]::text[], 'signed-in users have no rights on recipients');
select is((select relrowsecurity from pg_class where oid = 'public.email_campaign_recipients'::regclass), true, 'row-level security is on');

insert into auth.users (id, email, aud, role) values
  ('c2000000-0000-0000-0000-000000000001', 'c2-host@example.com', 'authenticated', 'authenticated');
insert into public.events (id, owner_id, title, slug, category, starts_at)
  values ('c2000000-0000-0000-0000-0000000000e1', 'c2000000-0000-0000-0000-000000000001', 'C2 announcements', 'c2-test', 'Business', now() + interval '7 days');
insert into public.email_campaigns (id, event_id, created_by, subject, body, segment)
  values ('c2000000-0000-0000-0000-0000000000a1', 'c2000000-0000-0000-0000-0000000000e1', 'c2000000-0000-0000-0000-000000000001', 's', 'b', 'all');
insert into public.email_campaign_recipients (campaign_id, email) values ('c2000000-0000-0000-0000-0000000000a1', 'Ada@example.com');

select matches((select token from public.email_campaign_recipients limit 1), '^[0-9a-f]{32}$', 'each recipient gets an unguessable unsubscribe token');
select throws_ok(
  $$insert into public.email_campaign_recipients (campaign_id, email) values ('c2000000-0000-0000-0000-0000000000a1', 'ada@EXAMPLE.com')$$,
  '23505', null, 'one email per address per announcement, ignoring case');
select throws_ok(
  $$update public.email_campaign_recipients set status = 'bounced'$$,
  '23514', null, 'recipient status is one of queued, sent, skipped, failed');

select * from finish();
rollback;
