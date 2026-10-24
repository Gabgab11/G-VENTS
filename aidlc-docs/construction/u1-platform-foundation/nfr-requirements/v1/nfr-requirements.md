# U1 Platform Foundation — NFR Requirements

Sources: requirements.md (NFR-1..NFR-8, D26–D29), U1 functional design, and the answers in u1-platform-foundation-nfr-requirements-plan.md (all A). U1 provides the baseline every later unit inherits. Unit-specific targets (registration, sign-in) are set in U2 and U4.

## 1. Performance

| ID | Requirement | Target | How it's checked |
|---|---|---|---|
| U1-P1 | Platform overhead per request: request id, auth check, validation, error mapping, logging | ≤ 5 ms p95 on the API instance, excluding database and outside calls | Benchmark of a no-op authenticated route (autocannon) in CI on demand |
| U1-P2 | Access-token check | Local JWT verification, no network or database call | Unit test asserts no I/O; code review |
| U1-P3 | Database pool | Bounded, `DATABASE_POOL_MAX` default 10 per process. Connection acquire timeout 2 s, statement timeout 5 s (30 s for the migration tool) | Config tests; integration test for the timeout |
| U1-P4 | JSON serialization | Fastify with response schemas from DTOs where defined | Benchmark above |
| U1-P5 | Health readiness | Each check answers within 1 s | Integration test |
| U1-P6 | Startup | Ready to serve within 10 s of process start on a Starter instance | Render deploy logs |

The end-to-end targets in NFR-2 (reads p95 < 150 ms, registration p95 < 300 ms) are met per endpoint by later units on this baseline.

## 2. Scalability
- **U1-S1. Stateless API.** No in-memory session, cache or counter that must be shared. Rate limits, caches and queues live in Redis; sessions in Postgres.
- **U1-S2. Separate roles.** The same build runs as the API, the worker, or both (`APP_ROLE`). Production runs them as separate Render services, so each can scale on its own.
- **U1-S3. Connection budget.** `(API instances + worker instances) × DATABASE_POOL_MAX` must stay under the Render Postgres connection limit, with 20% headroom for migrations and the data migration tool. This is checked when instances are added.
- **U1-S4. Starting sizes (Q7 A):**
  - **Staging:** one paid instance (`APP_ROLE=all`), the smallest paid Postgres, free Redis.
  - **Production:** one Starter API, one Starter worker, Basic Postgres with backups, paid Redis with persistence.
  - **Scale-up trigger:** add an API instance when p95 latency or CPU stays above target for a day in the logs.

## 3. Availability and recovery
- **U1-A1. Zero-downtime deploys.** Render starts the new instance and waits for `/health/ready` before it moves traffic. The old instance drains for up to 25 s on `SIGTERM`.
- **U1-A2. Single instance.** One production API instance is accepted (Q7 A). Expected downtime is limited to platform incidents, which fits 99.5% monthly (about 3.6 hours a month).
- **U1-A3. Backups and recovery.** Postgres has daily backups at least (point-in-time recovery if the plan includes it). Assumed recovery time is 4 hours (O8). Redis persistence is on in production, so queued jobs survive a restart.
- **U1-A4. Degraded mode.**
  - If Redis is unreachable, the API keeps serving reads and writes. Rate limits fail open, except sign-in code requests, which fail closed (business-rules R4).
  - Enqueueing fails and is logged (business-rules D4).
  - Readiness reports unhealthy, so Render won't send traffic to a new instance that has no Redis.

## 4. Security (functional; the Security extension is off)
- **U1-SEC1. HTTPS.** Render terminates TLS. The API trusts `x-forwarded-*` from Render's proxy only.
- **U1-SEC2. Secrets.** Read only from the environment. Validated at startup. Never logged (redaction list: `authorization`, `cookie`, `set-cookie`, `refreshToken`, `accessToken`, `code`, `password`, `secret`, `email`). Never returned.
- **U1-SEC3. Input limits.**
  - Body ≤ 100 KB. Every string DTO field has a maximum length.
  - Unknown fields are rejected (`whitelist` + `forbidNonWhitelisted`).
  - Path ids are validated as UUIDs and return 404 otherwise.
- **U1-SEC4. CORS.** Only `CORS_ORIGINS`. Credentials aren't allowed cross-origin, because web traffic comes through Next.js server to server.
- **U1-SEC5. Security headers.** `@fastify/helmet` defaults, with `Cache-Control: no-store` on every authenticated response.
- **U1-SEC6. No error leaks.** A 500 never includes an internal message or stack (business-rules E4).
- **U1-SEC7. Least-privilege database role.** The application connects as a role that can read and write application tables but can't create or drop them. Migrations run with a separate owner role during deploy (D12).

## 5. Reliability
- **U1-R1. Outside calls.** Every call has a timeout: 4 s for listings (FR-9.3), 5 s for others unless the unit sets one.
- **U1-R2. Jobs.** 5 attempts with exponential backoff from 2 s. Deterministic job ids. Final failures are logged and kept 7 days (business-rules J1–J4).
- **U1-R3. Graceful shutdown.** Stop accepting requests, finish in-flight requests and the active job, then close the pool and Redis.
- **U1-R4. Retries in the request path.** Transactions that fail with a Postgres serialization or deadlock error (`40001`, `40P01`) are retried up to 3 times by the transaction helper. Other errors are not retried in the request path.

## 6. Maintainability
- **U1-M1. TypeScript strictness.** `strict`, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. No `any` without a lint-disable comment that gives a reason.
- **U1-M2. Layer boundaries.** Enforced by ESLint (`eslint-plugin-boundaries`): the domain layer can't import NestJS, Drizzle or other modules' internals (components.md §1).
- **U1-M3. Formatting and checks.** Prettier formatting. ESLint, typecheck, unit, integration and build in CI on every pull request.
- **U1-M4. Generated OpenAPI.** Served at `/openapi.json`, plus a committed `openapi.json` snapshot that CI checks for drift, so frontend client generation is reproducible.
- **U1-M5. Migrations.** SQL files generated by Drizzle Kit and reviewed in the pull request. Applied automatically on deploy (Render pre-deploy command), never by hand.

## 7. Observability (Q6 A)
- **U1-O1. Logs.** Structured JSON to standard output (pino), read in the Render dashboard. No external log service for now.
- **U1-O2. What every log line includes.** `requestId`, `level`, `time`, `msg`, plus, where known, `userId`, `route`, `status`, `durationMs`, `jobId` and `queue`.
- **U1-O3. Levels.**
  - `info`: requests and completed jobs.
  - `warn`: 4xx from rate limits, Redis fallbacks and retried jobs.
  - `error`: 5xx and final job failures.
  - Health checks are logged at `debug`.
- **U1-O4. Masking.** Emails are masked (`Email.masked()`), and tokens and codes are never logged.

## 8. Testing (NFR-7, PBT extension)
- **U1-T1. Unit tests.** Next to the code (`*.spec.ts`). Property-based tests in `*.pbt.spec.ts`, separate from example-based tests (PBT-10).
- **U1-T2. Integration tests.** Under `test/integration`, against real Postgres and Redis started by Testcontainers. They cover migrations, transactions and event dispatch, the audit trail, health and the rate limiter.
- **U1-T3. PBT.** The properties in business-logic-model.md §7 use fast-check (PBT-09).
  - At least 100 runs per property in CI.
  - The seed is printed on failure and can be replayed with `FC_SEED` (PBT-08).
  - Shrunk failures are added as example-based regression tests (PBT-10).
- **U1-T4. Coverage.** 80% line coverage (Vitest v8 provider). The report runs from day one; the gate blocks only the production cutover (Clarification 6 A).
- **U1-T5. Local stack.** `docker compose up` starts Postgres (same major version as Render, Q5 A) and Redis for development.
