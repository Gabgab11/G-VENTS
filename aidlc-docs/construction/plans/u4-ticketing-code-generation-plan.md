# U4 Ticketing — Code Generation Plan

This plan is the single source of truth for U4 code generation. The work is done in two passes, and each step is ticked as soon as it's done.

## Unit Context
- **Design:**
  - `u4-ticketing/functional-design/{domain-entities,business-rules,business-logic-model}.md`
  - `u4-ticketing/nfr-requirements/`
  - `u4-ticketing/nfr-design/{nfr-design-patterns,logical-components}.md`
- **Code locations:**
  - `/Users/payazaafrica/gventz-api/src/modules/ticketing/`, `src/modules/notifications/` (new), small additions in `src/platform/`
  - G-VENTS `supabase/migrations/` and `supabase/tests/`
- **Depends on:**
  - U1: UnitOfWork, outbox, queues, rate limits, breaker, metrics
  - U2: `CurrentUser`, verified email from the token, `ProfileProvisioner`
  - U3: `EventPermissionGuard`, `QuestionCatalog`, `EventSummaryReader`, the `TicketingStats` port
- **Exposes:** `TicketingStats` (replaces the U3 read-side default); later, inventory hooks for U7 (`applyPayment`, holds), which are not built now.
- **Stories:**
  - pass 1: US-2.4 (enforced), US-3.1, US-3.2, US-3.5, US-8.1, US-8.2, US-8.3
  - pass 2: US-3.3, US-3.4, US-7.3, plus ideas I1 (in pass 1, with the email), I2, I3, I4, I7
- **Not committed** (as with U1–U3).

## Pass 1 — Ordering, Tickets, Check-in, Email

### Step 1 — Migrations (G-VENTS, additive, AD17)
- [x] `20261025000100_orders.sql`: the `orders` table (domain-entities), RLS on, `api_all` for `gventz_api`, anon and authenticated revoked, status and kind checks.
- [x] `20261025000200_registrations_orders.sql`:
  - `order_id` (cascade), `ticket_number`, `guest_name`
  - `declined` added to the status check
  - indexes `(order_id)`, `(event_id, user_id, status)`, `(event_id, created_at desc)`
  - drop `registrations_one_active_per_user`
- [x] `20261025000300_events_active_count.sql`: the column, backfill, check `>= 0`, and the `registrations_active_count` trigger.
- [x] pgTAP: trigger on insert, status change and delete; the declined status; grants; the old index is gone.
- [x] Regenerate `src/lib/supabase/database.types.ts`; update the API's `tables.ts` and drift test; run the Supabase CLI test. — *44/44 pgTAP; drift test 16/16; `orders.currency` is `text` with a check (the drift test has no `char` mapping)*
- [x] Check that the current app's `register_guest` still works (pgTAP calling it twice for one user: the second call is refused). — *covered in `ticketing_orders.test.sql`; the backfill and trigger run in one `DO` block because the CLI applies migrations outside a transaction block*

### Step 2 — Platform additions (U1)
- [x] `PG_LOCK_NOT_AVAILABLE = '55P03'`.
- [x] Rate-limit policies `orders.place`, `checkin.scan`, `guests.read`, `guests.export`. — *`modules/ticketing/application/rate-limits.ts`; subjects are prefixed `user:` / `ip:` because both order limits share the fail-closed name*
- [x] Settings: `EMAIL_PROVIDER`, `EMAIL_FALLBACK_PROVIDER`, `EMAIL_RATE_PER_SECOND`, `ZEPTOMAIL_*`, `PUBLIC_WEB_URL`, `ORDER_LOCK_TIMEOUT_MS`, `EXPORT_CONCURRENCY`, with validation rules. — *each provider's key is required on production workers when it is primary or fallback; fallback must differ; `PUBLIC_WEB_URL` required in production; new `TicketingConfig` section*
- [x] Log redaction paths.
- [x] `email_queue_oldest_age_ms` gauge. — *not added: U1's `queue_oldest_age_ms{queue="email"}` already measures it; the alert uses that*

### Step 3 — Ticketing domain
- [x] Value objects: `TicketCode`, `GuestName`, `Quantity`, `ScanResult`, `OrderLines`. — *`PersonName` + `parseGuestNames` cover guest and buyer names; `Quantity` lives in `OrderLines.parse`*
- [x] `AnswerSet`, reusing U3 `QuestionCatalog` definitions.
- [x] `Order` (transitions §6), `Ticket` (display name, `checkIn`), `EventInventory.admit`, `BuyerAllowance`.
- [x] Errors (business-rules §14, including `order.busy`); domain events.
- [x] Ports: `EventInventoryRepository`, `OrderRepository`, `TicketRepository`, `TicketQueries`.

### Step 4 — Domain tests
- [x] Example tests for OR1–OR7, the §2 table, CI1, and display names. — *41 example tests*
- [x] PBT (business-logic-model §8):
  - `admit` oracle
  - inventory sequence (stateful)
  - `BuyerAllowance` invariant
  - transition oracle
  - `AnswerSet` invariant and idempotence
  - *4 property suites; the stateful one also checks the inventory's own `sold` and active count after every step; builders in `test/support/ticketing-fixtures.ts`*

### Step 5 — Application (pass 1)
- [x] `OrderService.placeFreeOrder`: `@Transactional`, `SET LOCAL lock_timeout`, translating `55P03` to `OrderBusyError`, metrics.
- [x] `CheckInService.scan` and `checkInById`: the conditional update; re-read on 0 rows.
- [x] `TicketQueryService.getTicket`.
- *Also: the scan accepts the bare code or the scanned ticket link (`…/t/{code}`); `guests.export` added to the U3 permission matrix; unit tests with fakes for the check-in race, buyer name and busy translation (8 tests)*

### Step 6 — Infrastructure (pass 1)
- [x] `DrizzleEventInventoryRepository` (lock order), `DrizzleOrderRepository`, `DrizzleTicketRepository` (multi-row insert).
- [x] `DrizzleTicketQueries`: the ticket page.
- [x] `QrPng` (ported from G-VENTS `src/lib/qr.ts` and `qr-png.ts`, with its tests); `IcsWriter` with round-trip PBT. — *QR verified by decoding with `jsqr` 1.4.0 (dev dependency; the current app's referenced decoder test didn't exist); strict-index fixes only, no logic change. The ICS property found that `;` wasn't escaped: fixed, and the property now checks for bare `;` and `,`*

### Step 7 — Notifications module
- [x] The `Mailer` port and error classes.
- [x] `ResendMailer` and `ZeptoMailMailer` (`fetch`), with contract tests against the documented request formats (no network).
- [x] `FailoverMailer` (a breaker per provider, Q1 A); `SentMarker` (Redis `SET NX`).
- [x] `EmailSuppressionReader`.
- [x] Templates for tickets, pending and waitlisted (declined comes in pass 2), with snapshot tests.
- [x] `TicketEmailProcessor` (limiter, `worker.rateLimit` on 429); outbox routes.
- *Built as `OrderEmailService` + `OrderEmailWorker` (a BullMQ `Worker` started only where APP_ROLE runs workers). Ticketing exposes `OrderMailFactsReader`, `qrPng`, `writeIcs`, `ticketUrl`. Email breakers trip after 5 calls in 30 s (`BREAKER_SETTINGS`). All four templates are built now (declined included). The marker and failover refinements are recorded in nfr-design §5. ZeptoMail's docs now show host `cpaas.zoho.com`: `ZEPTOMAIL_API_URL` is a setting, to be confirmed under O20. 20 tests.*

### Step 8 — Presentation (pass 1)
- [x] `POST /v1/events/{id}/orders`
- [x] `GET /v1/tickets/{code}`
- [x] `POST /v1/events/{id}/check-in`
- [x] `POST /v1/events/{id}/guests/{ticketId}/check-in`
- [x] DTOs, validation, Swagger, `Retry-After` on `order.busy`. — *the problem-details filter now sends `Retry-After` for any domain error that carries `retryAfterSeconds` (rate limits, `order.busy`, `export.busy`)*

### Step 9 — Wiring and integration tests (pass 1)
- [x] `ticketing.module.ts`, `notifications.module.ts`, and their `index.ts` files; register them in `AppModule`; regenerate OpenAPI.
- [x] Integration tests:
  - **Orders:**
    - a group of 4 across 2 types
    - limit, sold out, not enough places, waitlisted when full, pending when approval is required
    - paid → 422; closed → 409
    - answers required and invalid
    - guest names
    - the ticket email goes to the verified email
  - **Concurrency:**
    - 200 parallel orders on capacity 50: exactly 50 tickets, `active_count` correct
    - parallel orders by one buyer stay within the limit
    - a held event lock gives `order.busy` after the timeout
  - **Check-in:** green, `already_used` (with the staff name), wrong event, not found, pending; parallel scans give exactly one green; stranger → 404; viewer without permission → 403.
  - **Email:**
    - the outbox delivers to the processor
    - failover when the primary breaker is open
    - no double send on retry
    - a suppressed address is skipped
    - a 429 pauses the queue *(failover and 429 handling are covered by unit tests with a real circuit breaker and the worker's error mapping; the integration tests cover delivery, no double send and suppression)*
  - **Compatibility:** the current app's `register_guest` and the API on the same event keep `active_count` and `sold` right.
- [x] Pass 1 verification: lint, typecheck, unit and PBT, integration, build, `openapi:check`, Supabase CLI; smoke run against the local server. — *green 2026-10-25: 280 unit/PBT, 79 integration (16 new for ticketing), Supabase CLI 44/44, build, `openapi:check` (23 paths). Smoke run on the built server (APP_ROLE=all) against a disposable database: order → limit → ticket page → scan green → already_used → email worker → stub provider (3 QR + .ics) → counters exact*

## Pass 2 — Approval, Waiting List, Guest List, Export, My Tickets, Stats

### Step 10 — Application and infrastructure (pass 2)
- [x] `OrderService.approve`, `decline` (message), `promoteNext` (oldest that fits, including tickets from before go-live); audit entries.
- [x] `TicketQueryService.guestList` (filters, search, sort, totals in one statement) and `myOrders` / `myOrder` (keyset).
- [x] `GuestExportService`:
  - `CsvWriter` with an injection prefix and round-trip PBT
  - keyset streaming from the `reports` pool
  - semaphore → `export.busy`
  - audit
- [x] `TicketingStatsService` replaces the U3 `DrizzleTicketingStats` default.
- [x] Declined email template. — *built in pass 1 with the others*
- *A waiting ticket from before go-live is promoted by giving it its own order (ticket 1 of 1), so it is emailed like any order. Ticketing provides `TicketingStats` through a small global module (no module cycle with Events); dashboard counts gain `declined`. Keyset cursors use the exact stored timestamp: tickets of one order share a `created_at`, and a millisecond JS date would have skipped rows at batch boundaries.*

### Step 11 — Presentation (pass 2)
- [x] `POST /v1/events/{id}/orders/{orderId}/approve`
- [x] `POST /v1/events/{id}/orders/{orderId}/decline`
- [x] `POST /v1/events/{id}/waitlist/promote`
- [x] `GET /v1/events/{id}/guests`, `GET /v1/events/{id}/guests.csv`
- [x] `GET /v1/me/orders`, `GET /v1/me/orders/{orderId}`

### Step 12 — Integration tests (pass 2)
- [x] **Approval:** approve, decline, approve twice → 409, another event's order → 404.
- [x] **Waiting list:** promote fits, none fits, empty; a ticket from before go-live is promoted.
- [x] **Guest list:** filters, domain search, code prefix, sort, totals; editor allowed; stranger → 404.
- [x] **CSV:** columns, BOM, injection prefix, 20,000 rows streamed under 10 s, finance allowed, editor → 403, audit row written.
- [x] **My tickets:** upcoming and past, another user's order → 404.
- [x] **Stats:** dashboard and deletion counts match. — *10 tests; full integration suite 89/89*

### Step 13 — Ops, load tests and docs
- [x] `ops/grafana/alerts.yaml`: the 5 new alerts, with runbook pages in `docs/runbooks/`; `ticketing.json` panels. — *18 rules; the generic queue alert excludes the email queue; dashboard rebuilt on real metric names (U1 placeholders weren't emitted); `tx_retries_total` and `ticketing_orders_refused_total` added*
- [x] `test/load/` k6 scenarios and a seed script (staging only; run in Build and Test).
- [x] `.env.example`, README, `render.yaml` (new settings, secrets marked `sync: false`).
- [x] `aidlc-docs/construction/u4-ticketing/code/code-summary.md`.
- [x] Final verification: lint, typecheck, all tests, build, `openapi:check`, Docker build, smoke run. — *2026-10-25: lint and typecheck clean; 282 unit/PBT; 89 integration; Supabase CLI 44/44; build; `openapi:check` (30 paths); Docker image built (after re-pulling the pinned base image; the first try hit a local Docker cache error); smoke against the image: 11/11 steps, no warnings or errors logged*
