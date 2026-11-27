-- Registration links, expand/contract step 2 (Change 6, U2): now that the application always sets
-- ticket_tiers.registration_link_id (DrizzleEventRepository) and event_questions.registration_link_id
-- (DrizzleQuestionSetRepository) on insert, and U1 backfilled every existing row, tighten both columns
-- to NOT NULL. Registrations and orders stay nullable (stamped going forward; legacy rows tolerated).

set local lock_timeout = '5s';

alter table public.ticket_tiers    alter column registration_link_id set not null;
alter table public.event_questions alter column registration_link_id set not null;
