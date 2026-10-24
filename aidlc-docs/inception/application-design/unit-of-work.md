# Units of Work (version 2, Change 1)

Version 1 is in `v1/unit-of-work.md`. Decisions come from `inception/plans/unit-of-work-change1-plan.md` (all A) and the version 1 answers Q3–Q5.

**How the work is done:**
- You and I build one unit at a time.
- The frontend switches in two parts (U6a, U6b).
- Each unit adds its own additive migrations in `G-VENTS/supabase/migrations/`.
- Payments is split into U7 (Paystack) and U8 (Stripe).
- The frontend design upgrade is a separate, later pass (O1).

The deployment model is unchanged: **two services**, the Next.js app on Vercel and `gventz-api` on Render (API web plus worker). Units are logical groupings for development, built as modules inside those two services.

**Design stage key:**
- **FD:** Functional Design
- **NFR-R:** NFR Requirements
- **NFR-D:** NFR Design
- **Infra:** Infrastructure Design
- **CG:** Code Generation (always)

---

## U1 — Platform (rework of existing code)
- **Repository:** gventz-api. **Milestone:** M1.
- **Design stages:**
  - FD: skip (the approved version 1 FD holds).
  - NFR-R: **revise**. Scale targets (D37), 99.9%, the Security and Resiliency rules, the Supabase pooler limits.
  - NFR-D: **revise**. Outbox, bulkhead pools, breakers, telemetry, the autoscaling triggers.
  - Infra: **revise**. Render web plus worker with autoscaling and rolling deploys, Render Key Value, Supabase region (O9), Grafana and Sentry, secrets, alerts.
  - CG.
- **Scope:**
  - **Database:** point `DatabaseModule` at the Supabase pooler with TLS verification. Separate `web`, `worker` and `reports` pools.
  - **Migrations:** remove the `drizzle/` migrations. Generate the Drizzle schema from Supabase, with a CI check that it matches. Test containers load `supabase/migrations`.
  - **New platform parts:**
    - **Outbox:** the `outbox_events` migration, `OutboxWriter`, `OutboxRelay` and its worker job.
    - **ResilienceModule:** timeouts, circuit breaker, retry.
    - **TelemetryModule:** OpenTelemetry to Grafana Cloud, Sentry, business metrics.
    - **Logs:** shipped to Grafana Loki.
  - **Render blueprint:** remove Render Postgres. Add autoscaling (minimum 2 web instances) and a separate worker.
  - **Runbooks** (first set): deploy and rollback, restore (point-in-time recovery), an alert runbook template, and the incident process (D52).
- **Reuses:** config, context, HTTP, problem details, logging, rate limits, queues, health, OpenAPI, audit, transactions and the CI workflow, all from U1 version 1.

## U2 — Identity (replaced)
- **Repository:** gventz-api. **Milestone:** M1.
- **Design stages:** FD **light** (token claims, MFA level, staff check, profile); CG. No NFR or Infra stages, which are covered by U1 and the SECURITY rules.
- **Scope:**
  - `SupabaseTokenVerifier` (cached JWKS) and `AccessTokenGuard`, deny by default.
  - `@CurrentUser()`, `@RequireMfa()`, `PlatformStaffGuard` with a `platform_staff` migration.
  - `ProfileService` and `MeController` (`GET /me`; `PATCH /me` in M2).
  - `UserDirectory` reading `profiles`.
- **Carried over:** the U2 own-auth code moves to branch `parked/own-auth`. That needs the first commit in gventz-api, made only with your go-ahead. The integration tests for own-auth go with it.
- **Owner setup:** turn on Supabase asymmetric JWT signing keys, the Google provider, custom SMTP (Resend), MFA (TOTP) and Turnstile (O17, O5).

## U3 — Events and Engagement
- **Repository:** gventz-api (migration in G-VENTS). **Milestone:** pass 1 M1, pass 2 M2.
- **Design stages:** FD **delta only**, on top of the approved U3 functional design: `PurchasePolicy` (per-buyer limit, fee choice) and the `PayoutReadiness` gate (stub until U7). Then CG in two passes.
- **Pass 1 (M1):** worldwide reference data, the `Event` aggregate and policy, `POST /events`, `POST /events/{id}/publish`, `GET /events/by-slug/{slug}`, `EventPermissionGuard`.
- **Pass 2 (M2):**
  - **Events:** edit, location, settings (including the per-buyer limit), cancel, delete, featured, my events, dashboard.
  - **Engagement:** questions and announcements.
  - **Shared reference data:** the country, region and time-zone endpoints.
  - **Fee choice:** its endpoint lands in M4 with U7.
- **Migration:** `per_buyer_limit` and `fee_choice` columns on `events`, with defaults 10 and `host_absorbs`.

## U4 — Ticketing
- **Repository:** gventz-api, plus migrations in G-VENTS. **Milestone:** core M1, rest M2. Holds and paid orders come in U7.
- **Design stages:**
  - FD: **execute**. Order and ticket model, all-or-nothing admission, the rule when capacity can't fit a group, buyer allowance, approval, waitlist for groups, scan results, replacing the one-per-user index safely, order email.
  - NFR-R: **execute**. 50/s bursts, scan latency, no oversell, the load-test definition.
  - NFR-D: **execute**. Lock order, counters, conditional check-in update, hot-row behaviour, rate limits.
  - Infra: skip.
  - CG.
- **Core (M1):**
  - free orders with several tickets
  - ticket page (`GET /tickets/{code}`)
  - check-in scan (`POST /events/{id}/check-in`)
  - order tickets email (one email, one QR per ticket)
- **Rest (M2):** approval, waitlist promotion, guest list (with buyer and guest name), check-in from the guest list, my orders, `TicketingStats` for Events.
- **Migrations:**
  - `orders`, `order_lines`
  - `registrations.order_id`, `registrations.guest_name`
  - `ticket_tiers.held`, `events.active_count` (backfilled)
  - the new uniqueness rule replacing `registrations_one_active_per_user`, timed so the old build keeps working
- **Proves:** the concurrency test, and the load test script used in Build and Test.

## U5 — Media, Discovery and Revalidation
- **Repository:** gventz-api. **Milestone:** M2.
- **Design stages:** FD **light** (Supabase Storage signed uploads, folder clean-up, revalidation debounce); CG.
- **Scope:**
  - **Media:** `SupabaseStorageFileStorage` and `FlyerService` (upload URL, confirm, remove; clean-up on delete or replace).
  - **Discovery:** featured events, outside listings (cached in Redis, with a timeout per source), Places proxy (per-user limits), replacing `/api/places/*`.
  - **Revalidation:** signed revalidation processor.

## U6 — Frontend Switch (G-VENTS, branch `feature/backend-split`)
- **Repository:** G-VENTS. **Milestone:** U6a M1, U6b M2.
- **Design stages:** CG only. The stories and API contract are enough. Security headers and CSP follow SECURITY-04 during CG.
- **U6a (M1):**
  - **API client:** the generated client (`src/lib/api/`), and a server-side caller that attaches the Supabase access token and request id.
  - **Sign-in:** a "Continue with Google" button on the sign-in page.
  - **Event pages:** create and publish an event, and the public page, through the API.
  - **Tickets:** a quantity picker with optional guest names, an order result page and the ticket page.
  - **Check-in:** the scanner page, a server action that calls the scan endpoint, with clear green and red screens.
- **U6b (M2):**
  - **Remaining pages:** every other Server Action switches to the API — dashboard, settings, questions, flyer, guest list, approval, waitlist, announcements, Discover, places.
  - **Routes:** remove `/api/places/*`. Add the `/api/revalidate` route (HMAC).
  - **Security headers** and a restrictive CSP.
  - **Supabase access:** reduced to sign-in only (`src/lib/supabase/` keeps only the auth helpers).

## U7 — Payments: Paystack
- **Repositories:** both. **Milestone:** M4 (2026-11-29, proposed).
- **Design stages:**
  - FD: **execute**. Order holds, fee quotes including the gross-up, provider split, the webhook inbox, refunds and Paystack refund recovery (R-P1), disputes, ledger, reconciliation, payout accounts, staff fees.
  - NFR-R: **execute**. PCI SAQ-A, webhook latency, idempotency, provider rate limits.
  - NFR-D: **execute**. Inbox, breakers, retries, ledger integrity, MFA step-up.
  - Infra: **execute**. Webhook endpoints, keys and secrets, Paystack dashboard settings, alerts.
  - CG.
- **Scope:**
  - **Backend:** the whole Payments module with the `PaystackProvider`, plus Ticketing holds, paid orders and hold expiry.
  - **Events:** the fee-choice endpoint and the real `PayoutReadiness`.
  - **Notifications:** receipt, refund, payout-change and expiry emails.
  - **Frontend:**
    - checkout redirect and return page
    - payout account screens with MFA enrolment and step-up
    - fee choice
    - sales, orders and refunds
    - the "organizer responsible for refunds" wording
    - staff fee and reconciliation screens
- **Migrations:** `payments`, `refunds`, `disputes`, `payout_accounts`, `fee_schedules`, `ledger_entries`, `webhook_inbox`, `reconciliation_runs`.

## U8 — Payments: Stripe
- **Repositories:** both. **Milestone:** M5 (2026-12-18, proposed).
- **Design stages:** each a small delta on U7: FD (Connect Express onboarding, destination charges, reverse transfers), NFR-R, NFR-D, Infra (Stripe webhooks and restricted keys). Then CG.
- **Scope:**
  - **Backend:** `StripeProvider`, the payout onboarding link flow, and Stripe webhooks through the same inbox.
  - **Frontend:** the Stripe onboarding return page.

---

## Code Organization

### `gventz-api` (`/Users/payazaafrica/gventz-api`)
```text
gventz-api/
├── src/
│   ├── main.ts                     # APP_ROLE = api | worker | all
│   ├── app.module.ts
│   ├── shared/{domain,kernel}/
│   ├── platform/{config,context,database,transaction,outbox,events,redis,queue,logging,telemetry,
│   │             resilience,http,rate-limit,health,openapi,audit}/
│   └── modules/{identity,events,engagement,ticketing,payments,media,discovery,notifications}/
│       └── {domain,application,infrastructure,presentation}/ + <name>.module.ts + index.ts
├── src/platform/database/schema/   # generated from Supabase (no drizzle/ migrations folder)
├── test/{integration,e2e,load,support}/   # Testcontainers (Postgres with supabase/migrations applied, Redis); k6 load scripts
├── .github/workflows/{ci,release}.yml
├── Dockerfile, docker-compose.yml, render.yaml
└── CLAUDE.md, .claude/CLAUDE.md, .aidlc-rule-details/
```
- Unit tests sit next to the code (`*.spec.ts`), and property-based tests in `*.pbt.spec.ts`. Integration, e2e and load tests live in `test/`.
- **CI** fetches `supabase/migrations` from G-VENTS, either as a pinned copy or a checkout of the matching commit, to build the test database and check the generated schema.
- **Git:** the first commit, the `parked/own-auth` branch and the GitHub remote are created only with your go-ahead. After that, work happens on branches with pull requests (D48).

### G-VENTS (this repository, branch `feature/backend-split`)
- **Migrations:** `supabase/migrations/` keeps all schema changes, additive only until go-live is confirmed.
- **New code:**
  - `src/lib/api/`: the generated client and server caller.
  - `src/app/api/revalidate/route.ts`
  - the scanner and order pages
  - later, the checkout and payout pages
- **Reduced:** `src/lib/supabase/` keeps only the sign-in helpers.
- **Removed:** `src/app/api/places/`.
- `aidlc-docs/` stays the single home of AI-DLC documentation for both repositories.
