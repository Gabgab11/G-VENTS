# U4 Ticketing — NFR Requirements

**Sources:**
- requirements v2.2 (NFR-2 to NFR-6, D37, D46)
- U1 NFR v2 (inherited)
- U4 functional design
- answers in `construction/plans/u4-ticketing-nfr-requirements-plan.md`:
  - **Q1 B:** keep attachments; raise the provider limit.
  - **Q1a C:** both email providers, chosen by a setting.
  - **Q2 A:** existing bot protections plus an alert.

## 1. Throughput and Latency

| ID | Requirement | Target | Proof |
|---|---|---|---|
| U4-P1 | Placing an order on one event (burst) | 50/s sustained, **100/s in the load test**, p95 < 300 ms, errors < 0.1%, **no oversell** | k6 scenario `orders-burst` (§5) |
| U4-P2 | Placing an order across many events | No waiting between events (per-event lock) | k6 scenario with 20 events in parallel |
| U4-P3 | Door scan | 5/s sustained (20,000 guests in about 2 hours), 30/s in the test, p95 < 300 ms | k6 `checkin` |
| U4-P4 | Ticket page | p95 < 150 ms | k6 `browse` |
| U4-P5 | Guest list page (50 rows, filters, search) | p95 < 300 ms at 20,000 tickets per event | integration timing plus k6 |
| U4-P6 | CSV export | 20,000 rows streamed in under 10 s, on the `reports` pool only | integration test with seeded rows |
| U4-P7 | Lock hold time per order | p95 < 20 ms (`order_tx_ms` metric) | metric in the load test |

## 2. Correctness Under Concurrency
- **U4-C1. No oversell:** after the load test, confirmed + pending ≤ capacity, `sold` ≤ quantity per type, and `sold` = confirmed + pending per type. This is checked by SQL at the end of the run, and by the stateful property test (PBT).
- **U4-C2. `events.active_count`** always equals confirmed + pending: a pgTAP test, plus an integration test after concurrent orders.
- **U4-C3. Per-buyer limit:** parallel orders from one buyer never exceed the limit (integration test with parallel requests).
- **U4-C4. Check-in:** parallel scans of one ticket give exactly one green (integration test).
- **U4-C5. Deadlocks:** the fixed lock order (event → ticket types by id → orders and tickets). Serialization and deadlock errors are retried by the UnitOfWork (U1), with the `tx_retries_total` metric alerting at more than 1% of orders.

## 3. Email Delivery (Q1 B, Q1a C)
- **U4-E1. Providers:** two `Mailer` adapters, **Resend** and **ZeptoMail**, chosen by `EMAIL_PROVIDER=resend|zeptomail`. An optional `EMAIL_FALLBACK_PROVIDER`: when the primary's circuit breaker is open, jobs go to the fallback.
- **U4-E2. Attachments kept:** an inline QR PNG per ticket (content id) and one `.ics` file per order.
- **U4-E3. Send rate:**
  - The worker paces sends to the provider's limit, from `EMAIL_RATE_PER_SECOND`; default 9 for Resend's 10/s.
  - The pacing is a token bucket in Redis, so several workers share it.
  - On 429 the job retries with the `retry-after` delay.
- **U4-E4. Targets:**
  - **Normal load:** the tickets email arrives within **2 minutes p95**.
  - **The December peak** (bursts of 50 orders a second): within **10 minutes p95**, provided the provider limit is raised to 50/s or more.
  - **Owner item O20:**
    - ask Resend to raise the limit to 50/s, and/or
    - set up ZeptoMail and get Zoho to confirm about 20,000 emails an hour
    - **before 8 November**
- **U4-E5. Never lost, never twice:** the outbox, then the queue job `order-tickets.{orderId}`, then the provider's idempotency key where supported (Resend `Idempotency-Key`; ZeptoMail `client_reference` with a dedupe check in Redis for 24 hours).
- **U4-E6. Tickets don't depend on email:** tickets are live on the ticket page and in "My tickets" the moment the order commits. The order confirmation screen links to them.
- **U4-E7. Monitoring:**
  - **Metrics:** `email_sent_total{provider,kind}`, `email_failed_total`, `email_queue_age_ms`.
  - **Alert** when the oldest email job is older than 15 minutes, which extends the U1 queue alert.

## 4. Abuse and Privacy (Q2 A; SECURITY-05, 08, 11)
- **U4-S1. Limits:**
  - `orders.place`: 10 a minute per user and 30 per IP, fail closed.
  - `checkin.scan`: 600 a minute per user, fail closed.
  - Guest list and CSV: 30 a minute per user.
- **U4-S2. Per-buyer limit** (1–10) and one verified email per account.
- **U4-S3. Alert** when one IP places more than 60 orders in 5 minutes, through a new metric `orders_placed_total{client_ip_trunc}` (truncated IP only).
- **U4-S4. Codes:** ticket codes are 96 random bits (24 hex). The ticket page answers 404 for unknown codes and is rate limited by the global per-IP limit (1,500 a minute). Guessing a valid code isn't practical.
- **U4-S5. Privacy:**
  - Answers are never shown at the door or on the public ticket page.
  - CSV exports are limited to owner, admin and finance, and audited.
  - Emails and names never appear in logs (U1 redaction).
- **U4-S6. CSV injection protection** (business-rules §10), which SECURITY-05 covers.

## 5. Load-Test Scenarios (k6; run in Build and Test on staging sized like production)

| Scenario | Shape | Pass |
|---|---|---|
| `orders-burst` | One event, capacity 20,000, 5,000 virtual buyers; ramp to 100 orders a second for 3 minutes; groups of 1–4 | U4-P1, U4-C1 to C3 |
| `orders-spread` | 20 events, 50 orders a second in total for 10 minutes | U4-P2 |
| `checkin` | 20,000 confirmed tickets; 10 staff tokens scanning 30 a second for 5 minutes, with 2% duplicate scans | U4-P3, U4-C4 |
| `browse` | Event page and ticket page at 200 requests a second, through the API (no Next.js cache) | U4-P4 |
| `email-drain` | Measure the time to drain 5,000 queued ticket emails at the configured rate (provider sandbox or a stub) | U4-E4 |

## 6. Availability and Degraded Modes (RESILIENCY-10)

| Failure | Behaviour |
|---|---|
| Redis down | Ordering and scanning refuse with 503 (fail closed, U1). Email jobs wait in the outbox. |
| Email provider down | The breaker opens; the fallback provider is used if configured; otherwise jobs wait and retry; tickets stay visible |
| Database slow | Acquire timeout 2 s gives 503; readiness fails; alert |

Check-in needs the API (online only, D57). The runbook for the December event includes a "venue connectivity check" step (O14).

## 7. Testing (PBT and the rest)
- **PBT:** the 8 properties in business-logic-model §8.
- **Integration:** concurrency tests U4-C1 to C4.
- **Email:** snapshot tests of the rendered emails; adapter contract tests against each provider's documented request format, with no network.
- **Load:** the k6 scenarios above, in Build and Test.
