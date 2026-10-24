# U1 Platform (Change 1 rework) — Code Generation Plan

This plan is the single source of truth for U1 rework code generation. Steps run in order, and each is ticked as soon as it's done.

## Unit Context
- **Unit:** U1 Platform, rework of existing code (`unit-of-work.md`). Milestone M1.
- **Code locations:**
  - `/Users/payazaafrica/gventz-api`: the platform code.
  - `/Users/payazaafrica/G-VENTS`: `supabase/migrations/` and `.github/workflows/supabase-migrations.yml`.
  - `aidlc-docs/` gets only the code summary.
- **Stories:**
  - US-9.4: alerts
  - US-9.5: rolling deploy and rollback
  - US-9.6: restore runbook
  - US-9.7: autoscaling and pre-scale
  - Foundations for every other story
- **Design inputs:**
  - `u1-platform-foundation/nfr-requirements/*` (v2), `nfr-design/*` (v2), `infrastructure-design/*` (v2)
  - application design v2 (AD17 to AD20)
  - the version 1 functional design, which still holds
- **Depends on:** nothing.
- **Depended on by:** U2 to U8.
- **Git:** see Step 1. Nothing is pushed. Commits are made only as approved in Step 1.

## Steps

### Step 1 — Preserve own-auth, start the rework branch (gventz-api)
- [x] **With your go-ahead (asked in the approval prompt):** — *not done: no commit approved; fallback below used*
  - Make the first commit on `main` with the current tree: U1 v1 plus U2 own-auth, all tests green.
  - Create branch `parked/own-auth` at that commit.
  - Create working branch `feature/supabase-platform`.
- [x] **If you don't want a commit yet:** archive the current tree to `/Users/payazaafrica/gventz-api-own-auth-snapshot.tar.gz` (excluding `node_modules`, `dist` and `coverage`) before changing anything. — *done 2026-10-24*
- [x] Remove own-auth from the working tree. It survives in the branch or archive.
  - **Code:** `src/modules/identity/`, its tests and test support files, and its `AppModule` wiring.
  - **Config:** the auth and Google settings.
  - **Dependencies:** `openid-client`.
  - **Scripts:** `scripts/m1-copy-staging/`, `scripts/db/bootstrap-roles.sql`, `scripts/generate-secrets.sh` (rewritten in Step 12).

### Step 2 — Supabase migrations for U1 (G-VENTS)
- [x] `supabase/migrations/20261024000100_api_role.sql`: — *changed: a per-table policy for `gventz_api` instead of `BYPASSRLS` (same effect, RLS stays on); also grants `extensions` usage (pgcrypto defaults) and lets `postgres` act as the role for tests*
  - Create role `gventz_api` (login, `BYPASSRLS`, no password in the file).
  - Grant `USAGE` on schema `public`.
  - Grant table rights per NFR design §4: `SELECT, INSERT, UPDATE, DELETE` on the application tables; `SELECT, INSERT` on `audit_log`.
  - Default privileges for tables created later by `postgres`.
  - `lock_timeout` 5 s.
- [x] `supabase/migrations/20261024000200_outbox.sql`: — *also revokes Supabase's default grants to `anon`/`authenticated`*
  - `outbox_events` (id uuid, type, job_queue, job_name, job_id unique, payload jsonb, created_at, dispatched_at), with a partial index on undispatched rows.
  - RLS enabled with no policies, so the Data API can't reach it.
  - Grants to `gventz_api`.
- [x] A pgTAP test in `supabase/tests/`:
  - The role exists with `BYPASSRLS`.
  - `audit_log` allows no UPDATE or DELETE for `gventz_api`.
  - `anon` and `authenticated` can't read `outbox_events`.

### Step 3 — Test database from Supabase migrations (gventz-api)
- [x] `test/support/containers.global-setup.ts`: — *done; shared helper in `scripts/db/supabase-db.ts`, image `supabase/postgres:17.11.0.006`*
  - Start a `supabase/postgres` image (version pinned to match the Supabase projects).
  - Apply every file from `GVENTS_MIGRATIONS_DIR`, defaulting to `../G-VENTS/supabase/migrations`, in filename order.
  - Add stubs for anything the image lacks (`auth.uid()`, roles).
  - Set a test password for `gventz_api`.
  - Start Redis.
- [x] The integration tests connect **as `gventz_api`**, so grant gaps fail in tests.
- [x] `docker-compose.yml`: the same Supabase Postgres image plus Redis. Add an `npm run db:local:reset` script that reapplies the migrations.

### Step 4 — Database module on the Supabase pooler
- [x] `DatabaseModule`:
  - Three pools (`web`, `worker`, `reports`) chosen by role.
  - TLS `verify-full` with `DATABASE_CA_FILE`, plus `statement_timeout` (via `SET LOCAL` per transaction) and acquire and idle timeouts.
  - No named prepared statements.
  - `DRIZZLE` and `DRIZZLE_REPORTS` tokens.
- [x] Connection-budget log line at startup.
- [x] Remove `drizzle/`, `migrate.ts` and the `db:generate` / `db:migrate` scripts.
- [x] Add `npm run db:pull`: `drizzle-kit pull` into `src/platform/database/schema/generated/`, then a thin re-export. — *changed: drizzle-kit's generated code doesn't compile (it references `auth.users` and copies policies badly), so `db:pull` writes to `tmp/` for reference only and `tables.ts` is hand-maintained*
  - Replace the hand-written schema files with the generated schema for the existing Supabase tables, plus `outbox_events`.
- [x] Add `npm run db:drift`: pull from the test container and fail if the result differs from the committed schema. Used in CI. — *changed: replaced by `test/integration/schema-drift.integration.spec.ts`, which compares every Drizzle column with the migrated database*
- [x] Commit `certs/supabase-ca.crt` (public CA). — *added (not committed: no git commits yet)*
- [x] Unit tests: pool configuration, TLS options. Integration: role grants, timeouts.

### Step 5 — Transactional outbox
- [x] `platform/outbox/`: — *done; changed: the relay is a 1-second timer on the worker (`OutboxRelayRunner`) instead of a BullMQ repeatable job, so it keeps retrying while Redis is down; routes are registered with `OutboxRegistry`*
  - **`OutboxWriter`:** inserts rows within the ambient transaction.
  - **`UnitOfWork` change:** durable events (marked by a `durable` job mapping on the event class) go to the outbox. In-process events stay on `DomainEventBus` after commit.
  - **`OutboxRelay`:** repeatable `outbox-relay` job, every 1 s, batches of 200 with `FOR UPDATE SKIP LOCKED`; enqueues with the stored job id, then marks the rows dispatched.
  - **Maintenance:** deletes dispatched rows after 7 days.
- [ ] Metrics: `outbox_backlog`, `outbox_dispatch_lag_ms`. (wired in Step 7)
- [x] Tests:
  - unit tests
  - **PBT:** every committed row is enqueued exactly once by job id, under random interleavings of relay runs and failures
  - integration: the transaction rolls back with its rows; dispatch works after a Redis outage

### Step 6 — Resilience module
- [x] `platform/resilience/`: a `CircuitBreaker` interface with an `opossum` implementation, one named breaker per dependency, thresholds from configuration; a `withTimeout` helper; `retry` with backoff and jitter for safe operations. — *changed: own `BreakerState` (pure, clock-driven) instead of `opossum`, so the property test checks our logic; closes after one successful trial*
- [x] `ServiceUnavailable` mapped to 503 `dependency_unavailable`.
- [ ] Metrics: `breaker_state`.
- [x] Tests:
  - unit tests
  - **PBT (stateful):** the breaker state machine (closed → open → half-open → closed) matches a model under random success and failure sequences

### Step 7 — Telemetry and Sentry
- [ ] `src/telemetry/register.ts`, loaded with `--import` before Nest:
  - OpenTelemetry Node SDK with HTTP, Fastify, `pg` and ioredis instrumentations, OTLP exporter and a sampler (10%, plus errors and slow requests).
  - Off when `OTEL_EXPORTER_OTLP_ENDPOINT` is empty (local, CI).
- [ ] `platform/telemetry/`: a `Metrics` interface backed by OpenTelemetry metrics; RED metrics per route; pool use; queue depth and age.
- [ ] Sentry init (`@sentry/nestjs`). `beforeSend` scrubs headers, cookies and bodies. Release = git SHA. Wired into the problem-details filter for 5xx.
- [ ] Tests: telemetry disabled has no side effects; Sentry scrubbing (unit).

### Step 8 — Logging and log export
- [ ] `LoggingModule`:
  - adds the `pino-loki` transport when `LOKI_URL` is set
  - adds `traceId` to log lines
  - updates the redaction list (NFR SECURITY-03)
  - logs every request as an access log (method, route, status, duration, request id)
- [ ] `platform/logging/log-export.job.ts`: repeatable worker job at 03:00 UTC. It queries the Loki API hour by hour for the previous day, writes gzip NDJSON to R2 (`@aws-sdk/client-s3`) under `logs/{env}/{yyyy}/{mm}/{dd}/{hh}.ndjson.gz`, records counts, and on failure retries 5 times then sets the metric `log_export_failed`.
- [ ] Tests: path and chunk calculation (PBT: hours cover the day exactly once); export against a fake Loki and fake S3 (unit).

### Step 9 — Rate limits and HTTP
- [ ] Global per-IP limit default **1500**; health and `/v1/webhooks/*` excluded.
- [ ] `onStoreFailure: 'closed'` support (already in the version 1 design) is pre-registered for the policy names `orders.place`, `checkout.start` and `checkin.scan`. The policies themselves are added by U4 and U7.
- [ ] HSTS `max-age=31536000; includeSubDomains` in helmet.
- [ ] Raw body kept for `/v1/webhooks/*` (for U7), with a 1 MB limit there.
- [ ] Tests updated.

### Step 10 — Configuration
- [ ] `EnvironmentVariables` and config classes:
  - **Added:** `DATABASE_CA_FILE`, pool maximums, `SUPABASE_URL`, `SUPABASE_JWKS_URL`, `SUPABASE_JWT_ISSUER`, `SUPABASE_JWT_AUDIENCE` (used by U2), `OTEL_*`, `LOKI_*`, `SENTRY_*`, `LOG_ARCHIVE_*`, `RATE_LIMIT_GLOBAL_PER_MINUTE`.
  - **Removed:** the obsolete own-auth settings.
  - Production requires the secrets; local and CI use safe defaults.
- [ ] `.env.example` updated.
- [ ] Tests for validation (required in production, defaults in development).

### Step 11 — Health and shutdown
- [ ] Readiness uses the web pool (`select 1`) plus Redis `PING`, each with a 1 s timeout.
- [ ] Shutdown order: stop HTTP, drain, finish jobs, flush telemetry and Sentry, close BullMQ, Redis and pools.
- [ ] Integration test.

### Step 12 — Deployment files (gventz-api)
- [ ] `render.yaml`:
  - Staging web (Starter, `all`) plus Key Value Starter.
  - Production web (Standard, scaling 2 to 6 at CPU 70% and memory 80%) plus worker (Standard) plus Key Value Standard (persistent), with `noeviction`.
  - No databases, no `preDeployCommand`.
  - Region frankfurt, with an O9 note.
  - Plan ids checked against Render's current Blueprint spec.
- [ ] `Dockerfile`: base images pinned by digest; copy `certs/`; `CMD` with the telemetry preload; non-root user.
- [ ] `.github/workflows/ci.yml`:
  - Check out G-VENTS migrations at the ref pinned in `gvents-migrations.ref`.
  - Steps: lint, typecheck, unit with coverage, integration, build, OpenAPI drift, schema drift, `npm audit --audit-level=high`.
- [ ] `.github/workflows/release.yml`: fast-forward `production` on a `v*` tag; CycloneDX SBOM attached to the release; Sentry release step (skipped if no token).
- [ ] `.github/dependabot.yml`: npm, Actions and Docker, weekly.
- [ ] `scripts/generate-secrets.sh`: prints random values for `BFF_SHARED_SECRET`, `REVALIDATE_SECRET`, and the `gventz_api` password (with the one-line SQL to set it).

### Step 13 — Migrations workflow (G-VENTS)
- [ ] `.github/workflows/supabase-migrations.yml`:
  - **Pull request:** `supabase start`, `db reset` and pgTAP.
  - **Push** to `feature/backend-split` or `main` touching migrations: `db push` to staging.
  - **Manual dispatch** `production` with environment protection: `db push` to production.
- [ ] A note in `supabase/README.md` on the order rule: production migrations go before the API release.

### Step 14 — Operations as code and runbooks (gventz-api)
- [ ] `ops/grafana/alerts.yaml`: the alert rules from NFR U1-O6.
- [ ] `ops/grafana/dashboards/operations.json` and `ticketing.json`, minimal panels for the metrics above.
- [ ] `docs/runbooks/`:
  - `deploy-and-rollback.md`
  - `restore-database.md` (RT1)
  - `pre-scale.md`
  - `incident-process.md` (D52, with templates)
  - `alerts/<alert>.md`, one per alert
  - `resiliency-tests.md` (RT1 to RT5 steps)

### Step 15 — Verification
- [ ] gventz-api: lint, typecheck, unit and PBT, integration (Supabase Postgres image with G-VENTS migrations, connecting as `gventz_api`), build, `docker build`, OpenAPI check, schema drift.
- [ ] G-VENTS: `npm run test:db` (pgTAP) if the Supabase CLI is available locally, otherwise an equivalent container run. Existing `npm run lint` / `typecheck` / `test` stay green.
- [ ] Local smoke: `docker compose up`, start with `APP_ROLE=all`, `/health/ready` returns 200, an outbox event round-trip is seen in the logs.

### Step 16 — Documentation
- [ ] `gventz-api/README.md`: run locally, environment, deploy, runbooks.
- [ ] `aidlc-docs/construction/u1-platform-foundation/code/code-summary.md`: a Change 1 section with files changed, decisions, test results, and the owner setup still needed.

## Traceability
| Requirement or story | Steps |
|---|---|
| D33, D35, AD17, AD19 (Supabase pooler, migrations, role) | 2, 3, 4, 13 |
| AD18 (outbox) | 2, 5 |
| AD20, RESILIENCY-05, 07, 10 (telemetry, breakers) | 6, 7, 14 |
| SECURITY-01, 03, 05, 06, 10, 13, 14 | 2, 4, 8, 9, 12 |
| US-9.4 (alerts) | 7, 14 |
| US-9.5 (rolling deploy, rollback) | 12, 14 |
| US-9.6 (restore) | 14 |
| US-9.7 (autoscaling, pre-scale) | 12, 14 |
| PBT-01 to 10 (new properties: outbox exactly-once, breaker model, export hour coverage) | 5, 6, 8 |
