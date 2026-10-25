# Build and Test Summary (go-live scope: U1–U6)

**Date:** 2026-10-25. **Repositories:**
- gventz-api (no commits by the AI)
- G-VENTS `feature/backend-split` (uncommitted)

## Build Status

| Item | Status |
|---|---|
| gventz-api `npm run build`, `openapi:check` (34 paths) | Pass |
| gventz-api Docker image | Pass (rebuilt after a registry network timeout; contains fastify 5.12.7) |
| G-VENTS `next build` | Pass (home page static, refreshed every minute) |
| Supabase migrations (local, in order) | Pass |

## Test Results

| Suite | Result |
|---|---|
| API unit + PBT | Pass (part of the 403 below) |
| API integration (Testcontainers: Supabase Postgres + Redis) | Pass |
| **API combined (unit + PBT + integration)** | **84 files, 403 tests, 0 failures** |
| **API line coverage** (gate 80%) | **95.75%** (statements 92.6%, functions 93.0%, branches 83.2%) |
| Supabase pgTAP | 46/46 |
| Website unit | 59/59 |
| Website ↔ API smoke | U6a 12/12, U6b 33/33 (twice) |
| Concurrency (no oversell, per-buyer limit, single check-in) | Pass (integration and 4 local load runs: active count = held = sold every time) |
| Load: 100/s, p95 < 300 ms | **Not met locally; staging run pending**; see below |
| Dependency audit (production) | 0 vulnerabilities in both, after the fixes below |
| Restore drill | **Not run** (needs PITR on production, O19) |

## Found and Fixed During Build and Test

| # | Finding | Fix |
|---|---|---|
| 1 | Pool exhaustion answered **500** | 503 `service.busy` + Retry-After 2 (`isDatabaseBusy`); the website retries once |
| 2 | The counter trigger updated the event row per ticket inside the lock | Statement-level triggers (migration `20261025000500`); inserts went from 5–14 ms to 2–4 ms |
| 3 | A hot event's orders held every pool connection while queuing | Per-event in-memory gate (`KeyedGate`, `ORDER_GATE_PER_EVENT`) |
| 4 | An extra round trip per order (`SET LOCAL lock_timeout`) | `lock_timeout = 3s` as an API role setting (migration `20261025000600`) |
| 5 | k6 scripts came from one IP, so the per-IP limits refused them | Synthetic visitor IPs through the BFF headers (`BFF_KEY`) |
| 6 | **Next.js critical advisory** (RCE in image optimisation; Server Actions DoS) | `next` 15.5.28 (+ PostCSS override) |
| 7 | **Fastify high advisory** (validation bypass; X-Forwarded spoofing) | `fastify` 5.12.7, forced inside the Nest adapter; one-hop trust function |
| 8 | A pgTAP test assumed an empty outbox | Checks its own row |
| 9 | No combined coverage run | `npm run test:cov:all` with the 80% threshold |

## Load: What the Numbers Say
- On one laptop (k6, API, Postgres and Redis together), one event reached **32–37 orders/s** after the fixes, with no oversell and no 500s.
- Each order spends about **5 ms in the database**; the rest is about 9 sequential round trips inside the event lock.
- **In production,** throughput per event ≈ 1 ÷ (9 × round trip + 5 ms):
  - same-region API and database: about 65–100/s
  - **Render Frankfurt with Supabase London (the current placement): about 7–9/s**, far below the 50/s December burst

**Decision needed:** `region-decision-questions.md` (Q1 placement, Q2 restore drill).

## Docker Image
- Builds on the pinned `node:22-slim` digest.
- The first attempt failed in `npm ci` on a registry network timeout; the retry passed.
- The image loads its modules and carries fastify 5.12.7.

## Go-Live Readiness (M3, 2026-11-15)
**Ready for Operations: No, not yet.** Blocking items:
1. **Placement decision** (Q1), then the k6 suite on staging in that placement: `orders-burst` 100/s, `orders-spread`, `checkin`, `browse`, `email-drain`.
2. **Restore drill** (Q2, O19).
3. **Owner items:**
   - O17: Google sign-in, code email template, asymmetric keys, SMTP
   - O20: email throughput
   - O7: Render
   - O16: Grafana, Sentry and R2
   - O10: on-call contact
   - Vercel settings: `API_URL`, `BFF_SHARED_SECRET`, `REVALIDATE_SECRET`
4. **Manual staging checks:** the door scanner on a real iPhone and Android phone; the tickets email; a ZAP baseline scan.

## Instruction Files
- build-instructions.md
- unit-test-instructions.md
- integration-test-instructions.md
- performance-test-instructions.md
- security-test-instructions.md
- e2e-test-instructions.md
