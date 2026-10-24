# U1 Platform — NFR Requirements (version 2, Change 1)

Version 1 is in `v1/nfr-requirements.md`.

**Sources:**
- requirements v2.1 (NFR-1 to NFR-8, D37, D45 to D53)
- the application design v2 (AD11 to AD20)
- the answers in `construction/plans/u1-platform-change1-nfr-requirements-plan.md`

**How the answers were read:**
- **Q1:** start on Supabase Small compute. The point-in-time recovery purchase is deferred, see U1-A3.
- **Q2:** staging stays as it is today. The backend's `main` branch is the one that deploys.
- **Q3:** "just build". The sizes below are defaults in the blueprint, and the owner confirms them when buying.
- **Q4 B:** Grafana free tier, plus a daily export for 90 days.
- **Q5 A:** the starting alert thresholds.
- **Q6 A:** k6.
- **Q7:** the region is still open (O9).

U1 sets the baseline that every unit inherits. Per-endpoint targets are set in U4 and U7.

## 1. Performance and Capacity

| ID | Requirement | Target | Checked by |
|---|---|---|---|
| U1-P1 | Platform overhead per request: request id, token check (cached JWKS), validation, error mapping, logs, tracing | ≤ 5 ms p95, excluding the database and outside calls | autocannon or k6 on a no-op authenticated route |
| U1-P2 | Token check | Local verification. JWKS cached for 10 minutes and refreshed in the background. No network call per request. | Unit test asserts no I/O on the hot path |
| U1-P3 | Database pools (AD19) | Through the Supabase pooler (transaction mode).<br>**Per process:** `web` 10, `worker` 5, `reports` 2.<br>**Timeouts:** acquire 2 s; statement 5 s (`reports` 30 s). | Configuration tests; timeout integration test |
| U1-P4 | Connection budget | Total = web instances × 10 + worker × 5 + reports × 2. Stays at or below 80% of the pooler client limit for the compute size. **Small: about 400** pooler clients, so up to 6 web instances fit with headroom. | Checked when the instance maximum changes; alert at 80% (U1-O6) |
| U1-P5 | Outbox relay | Events are dispatched within 2 s p95 of commit, and the backlog clears faster than the 50/s burst | Integration test; `outbox_backlog` metric |
| U1-P6 | Startup | Ready within 15 s on a Standard instance | Deploy logs |

## 2. Scalability (RESILIENCY-09)
- **U1-S1. Stateless API.** No shared in-memory state. Rate limits, cache and queues live in Redis. Holds and counters live in Postgres.
- **U1-S2. Separate roles.** The same build runs as the API or the worker (`APP_ROLE`), as separate Render services.
- **U1-S3. Default sizes in the blueprint** (Q3, confirmed at purchase):

  | Service | Size | Instances |
  |---|---|---|
  | Production API | Standard | Autoscaling **2 to 6**, on CPU 70% / memory 80% |
  | Production worker | Standard | 1 |
  | Production Key Value | Standard, with persistence | — |
  | Staging | Starter, `APP_ROLE=all` | 1 |

  If autoscaling isn't bought (no Professional workspace), production runs a fixed **2** API instances, and scaling is manual.
- **U1-S4. Pre-scale.** The production API minimum is raised to 4, and the Supabase compute to Medium, one hour before the December event's doors open or any announced sales opening. Both are reverted afterwards. This is a runbook step (US-9.7).
- **U1-S5. Quotas written down:**
  - Supabase pooler clients and Auth email and OTP rate limits
  - Render instance maximum
  - Resend daily volume
  - Grafana free-tier limits (logs 50 GB/month, metrics 10k series)
  - Utilization alerts at 80% where a metric exists.

## 3. Availability and Recovery (RESILIENCY-02, 08, 11, 12, 13)
- **U1-A1. Target:** 99.9% monthly, with a recovery time of 1 hour (D46).
- **U1-A2. Zero-downtime rolling deploys** (D51). The new instance must pass `/health/ready` before it gets traffic. The old one drains for up to 25 s.
- **U1-A3. Recovery point (D46: about 2 minutes) needs Supabase point-in-time recovery.**
  - Per Q1, the add-on isn't bought yet. Until it is, the real recovery point is **up to 24 hours** (daily backups on Pro).
  - **Enabling point-in-time recovery is a go-live gate (M3 checklist)** and an owner item (O19).
  - The design is unchanged either way.
- **U1-A4. Single region, at least 2 instances** (D47). Zones can't be chosen on Render or Supabase; this is an accepted limit. No cross-region recovery.
- **U1-A5. Backups:**
  - Supabase daily backups, encrypted at rest. Retention is the Pro default (7 days).
  - A quarterly test restore. The first one is the restore drill before go-live.
  - Redis persistence on, so queued jobs survive a restart. The outbox can rebuild any lost queue jobs from Postgres.
- **U1-A6. Degraded mode** (RESILIENCY-10):

  | Failure | Behaviour |
  |---|---|
  | Redis down | API keeps serving. Rate limits fail open, except for `checkout.start`, `orders.place` and `checkin.scan`, which fail **closed** with 503 to protect inventory. The outbox keeps writing and the relay catches up later. Readiness fails, so new instances won't take traffic. |
  | Supabase pooler down | Readiness fails and requests get 503 quickly (acquire timeout 2 s). Raises an alert. |
  | Outside dependency down | Its circuit breaker opens and the feature degrades as in application design NFR-5. |
- **U1-A7. Runbooks**, delivered in U1 and Build and Test:
  - deploy and roll back
  - restore (backup or point-in-time)
  - pre-scale
  - one runbook per alert
  - a communication plan for incidents (D52)

## 4. Security (Security Baseline on)

| Rule | U1 requirement |
|---|---|
| SECURITY-01 | Supabase connections over TLS with certificate verification (`sslmode=verify-full`, Supabase CA bundle in the image). Redis on Render's private network; TLS used where Render's internal Key Value supports it (confirmed in Infra Design). Supabase encrypts storage at rest. |
| SECURITY-02 | Render HTTP access logs and Vercel logs shipped to Grafana. |
| SECURITY-03 | pino JSON logs with timestamp, request id, level and message. Redaction list: `authorization`, `cookie`, `set-cookie`, tokens, `signInCode`, `password`, `secret`, card-like fields. Emails masked. |
| SECURITY-04 | API: helmet, HSTS (1 year, subdomains), `nosniff`, `no-store` on authenticated responses. HTML pages are served by Next.js (U6). |
| SECURITY-05 | Global validation pipe with whitelist and forbid unknown fields. Body ≤ 100 KB (webhooks ≤ 1 MB, raw body kept for signatures). Parameterized SQL only. |
| SECURITY-06 | The database role `gventz_api` can reach only the tables it needs, and isn't `service_role` or `postgres`. Migrations run with the owner role from CI or the Supabase CLI only. |
| SECURITY-07 | API and worker reach Redis on Render's private network only. Supabase network restrictions allow only Render's outbound IPs (if the plan supports it; Infra Design). |
| SECURITY-08 | Global deny-by-default guard, provided in U2. CORS limited to frontend origins. |
| SECURITY-09 | No default credentials. Swagger UI off in production. Generic 500s. Pinned current runtime (Node 22 LTS). |
| SECURITY-10 | Committed lock file; `npm audit --audit-level=high` and Dependabot in CI; CycloneDX SBOM per release; base image pinned by digest; no `latest` tags. |
| SECURITY-11 | Rate limiter on every public route (policies per unit). Security-critical code isolated (Identity, Payments). |
| SECURITY-12 | Handled by Supabase Auth plus U2 guards. Secrets only in Render and Vercel environment settings, never in the repo. |
| SECURITY-13 | `audit_log` is append-only for the app role (INSERT only, no UPDATE or DELETE). CI workflow changes need a pull request review. |
| SECURITY-14 | Security alerts (§6). **Log retention: Grafana free tier keeps 14 days searchable, and a daily export to object storage (for example Cloudflare R2, with a write-only key) keeps 90 days or more** (Q4 B). The app can't delete exported logs. |
| SECURITY-15 | Global exception filter. `unhandledRejection` and `uncaughtException` are logged, sent to Sentry, and the process restarts. Transactions roll back. Fail closed on authorization. |

## 5. Reliability (RESILIENCY-10)
- **U1-R1. Timeouts on every outside call.** Defaults: 5 s, Resend 10 s, payment providers 10 s, listings 4 s, JWKS 3 s.
- **U1-R2. Circuit breaker per dependency.** Opens after 50% failures over at least 20 calls in 30 s, half-opens after 30 s.
- **U1-R3. Retries** with exponential backoff and jitter, for operations that are safe to repeat. Jobs get 5 attempts from 2 s, then a final failure is logged and alerted.
- **U1-R4. Transaction retries:** serialization and deadlock errors (40001, 40P01) are retried up to 3 times.
- **U1-R5. Outbox:** delivery is at least once, and every handler is idempotent.
- **U1-R6. Graceful shutdown:** stop new requests, finish in-flight work and the active job, flush telemetry, close the pools.

## 6. Observability and Alerting (RESILIENCY-05, 06, 07; SECURITY-14)
- **U1-O1. Logs:** stdout → Grafana Loki (free tier, 14 days), plus a daily export for 90 days.
- **U1-O2. Traces:** OpenTelemetry, from the Next.js server action to the API to the worker job. Sampling is 10% normally, and 100% for errors and slow requests.
- **U1-O3. Metrics:** RED per route (rate, errors, duration), pool use, queue depth and age, outbox backlog, breaker state, instance CPU and memory. Business metrics: orders, tickets issued, scans (green and red), holds (M4).
- **U1-O4. Errors** go to Sentry from the API, the worker and Next.js, with releases tagged by git commit.
- **U1-O5. Dashboards:** "Operations" and "Ticketing"; "Payments" is added in M4.
- **U1-O6. Alerts** (Q5 A) go to email and Slack for on-call (O10):

  | Area | Alert when |
  |---|---|
  | API errors | 5xx above 1% of requests for 5 minutes |
  | API latency | p95 above 500 ms for 10 minutes |
  | Readiness | Failing for 2 minutes |
  | Queues | Oldest job older than 5 minutes; outbox backlog above 1,000 |
  | Capacity | Database connections above 80%; CPU above 80% at the maximum instance count |
  | Backups | Backup check failure |
  | Security | More than 20 failed token checks a minute from one IP; permission denials 5 times normal; bad webhook signatures (M4) |
  | Uptime | External uptime check every minute from 2 locations |

- **U1-O7. Health checks:** `/health/live` (process) and `/health/ready` (Postgres, Redis), used by Render routing. Synthetic uptime checks come from Grafana.

## 7. Change and Deployment (RESILIENCY-03, 04; D48 to D51)
- **Changes:** every change is a pull request with one approval, CI green, and a rollback note in the pull request template.
- **Deploys:** the backend's **`main` branch deploys to staging** automatically once checks pass (Q2). Production deploys on a `v*` release tag.
- **Rollback:** Render redeploys the previous image. Migrations are additive, so there is never a database rollback.
- **Migrations:** applied by CI with the Supabase CLI, staging first and then production at release, never by hand.

## 8. Maintainability
Unchanged from version 1 (U1-M1 to M4):
- strict TypeScript
- layer lint rules
- Prettier
- CI checks
- OpenAPI snapshot drift check

Plus:
- **U1-M5 (changed):** no Drizzle migrations. The Drizzle schema is generated from Supabase, and CI fails if it drifts.

## 9. Testing
- Version 1 U1-T1 to T5 apply: unit tests, PBT with fast-check, Testcontainers, 80% coverage gated at go-live, local Docker stack.
- **The test database is built from `G-VENTS/supabase/migrations`**, with stubs for the Supabase `auth` schema and roles.
- **Load test (k6):**
  - Scenarios: a ticket burst on one ticket type, door scanning, browsing.
  - Run in Build and Test against staging. Staging's Supabase compute is raised to match production for the run, then lowered again.
  - Pass criteria: NFR-2.4.
- **Resiliency tests:** Redis down, pooler timeout, breaker open, outbox catch-up after a worker restart.

## Owner Items Raised by This Stage
| # | Item | Needed by |
|---|---|---|
| O9 | Supabase production region | U1 Infrastructure Design |
| O19 | **Buy the Supabase point-in-time recovery add-on** (recovery point of about 2 minutes) | M3 go-live gate |
| O7 | Render workspace (Professional for autoscaling, otherwise a fixed 2 instances) and the services in U1-S3 | First staging deploy |
| O16 | Grafana Cloud (free) and Sentry accounts; an object storage bucket for the 90-day log export | M2 |
