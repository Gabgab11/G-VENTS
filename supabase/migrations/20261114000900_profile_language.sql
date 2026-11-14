-- profiles.language (Change 3, FR-23.3): the language a signed-in user chose for the website and
-- their emails. One of the seven languages G-ventZ is offered in (D68); null until they choose.
--
-- Only gventz-api changes it (PATCH /v1/me checks the same list); gventz_api already has update on
-- profiles. Signed-in users' direct column grants (full_name, country, dashboard_theme) are not
-- widened. Adding a nullable column with a check is a metadata change, so the lock is brief.

set local lock_timeout = '5s';

alter table public.profiles
  add column language text
  constraint profiles_language_check check (language in ('en', 'es', 'fr', 'de', 'zh-Hans', 'pt', 'ar'));

comment on column public.profiles.language is
  'Chosen language (en, es, fr, de, zh-Hans, pt, ar); null = not chosen. Set through gventz-api.';
