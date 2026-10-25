# U4 Ticketing — Code Summary

**Plan:** `construction/plans/u4-ticketing-code-generation-plan.md` (13 steps, two passes, all ticked).

**Code:**
- `/Users/payazaafrica/gventz-api`: `src/modules/ticketing/`, `src/modules/notifications/`, platform additions.
- G-VENTS: `supabase/migrations/`, `supabase/tests/`, regenerated `src/lib/supabase/database.types.ts`.

**Stories:** US-2.4 (enforced), US-3.1–3.5, US-7.3, US-8.1–8.3; ideas I1 (calendar file), I2 (guest search and filters), I3 (CSV), I4 (declined), I7 (my tickets).

**Commits:** none made by the AI. The product owner committed pass 1 in gventz-api (`975bc5b`); the pass 2 changes are uncommitted.

## Database (G-VENTS, additive, AD17)

| Migration | What |
|---|---|
| `20261025000100_orders.sql` | `orders`: status, kind, ticket count, answers, currency, amount, decision fields. RLS on, API role only. |
| `20261025000200_registrations_orders.sql` | Tickets get `order_id`, `ticket_number` (unique per order), `guest_name`; `declined` status; indexes for allowance, guest list and keyset paging; drops `registrations_one_active_per_user` |
| `20261025000300_events_active_count.sql` | `events.active_count` (confirmed + pending): check `>= 0`, backfill, `registrations_active_count` trigger (security definer); `events_touch` ignores count-only changes |

- **pgTAP** (`ticketing_orders.test.sql`, 16 tests): RLS and grants, trigger on insert, status change and delete, declined, ticket number uniqueness, cascade delete, and the current app's `register_guest` still working and still refusing a second registration.
- The backfill and trigger creation run in one `DO` block, because the Supabase CLI applies migrations outside a transaction block.

## API (gventz-api)

| Area | Components |
|---|---|
| Ticketing domain | `Order` (transition table), `EventInventory.admit/fits/promote/release`, `OrderLines`, `AnswerSet`, `issueTickets`, `displayName`, `scanVerdict`, `TicketCode` (bare code or scanned link), errors including `order.busy` (503 + Retry-After) and `export.busy` (429) |
| Ticketing application | `OrderService` (lock wait limit → `order.busy`), `OrderDecisionService` (approve, decline, promote; a waiting ticket from before go-live gets its own order), `CheckInService`, `TicketQueryService` (ticket page, guest list, my orders), `GuestExportService` (streamed CSV, semaphore, audit), `CsvWriter`, rate limits |
| Ticketing infrastructure | Drizzle repositories (fixed lock order), ticket, guest and mail-facts queries (exact-timestamp keyset cursors), `DrizzleTicketingStats` via a global `TicketingStatsModule`, QR encoder (ported), ICS writer |
| Notifications | `Mailer` port; `ResendMailer`, `ZeptoMailMailer`; `FailoverMailer` (breaker per provider, decided before the call); `RedisSentMarker`; `DrizzleEmailSuppressions`; four templates; `OrderEmailService`; `OrderEmailWorker` (BullMQ limiter, `rateLimit` on 429, unrecoverable on rejection); outbox routes |
| Platform | Settings (`EMAIL_PROVIDER`, `EMAIL_FALLBACK_PROVIDER`, `EMAIL_RATE_PER_SECOND`, `ZEPTOMAIL_*`, `PUBLIC_WEB_URL`, `ORDER_LOCK_TIMEOUT_MS`, `EXPORT_CONCURRENCY`) with validation; `PG_LOCK_NOT_AVAILABLE`; `BREAKER_SETTINGS` for email; `Retry-After` for any domain error carrying it; `tx_retries_total`; redaction of names and emails; new audit actions |
| Events (U3) changes | `guests.export` permission; `DashboardCounts.declined`; the temporary `DrizzleTicketingStats` removed (Ticketing provides it) |

**Routes (11 new):**
- `POST /v1/events/{id}/orders`
- `POST /v1/events/{id}/orders/{orderId}/approve`, `…/decline`
- `POST /v1/events/{id}/waitlist/promote`
- `POST /v1/events/{id}/check-in`, `…/guests/{ticketId}/check-in`
- `GET /v1/events/{id}/guests`, `…/guests.csv`
- `GET /v1/tickets/{code}`
- `GET /v1/me/orders`, `…/{orderId}`

OpenAPI now has 30 paths.

## Ops and docs
- `ops/grafana/alerts.yaml`: 5 new alerts. The generic queue alert now excludes the email queue, which has its own 15-minute alert.
- Runbooks: `order-busy`, `orders-from-one-ip`, `email-delivery`, `tx-retries`; queue-backlog and pre-scale updated (email rate and fallback, door fallback).
- `ops/grafana/dashboards/ticketing.json`: rebuilt on the real metric names (14 panels). The U1 placeholders weren't emitted by any code.
- `test/load/`: k6 `orders-burst`, `orders-spread`, `checkin`, `browse`, a staging-only seed script, and the no-oversell SQL check.
- `.env.example`, `render.yaml` (provider keys `sync: false`, `PUBLIC_WEB_URL`, the email rate), README section.

## Verification (2026-10-25)

| Check | Result |
|---|---|
| Unit and property tests | 282 passed |
| Integration (Testcontainers, supabase/postgres + Redis) | 89 passed (26 new: 16 ticketing, 10 ticketing-manage) |
| Supabase CLI `test db` | 44/44 |
| Lint, typecheck, build, `openapi:check` | pass |
| Docker image | builds (pinned `node:22-slim` digest) |
| Smoke (production image, APP_ROLE=all, disposable database, stub email provider) | order → limit → ticket page → scan green → already_used → guest list → CSV → my tickets → email with 3 QR + .ics → exact counters |

## Found and fixed during generation
- **ICS:** `;` wasn't escaped (`'\;'` is `;` in JavaScript); the example test asserted the same wrong text. Lint caught it; the property now checks for bare `;` and `,`.
- **Keyset paging:** tickets of one order share a `created_at` with microseconds, and a JS `Date` keeps milliseconds, so a CSV batch boundary inside an order would have skipped tickets. Cursors now carry the exact stored timestamp. The integration test cuts 20 batches through 10-ticket orders and checks all 19,991 rows come out once.
- **Failover:** a timeout also surfaces as "unavailable", but the primary may have accepted the email. The fallback is now chosen only when the breaker is already open before the call.
- **Sent marker:** written after a successful send (a rare duplicate is possible; a lost email isn't).
- **Legacy waiting tickets:** promotion gives them an order with the right buyer, answers and event currency, so they're emailed like any order.
- **Export slot:** released when the stream closes, even if the client leaves before reading.
- **Lock order on approve:** approve takes the event lock first, like every inventory writer.

## Deferred or noted
- **Failover and 429 pause:** covered by unit tests (real circuit breaker, worker error mapping), not by an integration test with a running worker.
- **ZeptoMail host:** the docs now show `cpaas.zoho.com`. `ZEPTOMAIL_API_URL` is a setting; confirm the host with the account (O20).
- **My-tickets page path:** `/my-tickets` is used in emails; U6a must serve it.
- **Guest search:** `ILIKE`; add a trigram index only if the load test shows the guest list over 100 ms p95.
