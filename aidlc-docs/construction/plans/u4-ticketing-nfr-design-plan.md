# U4 Ticketing — NFR Design Plan

**Input:** `construction/u4-ticketing/nfr-requirements/` (approved), the U4 functional design, and the U1 platform already built (UnitOfWork with retries, outbox, BullMQ queues, rate limits, circuit breaker, metrics).

**Already settled, so not asked:**
- **Per-event lock:** the event row is locked per order (functional design). No queue in front of ordering.
- **Retries:** serialization and deadlock errors retry up to 3 times (UnitOfWork, U1).
- **Durable email:** outbox, then the queue job, then the email provider.
- **Send pacing:** BullMQ's own queue limiter (`limiter: { max, duration }`) is shared by every worker. So the Redis token bucket in tech-stack-decisions is replaced by it: same result, less code. On a 429 from the provider, the worker pauses the queue for the `retry-after` time (`worker.rateLimit`).
- **Search:** guest search stays `ILIKE`. A trigram index is added only if the load test shows the guest list over 100 ms p95.

## Plan
- [x] 1. Collect and analyze answers
- [x] 2. `u4-ticketing/nfr-design/nfr-design-patterns.md`:
  - performance: lock path, counter trigger, check-in update, streaming CSV
  - concurrency: lock order, lock wait limit, retries
  - email: provider selection, failover, pacing, idempotency
  - security: limits, CSV protection, codes, privacy
  - resilience: degraded modes
  - observability: metrics and alerts
- [x] 3. `u4-ticketing/nfr-design/logical-components.md`: Ticketing and Notifications components, queues, metrics, settings
- [x] 4. Check against the Security and Resiliency rules that apply

## Questions

Put your choice after each `[Answer]:` tag, and save the file before replying.

### Question 1 — Switching email provider when one fails
Both Resend and ZeptoMail will be built (your answer Q1a C).

A) **Automatic:**
   - When the main provider's circuit breaker opens (repeated errors or timeouts), new sends go to the fallback provider (`EMAIL_FALLBACK_PROVIDER`).
   - The main provider gets a trial send after 30 seconds and takes over again once it works.
   - A log line and a metric show each switch.
   - (Recommended: no one has to be awake during the December peak.)

B) **Manual only:** jobs wait and retry against the main provider. Someone changes `EMAIL_PROVIDER` on Render to switch (a restart, about 1 minute).

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — When an event is very busy
During a rush, every order for one event waits its turn for that event's lock. Each order holds the lock for about 5–10 ms, so 100 orders a second is fine. A spike far beyond that would make orders wait longer.

A) **Wait at most 3 seconds:**
   - The order transaction sets `lock_timeout = 3s`.
   - Past that, the API answers 503 `order.busy` "Lots of people are getting tickets right now. Please try again." with `Retry-After: 2`.
   - The website retries once automatically before showing the message.
   - Nothing is half-done: the transaction rolls back.
   - (Recommended: guests get a quick answer, and the database isn't overloaded.)

B) Wait up to the role's 5-second statement limit. Fewer "try again" messages, but slower answers and more database connections held during a spike.

X) Other (please describe after [Answer]: tag below)

[Answer]: A
