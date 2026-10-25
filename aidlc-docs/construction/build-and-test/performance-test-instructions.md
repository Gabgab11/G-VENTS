# Performance Test Instructions

## Targets (U4 NFR requirements)

| Target | Value |
|---|---|
| Orders on one event | 50/s sustained, 100/s in the test |
| Order p95 | < 300 ms |
| Order errors | < 0.1% |
| Oversell | none |
| Door scans | 30/s, p95 < 300 ms |
| Ticket and event pages | p95 < 150 ms |
| Tickets email | within 10 minutes at the peak |

## How
k6 scripts and the staging seed are in `gventz-api/test/load/` (README there):

```bash
STAGING_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… API_URL=https://gventz-api-staging.onrender.com BUYERS=5000 EVENTS=21 npx tsx test/load/seed.ts
k6 run -e API_URL=$API_URL -e BFF_KEY=$BFF_SHARED_SECRET -e SEED=tmp/load/seed.json test/load/orders-burst.js
```

- **`BFF_KEY` is required:** it gives each virtual user its own visitor IP (fixed in this stage; without it the per-IP limits refuse almost everything).
- **After each run**, check for oversell with the SQL in the k6 README.

## Local results (2026-10-25, one laptop: k6, API, Postgres and Redis on the same machine; indicative only)

| Run | Result |
|---|---|
| orders-burst 100/s × 3 min (before fixes) | 90 req/s served; p95 1.45 s; 1.3% errors (500 on pool exhaustion); **no oversell** |
| orders-burst 50/s × 1 min (after fixes) | 32–37 successful orders/s on one event; p95 about 3 s; failures are 503 `order.busy` / `service.busy` with Retry-After; **no oversell**, no 500s |
| Database time per order (pg_stat_statements) | about 5 ms; the rest of the time inside the event lock is round trips (about 9 sequential statements) |

**Fixes made from these runs:**
1. **Pool exhaustion answered 500.** It now answers 503 `service.busy` with Retry-After 2 (`isDatabaseBusy`), and the website retries once.
2. **The counter trigger** updated the event row once per ticket inside the lock. It now updates once per statement (migration `…0500`); ticket inserts went from 5–14 ms to 2–4 ms.
3. **Per-event gate** (`KeyedGate`, `ORDER_GATE_PER_EVENT=2`): waiting happens in memory instead of holding pool connections, so other requests keep working during a rush.
4. **`lock_timeout` is a role setting** (migration `…0600`): one round trip less per order.
5. **The k6 scripts** send synthetic visitor IPs through the BFF headers.

## The deciding factor: distance between API and database
A single event's throughput is about 1 ÷ (time inside the lock) ≈ 1 ÷ (9 × round trip + about 5 ms):

| Placement | Round trip | Time per order | Orders/s per event |
|---|---|---|---|
| Same region (Render Frankfurt + Supabase eu-central-1) | about 1 ms | about 15 ms | about 65–100 |
| Render Frankfurt + Supabase eu-west-2 (London), as today | about 12–15 ms | about 115–140 ms | **about 7–9** (below the 50/s target) |

**The load test must run on staging with the production placement.** See the decision in build-and-test-summary.md.

## Not run yet (staging only)
`orders-spread`, `checkin`, `browse`, `email-drain`; and `orders-burst` at production size and placement.
