# U1 Platform Foundation — NFR Design Plan

This stage turns the U1 NFR requirements into concrete patterns and logical components. Most patterns follow directly from decisions already made. The questions below are the ones where a real choice remains.

Please fill in each `[Answer]:` tag with a letter, or X plus your own text, then tell me "done".

## Plan

- [x] 1. Collect and analyze answers below
- [x] 2. `nfr-design-patterns.md`
  - [x] 2.1 Resilience: timeouts, retries, transaction retry, degraded mode, graceful shutdown
  - [x] 2.2 Scalability: stateless instances, role split, connection budget, queue concurrency
  - [x] 2.3 Performance: request pipeline, pooling, read-side queries, caching layers, serialization
  - [x] 2.4 Security: edge validation, secrets, headers, caller identity behind the BFF, least-privilege DB roles
  - [x] 2.5 Deploy-safe schema changes (expand and contract)
- [x] 3. `logical-components.md`: each platform component with its responsibility, interfaces, configuration and failure behaviour; a component diagram
- [x] 4. Validate against U1 NFR requirements and functional design

## Questions

### Question 1 — Protecting the API from slow or failing outside services
A) Timeouts on every call plus job retries (already decided). No circuit breaker yet. Outside listings are cached for an hour, and Places failures return `places.unavailable` quickly. Add a breaker later if logs show repeated slow failures. (Recommended)

B) Add a circuit breaker (for example `opossum`) around every outside adapter now

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — Caching public reads in the API
Public event pages are already served from the Next.js cache, which is refreshed by the revalidation signal (D22).

A) No API-side response cache. Next.js is the one cache for pages, and the API answers cache misses from indexed queries. One cache layer means one thing to invalidate. Redis caching is used only where requirements ask for it (outside listings). (Recommended)

B) Also cache event-page responses in Redis inside the API, invalidated on change

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — When a job can't be queued after the data is saved (Redis down)
Today's design logs the failure and the side effect is lost (accepted limitation in services.md). The ticket itself is safe and visible at `/t/{code}`.

A) Keep it as designed for now. Log at error level with the job id, so a missed email can be found and resent by hand. (Recommended for M1)

B) Fallback outbox. If enqueueing fails, write the job to a small `pending_jobs` table in Postgres. The worker moves those rows into the queue once Redis is back.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4 — Knowing the real caller behind Next.js
Web requests reach the API from Vercel's servers (the backend-for-frontend), so the API sees Vercel's IP address, not the guest's. Per-IP rate limits (sign-in codes) and logs need the real one.

A) Next.js sends two headers on every call: a shared secret (`x-gventz-bff-key`) and the browser's IP (`x-gventz-client-ip`). The API trusts the forwarded IP only when the secret matches; otherwise it uses the connection IP, which covers mobile apps that call directly. Every caller also gets a general per-IP limit of 300 requests a minute, on top of the specific limits. (Recommended)

B) No forwarding. Per-IP limits apply only to direct (mobile) callers, and web traffic is limited per user and per email only.

X) Other (please describe after [Answer]: tag below)

[Answer]: A
