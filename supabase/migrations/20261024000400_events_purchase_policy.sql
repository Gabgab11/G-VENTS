-- Purchase policy per event (Change 1 / U3 delta Δ1, D56, D42).
--   per_buyer_limit: most tickets one buyer can hold for the event (1-10, default 10). Enforced by the API.
--   fee_choice: who pays the G-ventZ fee and provider charge on paid tickets (from M4).
-- Additive with defaults, so the current app keeps working (AD17).

set lock_timeout = '5s';

alter table public.events
  add column if not exists per_buyer_limit integer not null default 10;
alter table public.events
  add column if not exists fee_choice text not null default 'host_absorbs';

alter table public.events drop constraint if exists events_per_buyer_limit_check;
alter table public.events add constraint events_per_buyer_limit_check
  check (per_buyer_limit between 1 and 10);

alter table public.events drop constraint if exists events_fee_choice_check;
alter table public.events add constraint events_fee_choice_check
  check (fee_choice in ('host_absorbs', 'guest_pays'));
