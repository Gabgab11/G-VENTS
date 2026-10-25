# Integration Test Instructions

## gventz-api against real Postgres (the Supabase image) and Redis

Testcontainers starts `supabase/postgres:17.11.0.006` with every G-VENTS migration applied (`GVENTS_MIGRATIONS_DIR`, default `../G-VENTS/supabase/migrations`) and Redis.

```bash
npm run test:integration        # 15 files, 100 tests
npm run test:cov:all            # unit + PBT + integration with the 80% line gate (thresholds in vitest.coverage.config.mts)
```

**Result (2026-10-25):** 84 files, 403 tests, all passing.

| Coverage | % |
|---|---|
| Lines | 95.75 |
| Statements | 92.6 |
| Functions | 93.0 |
| Branches | 83.2 |

**Scenarios covered (by file):**
- **schema-drift:** column maps vs the migrated database
- **platform, outbox, redis-down, telemetry, api-docs:** U1
- **identity:** tokens, staff, MFA
- **events, events-manage, engagement:** U3
- **ticketing:**
  - orders, rules, answers
  - 100 parallel buyers for 40 places
  - per-buyer parallel limit
  - lock busy → 503
  - check-in races
  - ticket page, emails, `register_guest` compatibility
- **ticketing-manage:** approve, decline, promote (including old tickets), guest list, the 20,000-row CSV across batch boundaries, my orders
- **media:** fake Storage, flyer flow, clean-up
- **discovery:** venue search limits and errors
- **revalidation:** signed delivery, once-a-minute order refresh

## Supabase pgTAP (G-VENTS)

```bash
npx supabase@2.121.0 test db    # 5 files, 46 tests
```

Covers:
- the API role's grants and timeouts (including `lock_timeout`)
- the outbox, staff, the purchase policy and audit
- `register_guest` compatibility
- orders, the declined status and the `active_count` triggers

## Website ↔ API (Next.js + gventz-api + local Supabase)

See e2e-test-instructions.md (the smoke scripts call the real Server Actions and pages).

## Staging (before go-live)
Run every Must story by hand on staging (the website on a Vercel preview, the API on Render staging, Supabase staging):
- sign in with Google and with an email code
- create and publish
- get tickets
- the tickets email
- scan at the door with a real iPhone and a real Android phone
- approvals, waiting list, guest list and CSV
- flyer
- cancel and delete
