# Unit of Work Dependencies (version 2, Change 1)

Version 1 is in `v1/unit-of-work-dependency.md`.

## Dependency Matrix

Rows depend on columns. **B** = needs it built first. **C** = needs only its API contract (OpenAPI) or a stub.

| Depends on → | U1 | U2 | U3 | U4 | U5 | U6 | U7 | U8 |
|---|---|---|---|---|---|---|---|---|
| **U1 Platform** | — | | | | | | | |
| **U2 Identity** | B | — | | | | | | |
| **U3 Events and Engagement** | B | B | — | C (`TicketingStats` stub) | | | C (`PayoutReadiness` stub) | |
| **U4 Ticketing** | B | B | B (pass 1) | — | | | | |
| **U5 Media, Discovery, Revalidation** | B | B | B (pass 1) | | — | | | |
| **U6a Frontend part 1** | | C | C (pass 1) | C (core) | | — | | |
| **U6b Frontend part 2** | | C | C (pass 2) | C (rest) | C | B (U6a) | | |
| **U7 Paystack** | B | B | B | B | B (revalidation) | B | — | |
| **U8 Stripe** | | | | | | | B | — |

- **No cycles.** U3 uses stubs for the two ports that U4 and U7 implement later.
- U6 needs only contracts, so its pages can be built as soon as the API's OpenAPI document exists. They're checked end to end once the endpoints are deployed to staging.

## Order and Critical Path

```text
M1 (2026-11-01)   U1 rework --> U2 --> U3 pass 1 --> U4 core --> U6a
                                              \--> (U6a pages start on contracts)
M2 (2026-11-08)   U3 pass 2  |  U4 rest  |  U5  |  U6b      --> load test (Build and Test)
M3 (2026-11-15)   Build and Test gates, restore drill, production go-live
M4 (2026-11-29)   U7 Paystack
M5 (2026-12-18)   U8 Stripe
```

Text alternative:
- **M1:** U1, then U2, then U3 pass 1, then U4 core, then U6a. U6a's pages can start as soon as the U3 and U4 contracts exist.
- **M2:** U3 pass 2, U4 rest, U5 and U6b, one at a time. Then the load test.
- **M3:** the gates, the restore drill and go-live.
- **After go-live:** U7 (Paystack), then U8 (Stripe).

- **Critical path to M3:** U1 → U2 → U4 (through U3 pass 1) → U6a/U6b → Build and Test.
- **Owner items on the critical path:**
  - O9 (Supabase region) before U1 Infrastructure Design.
  - O17 (signing keys, Google provider, SMTP) before U2 is tested on staging.
  - O7 (Render) before the first staging deploy.
  - O5 (Resend domain) before real sign-in and ticket emails.
  - O10 (on-call contact) and O16 (Grafana, Sentry) before M2.
- **Sequential build** (version 1 Q3 A): one unit at a time, in the order above. The only overlap is U6a pages written against contracts.

## Integration Points and Checkpoints

| Checkpoint | When | What is verified |
|---|---|---|
| Contract | After each backend unit's CG | `openapi.json` exported; client regenerated in G-VENTS; contract check in CI |
| Schema | After each unit with a migration | Migration applied to staging Supabase; generated Drizzle schema matches; old `main` build still works (additive) |
| M1 smoke | 2026-11-01 | On staging, in a browser: Google sign-in → create and publish → get 3 tickets → email received → scan at the door (green, then "already used") |
| M2 parity and load | 2026-11-08 | Every Must story on staging; no Supabase data calls left in the frontend; load test at 100/s passes (no oversell, p95 targets); alerts fire to on-call |
| M3 go-live | 2026-11-15 | Coverage and PBT gates; restore drill passed; production migrations applied; API and frontend deployed with rolling deploys |
| M4 / M5 | After go-live | Sandbox end-to-end (Paystack / Stripe), webhook replay tests, reconciliation run, then live keys |

## Shared Resources
- **Supabase database:** shared by the old `main` build and the new API until go-live. Migrations stay additive (AD17).
- **Redis (Render Key Value):** shared by the API and the worker (queues, rate limits, cache).
- **OpenAPI document:** owned by gventz-api and used by G-VENTS (and later the mobile app).
