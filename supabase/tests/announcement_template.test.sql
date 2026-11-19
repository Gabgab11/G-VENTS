-- email_campaigns.template (20261114001500, Change 4 FR-33.3): one of five templates or nothing,
-- written by gventz-api. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, aud, role) values
  ('33333333-3333-3333-3333-333333333333', 'template-host@example.com', 'authenticated', 'authenticated');
insert into public.profiles (id, email) values ('33333333-3333-3333-3333-333333333333', 'template-host@example.com')
  on conflict (id) do nothing;
insert into public.events (id, owner_id, title, slug, category, starts_at)
  values ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Template Event', 'template-event', 'Business', now() + interval '7 days');

select has_column('public', 'email_campaigns', 'template', 'announcements have a template');
select col_is_null('public', 'email_campaigns', 'template', 'the template is optional');

set local role gventz_api;
select lives_ok(
  $$do $t$ declare v text; begin
      foreach v in array array['reminder', 'reschedule', 'lineup', 'thanks', 'feedback'] loop
        insert into public.email_campaigns (event_id, created_by, subject, body, segment, template)
        values ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 's', 'b', 'all', v);
      end loop;
    end $t$ $$,
  'gventz_api can save each of the five templates');
select lives_ok(
  $$insert into public.email_campaigns (event_id, created_by, subject, body, segment)
    values ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 's', 'b', 'all')$$,
  'an announcement without a template is still fine');
select throws_ok(
  $$insert into public.email_campaigns (event_id, created_by, subject, body, segment, template)
    values ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 's', 'b', 'all', 'line-up')$$,
  '23514', null, 'only the five ids: line-up is refused');
select throws_ok(
  $$insert into public.email_campaigns (event_id, created_by, subject, body, segment, template)
    values ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 's', 'b', 'all', 'Reminder')$$,
  '23514', null, 'ids are exact: Reminder is refused');
reset role;

select * from finish();
rollback;
