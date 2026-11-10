-- Database tests for platform staff (Change 1 / U2). Rolled back after the run.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select has_table('public', 'platform_staff', 'the platform staff table exists');
select table_privs_are('public', 'platform_staff', 'gventz_api', array['SELECT'],
  'the API can only read the staff list');
select throws_ok($$insert into public.platform_staff (email) values ('Upper@Example.com')$$,
  '23514', null, 'staff emails must be lowercase');

set local role gventz_api;
select is((select count(*)::int from public.platform_staff where email = 'stefaneey@gmail.com'), 1,
  'the API role sees the seeded staff member');

reset role;
set local role authenticated;
select throws_ok($$select count(*) from public.platform_staff$$, '42501', null,
  'signed-in users cannot read the staff list');

select * from finish();
rollback;
