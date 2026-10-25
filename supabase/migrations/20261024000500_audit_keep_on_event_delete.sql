-- Keep audit history when an event is deleted (Change 1 / U3 delta Δ4).
-- audit_log.event_id was ON DELETE CASCADE, so deleting an event erased its audit rows,
-- including the "event.deleted" entry itself. It now becomes NULL instead.

set lock_timeout = '5s';

alter table public.audit_log drop constraint if exists audit_log_event_id_fkey;
alter table public.audit_log
  add constraint audit_log_event_id_fkey
  foreign key (event_id) references public.events(id) on delete set null;
