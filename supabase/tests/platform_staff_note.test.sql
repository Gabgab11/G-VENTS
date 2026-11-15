-- 20261114001100: the bootstrap staff member has no "founder" label and is still staff. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);
select is((select count(*)::int from public.platform_staff where note = 'founder'), 0, 'nobody is labelled founder');
select is((select count(*)::int from public.platform_staff where email = 'stefaneey@gmail.com'), 1, 'stefaneey@gmail.com is still staff');
select * from finish();
rollback;
