# U4 Ticketing — Logical Components

## Ticketing module (`src/modules/ticketing/`)

| Layer | Component | Responsibility |
|---|---|---|
| domain | `Order`, `Ticket`, `EventInventory`, `BuyerAllowance`, value objects (`TicketCode`, `GuestName`, `Quantity`, `AnswerSet`, `ScanResult`) | Rules in business-rules §1–§8; no I/O |
| domain | Errors (`order.*`, `waitlist.*`, `ticket.not_found`, **`order.busy`**) | Mapped to problem details |
| application | `OrderService` | place, approve, decline, promote (`@Transactional`, lock wait limit) |
| application | `CheckInService` | scan by code; check in from the guest list |
| application | `TicketQueryService` | ticket page, guest list, my orders |
| application | `GuestExportService` | streaming CSV, export semaphore (2 per instance), audit |
| application | `TicketingStatsService` | implements U3's `TicketingStats` port (replaces the U3 default) |
| infrastructure | `DrizzleEventInventoryRepository` | lock event + types in order; save `sold` |
| infrastructure | `DrizzleOrderRepository`, `DrizzleTicketRepository` | insert and update; multi-row ticket insert |
| infrastructure | `DrizzleTicketQueries` | read models; keyset paging; `reports` pool for CSV |
| infrastructure | `CsvWriter`, `IcsWriter` | pure writers (PBT round-trip) |
| infrastructure | `QrPng` | ported from the current app (`src/lib/qr.ts`, `qr-png.ts`) |
| presentation | `OrdersController`, `CheckInController`, `GuestsController`, `TicketsController`, `MeOrdersController` | routes in business-rules; DTO validation; rate-limit policies |

## Notifications module (`src/modules/notifications/`, new)

| Component | Responsibility |
|---|---|
| `Mailer` (port) | `send(message, { idempotencyKey })` → `{ provider, messageId }`; errors classified as transient, permanent or rate-limited |
| `ResendMailer` | `fetch` to `POST /emails`, `Idempotency-Key` header, attachments with `content_id` for inline images |
| `ZeptoMailMailer` | `fetch` to `POST /v1.1/email`, `Zoho-enczapikey` auth, inline images and attachments, `client_reference` |
| `FailoverMailer` | primary and optional fallback, one circuit breaker each (Q1 A); switch metric and log |
| `SentMarker` | Redis `SET NX` marker per job id (24 h) to stop double sends across retries and providers |
| `EmailSuppressionReader` | reads `email_suppressions` (global or per event) |
| `TicketEmailTemplates` | tickets, pending, waitlisted, declined: HTML + text, escaped |
| `TicketEmailProcessor` | BullMQ processor on queue `email` (worker role only), limiter from settings, `worker.rateLimit` on 429 |
| Outbox routes | `ticketing.order_completed` → `order-tickets.{orderId}`; `order_pending`, `order_waitlisted`, `order_declined` likewise |

## Platform additions (U1)
- `PG_LOCK_NOT_AVAILABLE = '55P03'` in `postgres-error.ts`. The DB error translator doesn't turn it into a 500; the Ticketing repository turns it into `OrderBusyError`.
- **Rate-limit policies:**
  - `orders.place`: user 10/min, IP 30/min
  - `checkin.scan`: user 600/min
  - `guests.read`: user 30/min
  - `guests.export`: user 30/min
- `PlatformGauges`: `email_queue_oldest_age_ms`.
- Log redaction paths extended (§6 of the patterns).

## Database (new migrations in G-VENTS, additive, AD17)
1. `orders` table, RLS on, `api_all` policy for `gventz_api`, anon and authenticated revoked.
2. `registrations`:
   - new columns `order_id`, `ticket_number`, `guest_name`
   - `declined` added to the status check
   - new indexes `(order_id)`, `(event_id, user_id, status)` and `(event_id, created_at desc)`
3. `events.active_count`: backfill, check `>= 0`, `registrations_active_count` trigger.
4. Drop `registrations_one_active_per_user`.
5. pgTAP tests for the trigger, the new status, and grants.

## Settings (new)

| Name | Default | Notes |
|---|---|---|
| `EMAIL_PROVIDER` | `resend` | `resend` or `zeptomail` |
| `EMAIL_FALLBACK_PROVIDER` | (empty) | The other provider, or empty for none |
| `EMAIL_RATE_PER_SECOND` | `9` | BullMQ limiter `max` per 1,000 ms |
| `ZEPTOMAIL_TOKEN`, `ZEPTOMAIL_API_URL` | `''`, `https://api.zeptomail.com` | Secret token server-side only |
| `PUBLIC_WEB_URL` | `http://localhost:3000` | Links in emails and the QR payload |
| `ORDER_LOCK_TIMEOUT_MS` | `3000` | Q2 A |
| `EXPORT_CONCURRENCY` | `2` | Per instance |

Config validation:
- When a provider is selected, its key is required.
- The fallback must differ from the primary.

## Load tests
`test/load/` (k6):
- the scenarios `orders-burst`, `orders-spread`, `checkin`, `browse`, `email-drain`
- a seed script that creates the event, the users and the tokens through the test auth server, on staging only
