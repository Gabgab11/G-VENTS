-- Delayed outbox jobs (Change 1 / U5 business-logic-model §4).
--
-- run_at: "don't queue before". The relay adds the job with a BullMQ delay of
-- max(0, run_at - now). Used for the once-a-minute public page refresh after
-- orders (U5 FD Q1 A). Nullable: existing rows and routes run at once.

set lock_timeout = '5s';

alter table public.outbox_events add column if not exists run_at timestamptz;
