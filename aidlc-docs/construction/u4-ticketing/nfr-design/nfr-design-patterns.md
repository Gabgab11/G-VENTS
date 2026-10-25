# U4 Ticketing — NFR Design Patterns

**Inputs:**
- `../nfr-requirements/` (approved)
- the U4 functional design
- the U1 platform as built
- answers in `construction/plans/u4-ticketing-nfr-design-plan.md`:
  - **Q1 A:** automatic email failover.
  - **Q2 A:** a lock wait of at most 3 s, then 503 `order.busy`.

## 1. Ordering: Short, Serialized Transactions (U4-P1, P2, P7, C1–C3, C5)

```text
POST /v1/events/{id}/orders
  guard + rate limit (orders.place, fail closed)        no database work
  validate lines, names; load questions (cached per request)
  UnitOfWork.run (max 3 attempts on 40001 / 40P01)
    SET LOCAL lock_timeout = '3s'                        (Q2 A)
    SELECT events ... WHERE id = $1 FOR UPDATE           lock 1
    SELECT ticket_tiers WHERE id = ANY($2) ORDER BY id FOR UPDATE   lock 2
    SELECT count(*) FROM registrations WHERE event_id, user_id, status IN (...)   allowance
    EventInventory.admit(...)                            pure domain, no I/O
    INSERT orders; INSERT registrations (multi-row, one statement)
    UPDATE ticket_tiers SET sold = sold + n (one statement per type)
    -- trigger updates events.active_count (same locked row, no extra lock)
    INSERT outbox_events                                (UnitOfWork)
  COMMIT
```

- **Statements per order:** about 7 short indexed statements. The lock is held from lock 1 to commit (target p95 < 20 ms, metric `ticketing_order_tx_ms`).
- **Lock order** (business-logic-model §2) is the same for place, approve, decline and promote, so deadlocks shouldn't happen. If one does, the UnitOfWork retries it.
- **Lock wait limit (Q2 A):**
  - `lock_timeout` 3 s. A timeout is Postgres code `55P03`. It's translated to `OrderBusyError`, which gives **503 `order.busy`** "Lots of people are getting tickets right now. Please try again." with `Retry-After: 2`.
  - It is **not** retried inside the API, because retrying would add load during the spike that caused it.
  - The website retries once after 2 s (U6), then shows the message.
  - Metric: `ticketing_order_busy_total`.
- **Different events never wait for each other:** the locks are per event row.
- **Pool budget:** a web instance has 10 connections. At p95 20 ms in the transaction, one instance handles about 400 orders a second before connections run out. The 2 s acquire timeout (U1) gives 503 before the pool is exhausted.
- **No oversell is structural:** `admit` runs only while the event and ticket types are locked, and the counters are written in the same transaction. This is proven by the stateful PBT, the concurrent integration test, and the SQL check after the load test (U4-C1).

## 2. Counter Trigger (U4-C2, P3 from reverse engineering)
- `registrations_active_count` trigger, AFTER INSERT, UPDATE OF status, or DELETE, FOR EACH ROW:
  - `delta = (new in active) − (old in active)`, where active = confirmed or pending.
  - `UPDATE events SET active_count = active_count + delta WHERE id = …` only when delta ≠ 0.
- **Why it stays cheap:** the order transaction already holds this event row, so the update adds no waiting. For a multi-row insert, the row trigger fires per ticket (at most 10 per order); that's acceptable.
- The migration backfills the column once. A check constraint `active_count >= 0` turns any bug into an error instead of a silent drift.

## 3. Check-in: One Conditional Update (U4-P3, C4)
- One `SELECT` by `ticket_code` (unique index), then one conditional `UPDATE … WHERE status = 'confirmed' AND checked_in_at IS NULL RETURNING`.
- No transaction, no event lock. Two devices scanning the same ticket: one green, one `already_used`.
- The staff permission is checked once per request through `EventPermissionGuard`, memoised in `RequestContext`.
- The scan limit (`checkin.scan`, 600 a minute per user) **fails closed**. The runbook tells door staff to fall back to the guest list check-in, which uses the same limit, if Redis is down.

## 4. Reads (U4-P4 to P6)
- **Ticket page:** one join query by code. Only the viewer's role is looked up separately, when signed in. There's no cache in the API; the Next.js page may cache publicly visible parts (U6).
- **Guest list:**
  - one paged query plus one count query grouped by status (totals and the waitlist count in one statement)
  - `ILIKE` search, scoped to one event
  - the index `(event_id, status)` exists
  - new index `(event_id, created_at desc)` for the default sort
- **CSV:**
  - Rows are read from the `reports` pool (2 connections) with keyset paging, 1,000 rows at a time (`WHERE (created_at, id) < (…)`), not `OFFSET`.
  - Rows are written to the response as a stream, so memory stays flat.
  - At most 50,000 rows.
  - At most 2 exports run at once per instance (a semaphore). A third gets 429 `export.busy`.
- **My tickets:** orders keyset-paged by `(created_at, id)`, then tickets for those orders in one `ANY($ids)` query.

## 5. Email: Selection, Failover, Pacing, Idempotency (U4-E1 to E7)

```text
outbox (in the order transaction)
  -> relay -> BullMQ queue "email", job id "order-tickets.{orderId}"
     worker (limiter: EMAIL_RATE_PER_SECOND per second, shared across workers)
       load the order, tickets and event (read-only), skip suppressed addresses
       render HTML + text, QR PNGs, .ics
       FailoverMailer.send(message, idempotencyKey = job id)
         primary breaker closed? -> primary.send
         primary breaker open and fallback set? -> fallback.send     (Q1 A)
         both open -> throw -> job retry with backoff (5 attempts, then failed set + alert)
```

- **`FailoverMailer` (Q1 A):**
  - Wraps two `Mailer` adapters, each with its own `DefaultCircuitBreaker`:
    - opens after 5 failures in 30 s
    - half-open after 30 s
    - send timeout 10 s
  - **Counted as failures:** timeouts, network errors and 5xx. **Not counted:** 4xx other than 429; these are permanent (bad address), so the job is marked failed with no retry.
  - **Switching:** while the primary is open, sends go to the fallback. A half-open trial send returns traffic to the primary when it works.
  - **Visibility:** every switch logs `email.provider_switched` and increments `email_provider_switch_total{from,to}`.
- **429 from a provider:** the worker calls `worker.rateLimit(retryAfterMs)` and throws `RateLimitError`. BullMQ pauses the whole queue for that time and the job is retried without spending an attempt.
- **Idempotency:**
  - BullMQ deduplicates by job id.
  - Resend gets `Idempotency-Key: {jobId}` (valid 24 h at Resend).
  - ZeptoMail has no idempotency key. Before sending, the worker checks `email:sent:{jobId}` in Redis and skips when it exists. **After** a successful send it sets the key for 24 h. *(Refined in code generation: marking after the send means a crash between send and mark can cause a rare duplicate, but can never lose an email. If Redis can't be read, the email is sent.)*
  - The same marker is set after a Resend send too, so a retry never sends twice through the other provider.
  - **Failover is decided before the call**, from the primary breaker's state: only an already-open breaker sends traffic to the fallback. A timeout also surfaces as "unavailable", but the primary may have accepted that email, so it is retried against the primary, never handed to the fallback.
- **The attachments are built in the worker, not the API:** QR PNGs (about 1 KB each, ten at most) and the `.ics` file.
- **Never blocks an order:** emails run after commit, and the tickets are already visible.

## 6. Security (U4-S1 to S6)

| Concern | Pattern |
|---|---|
| Ordering abuse | `orders.place`: user 10/min, IP 30/min, fail closed; per-buyer limit inside the locked transaction; alert at more than 60 orders in 5 min from one truncated IP (metric label = IP with the last octet, or the last 80 bits for IPv6, removed) |
| Ticket codes | 96 random bits from `gen_random_bytes(12)`; strict `^[0-9a-f]{24}$` check before any query; 404 for every miss |
| Staff actions | `EventPermissionGuard` (`guests.checkIn`, `orders.approve`, `waitlist.promote`, `guests.export`); MFA isn't required (same as U3 roles) |
| CSV | Formula prefix on `= + - @ \t \r`; RFC 4180 quoting; audit `guests.exported` with the row count; content-disposition file name from the slug only |
| Privacy | Answers never in scan results or on the ticket page; emails and names redacted from logs (U1 paths list extended with `buyerEmail`, `guestName`, `attendeeName`) |
| Email content | Every value HTML-escaped by the template functions; links built from `PUBLIC_WEB_URL` only |

## 7. Degraded Modes (RESILIENCY-10)

| Dependency down | Ordering | Check-in | Email | Reads |
|---|---|---|---|---|
| Redis | 503 (fail closed) | 503 (fail closed) | Jobs stay in the outbox and are relayed when Redis is back | Work |
| Email provider (primary) | Works | Works | Fallback provider (Q1 A) | Work |
| Both email providers | Works | Works | Retries with backoff; failed jobs alert and can be retried from the failed set (runbook) | Work |
| Database slow or locked | 503 `order.busy` after 3 s, or 503 from the pool after 2 s | 503 after 2 s | Waits | 503 after 2 s |

## 8. Observability
- **New metrics:**
  - `ticketing_orders_total{status}`
  - `ticketing_order_tx_ms` (histogram)
  - `ticketing_order_busy_total`
  - `ticketing_orders_by_ip_total{ip_trunc}`
  - `ticketing_checkins_total{result}`
  - `ticketing_export_rows_total`
  - `email_sent_total{provider,kind}`, `email_failed_total{provider,reason}`, `email_provider_switch_total{from,to}`
  - `email_queue_oldest_age_ms` (gauge, from `PlatformGauges`)
- **New alerts** (added to `ops/grafana/alerts.yaml`, each with a runbook page):
  - `order_busy_spike`: `order.busy` above 2% of orders over 5 min
  - `orders_from_one_ip`: more than 60 orders in 5 min from one truncated IP
  - `email_queue_stale`: the oldest email job older than 15 min
  - `email_provider_switched`: any switch, for information
  - `tx_retries_high`: retries above 1% of orders (from U4-C5)
- **Dashboard:** the existing `ticketing.json` gets panels for these.
