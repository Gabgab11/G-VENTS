-- profiles.language (20261114000900, Change 3 FR-23.3): the seven languages or nothing, changed
-- only through gventz-api. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, aud, role) values
  ('22222222-2222-2222-2222-222222222222', 'guest@example.com', 'authenticated', 'authenticated');
insert into public.profiles (id, email) values ('22222222-2222-2222-2222-222222222222', 'guest@example.com')
  on conflict (id) do nothing;

select has_column('public', 'profiles', 'language', 'profiles have a language');
select col_is_null('public', 'profiles', 'language', 'the language is optional');
set local role gventz_api;
select lives_ok(
  $$do $t$ declare l text; begin
      foreach l in array array['en', 'es', 'fr', 'de', 'zh-Hans', 'pt', 'ar'] loop
        update public.profiles set language = l where id = '22222222-2222-2222-2222-222222222222';
      end loop;
    end $t$$$,
  'gventz_api can save each of the seven languages');
select throws_ok(
  $$update public.profiles set language = 'EN' where id = '22222222-2222-2222-2222-222222222222'$$,
  '23514', null, 'codes are exact: EN is refused');
select throws_ok(
  $$update public.profiles set language = 'pt-BR' where id = '22222222-2222-2222-2222-222222222222'$$,
  '23514', null, 'only the seven codes: pt-BR is refused');
reset role;

select throws_ok(
  $$update public.profiles set language = '' where id = '22222222-2222-2222-2222-222222222222'$$,
  '23514', null, 'an empty language is refused');

set local role authenticated;
select throws_ok(
  $$update public.profiles set language = 'fr' where id = '22222222-2222-2222-2222-222222222222'$$,
  '42501', null, 'signed-in users cannot change it directly');
reset role;

select * from finish();
rollback;
