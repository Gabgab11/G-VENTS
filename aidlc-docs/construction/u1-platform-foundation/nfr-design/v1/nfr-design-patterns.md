# U1 Platform Foundation — NFR Design Patterns

Answers used (u1-platform-foundation-nfr-design-plan.md):
- **Q1 A:** timeouts and retries, no circuit breaker yet.
- **Q2 A:** no API-side response cache.
- **Q3 A:** log enqueue failures.
- **Q4 A:** BFF secret and forwarded client IP, plus a general per-IP limit.

## 1. Resilience

| Pattern | Where | Design |
|---|---|---|
| Timeout on every outside call | All adapters (`GoogleOidcClient`, `PlacesClient`, `ExternalEventSource`, `Mailer`, `FileStorage`, `RevalidationClient`) | Each call takes an `AbortSignal.timeout(ms)`: 4 s for listings, 5 s default. Timeouts are logged at `warn` and become `unavailable` errors (business-rules E5). |
| Retry with exponential backoff | BullMQ jobs | 5 attempts: 2, 4, 8, 16, 32 s. Deterministic `jobId` makes enqueueing idempotent. Processors are idempotent (Resend `Idempotency-Key` = jobId). |
| Transaction retry | `TransactionRunner` wrapping `@Transactional()` | On Postgres `40001` (serialization) or `40P01` (deadlock): retry up to 3 times with 20–80 ms random jitter. Domain events are collected again on each attempt, so only the committed attempt dispatches. |
| No circuit breaker (Q1 A) | — | Not added now. Revisit if logs show one source repeatedly hitting its timeout. The adapter interfaces allow wrapping one later without touching services. |
| Fail fast at startup | `ConfigModule` | Invalid configuration stops the process before it listens (business-rules C1). |
| Degraded mode without Redis | `RateLimiter`, `JobQueue`, readiness | Rate limits fail open, except `signInCode.request` (fail closed). Enqueue failures are logged at `error` with queue, name and jobId (Q3 A), and the request still succeeds. `/health/ready` reports `redis: down`. |
| Graceful shutdown | `main.ts` | `SIGTERM` → stop accepting requests, wait for in-flight requests and the active job (≤ 25 s), close BullMQ workers, then Redis, then the pool. Nest `enableShutdownHooks()`. |
| Lost-side-effect visibility (Q3 A) | `DomainEventBus` | Every failed enqueue logs `{ event: "job.enqueue_failed", queue, jobName, jobId, aggregateId }`. A missed ticket email can be found by registration id and resent. |

## 2. Scalability

| Pattern | Design |
|---|---|
| Stateless instances | No in-process state shared between requests. Per-request state lives in CLS (request id, user, transaction, event collector) and is discarded at the end. |
| Role split | `APP_ROLE=api` (HTTP only), `worker` (BullMQ processors only), `all` (both, staging and M1). One Docker image. |
| Queue concurrency | Default 5 concurrent jobs per queue per worker. Set per queue in config (`QUEUE_EMAIL_CONCURRENCY` and so on). Resend and Cloudinary limits stay well above this at design load. |
| Connection budget | Pool size per process from config (default 10). Rule U1-S3 is checked when instances are added. Long work (data migration) uses its own small pool. |
| Horizontal-safe concurrency | Correctness never depends on running a single instance. Database row locks, unique indexes and Redis atomic `INCR` give the same guarantees across instances. |

## 3. Performance

| Pattern | Design |
|---|---|
| Lean request pipeline | Fastify adapter. Guards and pipes are synchronous where possible. JWT verified locally with a key held in memory. No per-request database lookup for authentication. |
| Single cache layer (Q2 A) | Public pages are cached by Next.js (tags, revalidated by signal). The API keeps no response cache. Redis caching only for outside listings (1 hour, FR-9.3). |
| Read-side queries | Query services select only the needed columns straight into DTOs. List queries always have a `LIMIT` and use indexes that match their `ORDER BY` (P3). No N+1: related rows load in one query or one batched `IN` query. |
| Prepared statements | Drizzle prepared queries for the hottest paths (ticket by code, event by slug, access check). |
| Pool tuning | `max` from config; `idleTimeoutMillis` 30 s; `connectionTimeoutMillis` 2 s; `statement_timeout` 5 s, set per connection. |
| Response serialization | DTO classes define output. Fastify serializes plain objects. Large responses are always paginated. |
| Logging cost | pino asynchronous destination. Health checks logged at `debug`. Request bodies are never logged. |

## 4. Security

| Pattern | Design |
|---|---|
| Edge validation | Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`). Every string has `@MaxLength`. Body limit 100 KB (Fastify `bodyLimit`). `ParseUUIDPipe` variant that throws `NotFound`. |
| Caller identity behind the BFF (Q4 A) | `ClientContextMiddleware` resolves `clientIp` and `via`. See the flow below. |
| General rate limit (Q4 A) | Global guard, policy `global.ip`: 300 requests a minute per `clientIp`, fail open. Health routes are excluded. Specific policies (sign-in, Places, registration) apply on top. |
| Token handling | Access tokens are verified with `jose` (algorithm pinned, issuer and audience checked, 30 s clock tolerance). Refresh tokens never pass through the access guard. |
| Secrets | Only from the environment, through typed config classes. pino `redact` paths for headers and body fields (U1-SEC2). `x-gventz-bff-key` is also redacted. |
| Headers | `@fastify/helmet` defaults (no CSP needed for a JSON API). `Cache-Control: no-store` on authenticated responses. `x-powered-by` off. |
| CORS | `CORS_ORIGINS` allowlist, `credentials: false`. |
| Least-privilege database roles | `gventz_app` can select, insert, update and delete on application tables, and use sequences. `gventz_owner` owns the schema and runs migrations in the pre-deploy step. The app's `DATABASE_URL` uses `gventz_app`; `MIGRATION_DATABASE_URL` uses `gventz_owner`. |
| Error hygiene | `ProblemDetailsFilter` (business-rules E1–E6). Stack traces only in logs. |

How `clientIp` and `via` are resolved:
- **Header set and matching:** if `x-gventz-bff-key` matches `BFF_SHARED_SECRET` (constant-time compare), then `via = "web"` and `clientIp` = `x-gventz-client-ip`, but only if that is a valid IPv4 or IPv6 address.
- **Header set but wrong:** the request is treated as direct, and a `warn` is logged.
- **Header absent:** `via = "direct"` (mobile and other callers), and `clientIp` is the connection IP from Render's proxy (`trustProxy`, first hop).
- `clientIp` feeds the rate limiter and the logs, as a truncated IP (last IPv4 octet zeroed).

## 5. Deploy-safe schema changes

| Rule | Design |
|---|---|
| Expand and contract | A deploy may only add columns or tables, add nullable columns, or add indexes `CONCURRENTLY`. Removing or renaming happens in a later deploy, after no running code uses the old shape. During a deploy the old instance keeps running against the new schema. |
| Migrations before traffic | Render `preDeployCommand: npm run db:migrate` runs as `gventz_owner`. A failed migration stops the deploy, and the old version keeps serving. |
| Locks | Migrations set `lock_timeout = 5s` so a blocked migration fails instead of stalling traffic. |
| Reviewable SQL | Drizzle Kit generates SQL files into `drizzle/`. They are committed and reviewed like code. |

## 6. Configuration added by this design
| Setting | Role | Notes |
|---|---|---|
| `BFF_SHARED_SECRET` | api | ≥ 32 bytes. Same value set in Vercel for the Next.js server. |
| `MIGRATION_DATABASE_URL` | pre-deploy only | Owner role |
| `QUEUE_<NAME>_CONCURRENCY` | worker | Optional, default 5 |
| `RATE_LIMIT_GLOBAL_PER_MINUTE` | api | Optional, default 300 |
