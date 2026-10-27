-- lock_timeout for the API role (Change 1 / U4, found in Build and Test).
--
-- The order transaction waited at most 3 s for an event's row lock by sending
-- `SET LOCAL lock_timeout` first: one extra round trip inside the locked transaction on every order.
-- As a role setting (like statement_timeout in 20261024000100) it applies to every API session,
-- including through the transaction-mode pooler, and every lock wait is bounded the same way.
-- Past it Postgres raises 55P03, which the API answers as 503 order.busy (NFR design Q2 A).

set lock_timeout = '5s';

alter role gventz_api set lock_timeout = '3s';
