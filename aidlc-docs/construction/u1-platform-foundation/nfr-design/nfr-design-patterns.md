# U1 Platform — NFR Design Patterns (version 2, Change 1)

Version 1 is in `v1/nfr-design-patterns.md`.

**Answers used:**
- **`u1-platform-change1-nfr-design-plan.md`:**
  - **Q1 B:** a resiliency test plan, run in Build and Test, then every quarter.
  - **Q2 A:** general per-IP limit of 1,500 a minute.
  - **Q3 A:** a nightly log export by the worker.
- **Version 1 answers still in force:** BFF key with forwarded client IP; no API response cache; failed enqueues logged.

## 1. Resilience (RESILIENCY-10)

| Pattern | Where | Design |
|---|---|---|
| Timeout on every outside call | All adapters | `AbortSignal.timeout(ms)` passed through `CircuitBreaker.run`. Defaults: JWKS 3 s, listings 4 s, default 5 s, Resend 10 s, providers 10 s. A timeout becomes `ServiceUnavailable` (503 problem `dependency_unavailable`). |
| **Circuit breaker** (changed from version 1) | `ResilienceModule` wrapping `opossum`; one breaker per dependency (`resend`, `places`, `listings:{source}`, `supabase-storage`, `paystack`, `stripe`) | Opens at a 50% error rate over at least 20 calls in a 30 s window. Half-open after 30 s, closes after 3 successes. While open, calls fail at once with `ServiceUnavailable`. State changes are logged and exported as the `breaker_state` metric. |
| **Transactional outbox** (new, AD18) | `OutboxWriter` + `OutboxRelay` | See below the table. |
| In-process events | `DomainEventBus` | Kept for non-durable reactions only, such as metrics and debug logs. |
| Job retries | BullMQ | 5 attempts with exponential backoff (2–32 s) plus ±20% jitter. Final failure → `job.failed_final` log and a `jobs_failed_total` metric, which can be alerted on. Processors are idempotent. |
| Transaction retry | `TransactionRunner` | 40001 and 40P01: up to 3 attempts with 20–80 ms jitter (unchanged). Outbox rows roll back with the transaction, so only committed attempts are dispatched. |
| Redis-down rules | `RateLimiter` policies, `OutboxRelay`, readiness | See below the table. |
| Pooler-down rule | `DatabaseModule` | Acquire timeout 2 s → 503 `dependency_unavailable`. Readiness fails. Alert U1-O6. |
| Graceful shutdown | `main.ts` | On `SIGTERM`: stop accepting, drain in-flight requests (≤ 25 s), finish the active job, flush OpenTelemetry and Sentry, close BullMQ, Redis and the 3 pools. |
| Fail fast at startup | `ConfigModule` | Unchanged. Also validates the Supabase CA file, JWKS URL and pooler URLs. |

**How the outbox works:**
- **Writing:** `OutboxWriter.append(events)` inserts rows into `outbox_events` (id uuid v7, type, payload jsonb, job id, created_at, dispatched_at null), in the same transaction as the change.
- **Relaying:** a repeatable worker job `outbox-relay` runs every 1 s and claims up to 200 undispatched rows (`FOR UPDATE SKIP LOCKED`, ordered by id). For each row it calls `JobQueue.add` with the stored job id, so a repeat is a no-op, then sets `dispatched_at`.
- **Housekeeping:** dispatched rows are deleted after 7 days by the `maintenance` queue.
- **If Redis is down:** the relay leaves rows waiting and retries on the next tick.

**When Redis is down:**
- **Rate limits fail closed** (503 `rate_limiter_unavailable`) for `orders.place`, `checkout.start` and `checkin.scan`. Without Redis we can't stop abuse of inventory or scanning, so those routes refuse rather than guess.
- **Every other policy fails open**, with a warning logged.
- **Outbox rows wait** until Redis is back. No work is lost.
- **Readiness reports `redis: down`**, so Render routes no new traffic to cold instances.

## 2. Scalability (RESILIENCY-09)

| Pattern | Design |
|---|---|
| Stateless instances | Unchanged. Per-request state lives in CLS. |
| Role split | `APP_ROLE=api` / `worker` / `all` (staging). One image. |
| Autoscaling | Production API scales from 2 to 6 instances on CPU 70% and memory 80% (Render autoscaling). Fixed 2 if the workspace has no autoscaling (U1-S3). |
| Pre-scale | Runbook: raise the API minimum to 4 and the Supabase compute to Medium 1 hour before a known peak, then revert. The checklist is in the runbook. |
| Connection budget | Pools per process: web 10, worker 5, reports 2. `pool_max_total = web×10 + worker×5 + reports×2` must stay ≤ 80% of the pooler's client limit (Small ≈ 400). This is enforced as a startup warning: each instance logs its share, and the `db_pool_in_use` metric alerts at 80%. |
| Queue concurrency | Per queue, from config. Default 5. `outbox-relay` uses concurrency 1, with SKIP LOCKED for safety if two workers run. |
| Horizontal-safe correctness | Row locks, unique indexes, conditional updates and Redis `INCR`. Nothing depends on a single instance. |

## 3. Performance

| Pattern | Design |
|---|---|
| Lean pipeline | Fastify. Request id → client context → global limit → token check (JWKS in memory) → validation. |
| JWKS cache | `jose.createRemoteJWKSet` with a 10-minute cooldown. Keys stay in memory. An unknown `kid` triggers one refresh, rate limited to once per 30 s. If refresh fails, cached keys keep working (stale-if-error). |
| Transaction-mode pooler | Queries never rely on session state: no `SET` outside a transaction, no session advisory locks, no `LISTEN`. Per-transaction settings use `SET LOCAL` (for example `statement_timeout`). Named prepared statements are off, and Drizzle uses unnamed queries. |
| Read side | Unchanged: select only the columns needed, indexed `ORDER BY` with `LIMIT`, batched `IN` loads, no N+1. |
| Telemetry cost | Trace sampling 10% (100% for errors and requests over 1 s, tail-sampled through the OTLP endpoint where supported, otherwise head 10% plus error spans). Metrics are batched every 15 s. Logs go asynchronously through the pino transport (worker thread). |
| No API response cache | Unchanged. Public pages are cached by Next.js and revalidated by signal. Redis caches outside listings only. |

## 4. Security

| Pattern | Design | Rule |
|---|---|---|
| TLS to Supabase | `ssl: { ca: <Supabase CA>, rejectUnauthorized: true }`, with `servername` set to the pooler host. The CA file ships in the image (path from config). | SECURITY-01 |
| Database roles | `gventz_api` (login, `NOBYPASSRLS` off, see below) is granted SELECT, INSERT, UPDATE and DELETE only on the tables the API owns or reads. `audit_log` and `ledger_entries` (M4) are INSERT and SELECT only. Created by a G-VENTS migration. Its password lives only in Render. | SECURITY-06, 13 |
| Row-level security stays on (D33) | `gventz_api` gets `BYPASSRLS`, because the API enforces permissions itself. RLS keeps protecting the Supabase Data API path (`anon`, `authenticated`) until those grants are removed after go-live (AD17). | SECURITY-08 (defence in depth) |
| Identity at the edge | `ClientContextMiddleware` (BFF key plus forwarded IP; unchanged), then `AccessTokenGuard` (U2). | SECURITY-08 |
| **General rate limit** (Q2 A) | Policy `global.ip`: **1,500 a minute per client IP**, fail open; health and webhooks excluded. Per-user policies, owned by their units, do the real protection: orders, check-in scans, places. | SECURITY-11 |
| Validation and limits | Global `ValidationPipe`; body 100 KB (webhooks 1 MB, raw body kept); UUID path params → 404. | SECURITY-05 |
| Headers | helmet; HSTS `max-age=31536000; includeSubDomains`; `no-store` on authenticated responses; `x-powered-by` off. | SECURITY-04 (API part) |
| Secrets | Environment only; typed config; pino `redact` (§SECURITY-03 list plus `x-gventz-bff-key`). Sentry `beforeSend` strips headers, cookies and bodies. | SECURITY-03, 12 |
| Error hygiene | `ProblemDetailsFilter`. Unknown errors → 500 `internal_error` with the request id only. | SECURITY-09, 15 |
| **Log retention** (Q3 A) | Logs stay searchable in Grafana Loki for 14 days. Nightly at 03:00 UTC, the worker's `log-export` job queries the Loki API for the previous UTC day, in hourly chunks. It writes gzip NDJSON to R2 (`logs/{env}/{yyyy}/{mm}/{dd}/{hh}.ndjson.gz`) with a **write-only** key, and an R2 lifecycle rule deletes objects after 400 days. A failed export alerts. Each run records its row counts per hour. | SECURITY-14 |
| Supply chain | Lock file; `npm audit --audit-level=high` and Dependabot; SBOM per release; base image pinned by digest. | SECURITY-10 |

## 5. Deploy-Safe Schema Changes (changed: Supabase migrations)

| Rule | Design |
|---|---|
| One source | All DDL lives in `G-VENTS/supabase/migrations/`. gventz-api never runs DDL. |
| Expand, then contract | Add tables or columns (nullable or with defaults) and indexes (`CREATE INDEX CONCURRENTLY` in its own migration). Remove or rename only after go-live, once no running code (old `main` build or API) uses them (AD17). |
| Order | CI in G-VENTS applies migrations to staging when merged, and to production on release, both with `supabase db push`, **before** the API deploy that needs them. The API's generated schema is checked against staging in gventz-api CI. |
| Locks | Every migration starts with `set lock_timeout = '5s'`. |
| No manual changes | No dashboard SQL on live databases (project rule). |

## 6. Resiliency Testing (RESILIENCY-14, Q1 B)

Run in Build and Test on staging before go-live, then every quarter. Results go in `aidlc-docs/construction/build-and-test/resiliency-test-results.md`.

| # | Scenario | Pass when |
|---|---|---|
| RT1 | Point-in-time restore of staging to a chosen time | Service usable within 1 hour; data matches the chosen time to within 2 minutes (after point-in-time recovery is bought, O19) |
| RT2 | Stop Redis | Orders, checkout and scans return 503; reads and other writes work; outbox rows build up; all jobs dispatched within 2 minutes of Redis returning |
| RT3 | Kill the worker mid-queue | No job lost; outbox catches up; no duplicate emails |
| RT4 | Fake email or provider adapter that is slow or failing | Breaker opens within the window; the request path stays fast; it recovers after the dependency returns |
| RT5 | Deploy a build that fails `/health/ready` | Traffic stays on the old version; rollback documented and timed |

## 7. Settings Added or Changed

| Setting | Role | Notes |
|---|---|---|
| `DATABASE_URL` | api, worker | Supabase **pooler** URL (transaction mode), user `gventz_api` |
| `DATABASE_CA_FILE` | api, worker | Path to the Supabase CA bundle in the image |
| `DATABASE_POOL_WEB_MAX`, `DATABASE_POOL_WORKER_MAX`, `DATABASE_POOL_REPORTS_MAX` | api / worker | Defaults 10 / 5 / 2 |
| `SUPABASE_URL`, `SUPABASE_JWKS_URL`, `SUPABASE_JWT_ISSUER`, `SUPABASE_JWT_AUDIENCE` | api | Used by U2 |
| `RATE_LIMIT_GLOBAL_PER_MINUTE` | api | Default **1500** |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_SERVICE_NAME`, `OTEL_TRACES_SAMPLER_ARG` | api, worker | Grafana Cloud OTLP |
| `LOKI_URL`, `LOKI_USER`, `LOKI_TOKEN` | api, worker | `pino-loki` transport; read token for the export job |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` | api, worker | Release = git SHA |
| `LOG_ARCHIVE_S3_ENDPOINT`, `LOG_ARCHIVE_BUCKET`, `LOG_ARCHIVE_ACCESS_KEY_ID`, `LOG_ARCHIVE_SECRET_ACCESS_KEY` | worker | R2, write-only key |
| `MIGRATION_DATABASE_URL` | removed | Migrations run from G-VENTS CI |
