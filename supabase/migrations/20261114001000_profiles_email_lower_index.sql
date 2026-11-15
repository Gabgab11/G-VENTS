-- An index for finding a profile by email, case-insensitively (Change 3, I4/I6): gventz-api looks up
-- the language of an email's recipient with `lower(email) = $1` before each email it sends, once
-- languages other than English are switched on (EMAIL_LANGUAGES). Without this it scans profiles.
-- Not unique: profiles.email has its own unique constraint, and older rows may differ only in case.

set local lock_timeout = '5s';

create index if not exists profiles_email_lower_idx on public.profiles (lower(email));
