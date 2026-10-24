# U1 Platform — Infrastructure Design (version 2, Change 1)

Version 1 is in `v1/`.

**No new questions were asked at this stage.** These answers already cover it:
- **Version 1 infrastructure answers that still apply:**
  - **Q1 A:** staging deploys automatically; production deploys on a tag.
  - **Q3 A:** hostnames `api.gventz.com` and `api-staging.gventz.com`, DNS still to be confirmed (O3).
  - **Q5 A:** one Render workspace, one project with two environments.
- **Version 1 Q2:** the M1 data copy is no longer needed, because it's the same database.
- **Version 1 Q4 (Render notifications plus UptimeRobot):** replaced by Grafana alerts and synthetics (NFR v2).
- **NFR requirements and design v2:** sizes, pools, alerts, log export.

**Region:** O9 is still open, so **Frankfurt is the default** for every Render resource. If the Supabase production project is elsewhere, the region field in `render.yaml` changes to the nearest Render region before the first production deploy. There is nothing else to redesign.

## 1. Service Mapping

| Logical component | Staging | Production |
|---|---|---|
| API (HTTP) | Render web `gventz-api-staging`, Starter, `APP_ROLE=all` (API and worker), deploys from the backend `main` branch | Render web `gventz-api`, **Standard**, `APP_ROLE=api`, **autoscaling 2 to 6** (CPU 70%, memory 80%), deploys from the `production` branch (moved by a `v*` tag) |
| Worker | same process | Render background worker `gventz-worker`, Standard, `APP_ROLE=worker`, 1 instance |
| Database | Supabase `gvents-staging`, through the **pooler (transaction mode)**, user `gventz_api` | Supabase `gvents-prod`, pooler (transaction mode), user `gventz_api`; Small compute (Medium for peaks); point-in-time recovery before go-live (O19) |
| File storage | Supabase Storage `event-covers` (staging) | Supabase Storage `event-covers` (production) |
| Redis | Render Key Value **Starter** (persistence on), `noeviction` | Render Key Value **Standard** (persistence on), `noeviction` |
| Settings and secrets | Render environment (per service, `sync: false` for secrets) | Render environment group `gventz-production` plus per-service values |
| TLS | Render-managed certificates | Render-managed certificates |
| Hostname | `api-staging.gventz.com` (until DNS: `*.onrender.com`) | `api.gventz.com` |
| Logs, metrics, traces | Grafana Cloud stack (environment label `staging`) | Same stack (environment label `production`) |
| Errors | Sentry project `gventz-api`, environment `staging` | Same project, environment `production` |
| Log archive | R2 bucket `gventz-logs` (prefix `staging/`) | Same bucket (prefix `production/`), lifecycle 400 days |
| Uptime | Grafana synthetic check on `/health/ready` | Grafana synthetic checks on `/health/ready` and `https://gventz.com`, every minute from 2 locations |
| Frontend | Vercel previews (branch `feature/backend-split`) → staging API | Vercel production → production API |

**Removed from version 1:**
- Render Postgres (both environments)
- the `preDeployCommand` migrations
- `MIGRATION_DATABASE_URL`
- the M1 copy script
- UptimeRobot

## 2. Render Layout

```text
Workspace (yours; Professional plan needed for autoscaling)
└── Project "G-ventZ"
    ├── Environment "staging"
    │   ├── web service  gventz-api-staging   (Docker, APP_ROLE=all, branch main)
    │   └── key value    gventz-kv-staging     (Starter, persistent)
    └── Environment "production"   (protected)
        ├── web service  gventz-api            (Docker, APP_ROLE=api, Standard, 2-6 autoscaling, branch production)
        ├── worker       gventz-worker         (Docker, APP_ROLE=worker, Standard)
        ├── key value    gventz-kv-production  (Standard, persistent)
        └── env group    gventz-production
```

If the workspace isn't Professional, the blueprint's `scaling` block is replaced by `numInstances: 2`.

## 3. Database Access (SECURITY-06, SECURITY-01)

**Role.** A G-VENTS migration (U1) creates the login role `gventz_api` with:
- `BYPASSRLS`
- `USAGE` on schema `public`
- `SELECT, INSERT, UPDATE, DELETE` on the application tables it uses
- `SELECT, INSERT` only on `audit_log` and, later, `ledger_entries`
- `USAGE` on sequences

Its password is set once by the owner through the Supabase SQL editor, so no secret is ever kept in git. *This one statement is the only by-hand SQL, and it changes no schema.* The role is then added to the Supabase pooler's allowed users.

**Connection string.** `DATABASE_URL` = `postgres://gventz_api.<project-ref>:<password>@<pooler-host>:6543/postgres`, with TLS verified against the Supabase CA. The CA file is committed in `gventz-api/certs/` and is public.

**Network.** Where the Supabase plan allows network restrictions, only Render's outbound IP ranges for the chosen region are allowed, plus the CI runners for migrations. Otherwise the access controls are the password and TLS.

## 4. Migrations Pipeline (G-VENTS)

**New workflow:** `G-VENTS/.github/workflows/supabase-migrations.yml`.

| Trigger | Target | Steps |
|---|---|---|
| Pull request touching `supabase/migrations/**` | none | Lint SQL; apply all migrations to a throwaway local Supabase (`supabase start`, then `db reset`); run pgTAP tests |
| Push to `feature/backend-split` or `main` touching migrations | **staging** | `supabase link --project-ref $STAGING_REF`, then `supabase db push` |
| Manual dispatch with input `production`, or tag `db-v*` | **production** (environment protection, one approver) | `supabase db push` against `$PROD_REF` |

**Secrets (GitHub environments):** `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD_STAGING`, `SUPABASE_DB_PASSWORD_PROD`, `STAGING_REF`, `PROD_REF`.

**Order rule:** the production migration runs **before** the production API release that needs it, as a checklist item in the release template.

## 5. API CI/CD (gventz-api)

| Step | Where | Detail |
|---|---|---|
| Pull request | `ci.yml` | install → lint → typecheck → unit and PBT → integration (Testcontainers `supabase/postgres` with G-VENTS migrations checked out at a pinned ref) → build → OpenAPI drift → **schema drift** (generated Drizzle schema matches the migrations) → `npm audit --audit-level=high` |
| Merge to `main` | Render staging | Auto-deploy when checks pass. Health check `/health/ready`. Rolling (D51). |
| Tag `v*.*.*` | `release.yml` | Fast-forward `production`; build the CycloneDX SBOM and attach it to the GitHub release; create a Sentry release |
| Production | Render | Web and worker track `production`; auto-deploy when checks pass |
| Rollback | Render dashboard | "Rollback" to the previous deploy (runbook) |

**Dependabot:** npm, GitHub Actions and Docker, weekly.

## 6. Environment Variables

| Setting | Staging (all) | Prod web | Prod worker | Source |
|---|---|---|---|---|
| `NODE_ENV` / `APP_ENV` / `APP_ROLE` | production / staging / all | production / production / api | production / production / worker | literal |
| `LOG_LEVEL` | debug | info | info | literal |
| `DATABASE_URL` (pooler, `gventz_api`) | secret | secret | secret | `sync: false` |
| `DATABASE_CA_FILE` | `certs/supabase-ca.crt` | same | same | literal |
| `DATABASE_POOL_WEB_MAX` / `WORKER_MAX` / `REPORTS_MAX` | 10 / 5 / 2 | 10 / – / 2 | – / 5 / 2 | literal |
| `REDIS_URL` | from Key Value | from Key Value | from Key Value | `fromService` |
| `SUPABASE_URL`, `SUPABASE_JWKS_URL`, `SUPABASE_JWT_ISSUER`, `SUPABASE_JWT_AUDIENCE` | ✓ | ✓ | – | literal per environment |
| `CORS_ORIGINS` | Vercel preview + localhost | `https://gventz.com` | – | literal |
| `BFF_SHARED_SECRET` | secret | secret | – | `sync: false` (also in Vercel) |
| `RATE_LIMIT_GLOBAL_PER_MINUTE` | 1500 | 1500 | – | literal |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_SERVICE_NAME` | ✓ | ✓ | ✓ | secret headers |
| `LOKI_URL`, `LOKI_USER`, `LOKI_TOKEN` | ✓ | ✓ | ✓ (read token for export) | secret |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` | ✓ | ✓ | ✓ | DSN secret; release = commit |
| `LOG_ARCHIVE_*` (R2 endpoint, bucket, write-only key) | ✓ | – | ✓ | secret |
| `RESEND_API_KEY`, `EMAIL_FROM` | ✓ | – | ✓ | secret (U4) |
| `GOOGLE_PLACES_API_KEY`, listing keys | ✓ | ✓ | – | secret (U5) |
| `REVALIDATE_URL`, `REVALIDATE_SECRET` | ✓ | – | ✓ | secret (U5) |
| `SUPABASE_SERVICE_ROLE_KEY` (Storage only) | ✓ | ✓ | ✓ | secret (U5; used only for Storage signed URLs) |

**Removed:**
- `JWT_ACCESS_SECRET`, `SIGN_IN_CODE_SECRET`, `GOOGLE_CLIENT_*` (parked with own-auth)
- `MIGRATION_DATABASE_URL`, `DATABASE_POOL_MAX`

## 7. Backups and Recovery (RESILIENCY-11, 12, 13)

**Supabase:**
- Daily backups on Pro, 7-day retention.
- **Point-in-time recovery add-on before go-live (O19).**
- A restore creates a new project, or restores in place (point-in-time recovery). Then `DATABASE_URL` and the pooler host are updated in Render.

**Redis:**
- Persistence is on.
- If Redis is lost, the outbox replays queued work. Rate-limit counters reset.

**Runbooks** (in `gventz-api/docs/runbooks/`, written in U1 CG):
- `deploy-and-rollback.md`
- `restore-database.md` (RT1)
- `pre-scale.md`
- `incident-process.md` (D52: roles, severity levels, communication template, post-incident review template)
- `alerts/*.md`, one per alert in NFR U1-O6

## 8. Monitoring and Alerting Setup

Alerts are defined as code in `gventz-api/ops/grafana/alerts.yaml`. The owner imports them once, or they're applied with the Grafana CLI. Dashboards live in `ops/grafana/dashboards/*.json`.

**Contact point:** the on-call email address and a Slack webhook (O10).

**Synthetic checks:** `GET https://api.gventz.com/health/ready` and `GET https://gventz.com`, every 60 seconds from 2 probes.

**Backup failures:** a daily worker job calls the Supabase Management API for the latest backup status, and the `backup_check_failed` metric alerts.

## 9. DNS (O3, unchanged)
- `CNAME api` → `gventz-api.onrender.com`
- `CNAME api-staging` → `gventz-api-staging.onrender.com`
- Until DNS is set up, the `onrender.com` addresses are used.

## 10. Owner Setup Checklist (updated)

| # | Step | Needed for |
|---|---|---|
| 1 | Approve the first commit in `gventz-api`. Create the GitHub repository and give me the remote. | Render deploys (O2) |
| 2 | Render: Professional workspace, connect GitHub, apply `render.yaml` | Staging deploy (O7) |
| 3 | Supabase: confirm the production region (O9). Set the `gventz_api` password (one statement, given to you) on staging, then production. Put the pooler URL into Render. | Database access |
| 4 | Supabase: turn on asymmetric JWT signing keys, the Google provider, custom SMTP (Resend), MFA (TOTP) and Turnstile | U2 (O17, O5) |
| 5 | GitHub (G-VENTS): add the Supabase secrets for the migrations workflow | Migrations |
| 6 | Grafana Cloud (free), Sentry, R2 bucket with a write-only key; give me the connection values | Monitoring (O16) |
| 7 | On-call email and Slack webhook | Alerts (O10) |
| 8 | DNS CNAMEs | O3 |
| 9 | Before go-live: Supabase point-in-time recovery add-on | O19 |

Steps 1 to 3 are needed for a staging deploy. Everything else can be built and tested locally (`docker compose` with the Supabase Postgres image) in the meantime.

## Compliance (this stage)

**Security:**

| Rule | Status | Notes |
|---|---|---|
| SECURITY-01 | Compliant | TLS to the pooler; Supabase at-rest encryption; Redis on Render's private network (Key Value internal URL; `ipAllowList: []` blocks public access) |
| SECURITY-02 | Compliant | Render HTTP request logs are available in the Render dashboard, and application access logs (method, route, status, duration, request id) are shipped to Loki for every request |
| SECURITY-06 | Compliant | `gventz_api` least privilege; CI secrets per environment |
| SECURITY-07 | Compliant | Private network for Redis; Supabase network restriction where the plan allows (documented exception otherwise) |
| SECURITY-09 | Compliant | No default credentials; production environment protected |
| SECURITY-10 | Compliant | Dependabot, audit, SBOM, pinned images |
| SECURITY-14 | Compliant | Alerts as code; retention via Loki plus R2 |

**Resiliency:**

| Rule | Status | Notes |
|---|---|---|
| RESILIENCY-04 | Compliant | Rolling deploys, version rollback (D50, D51) |
| RESILIENCY-06 | Compliant | Health check wired to Render routing; synthetics |
| RESILIENCY-08 | Compliant | Single region with 2 or more instances (D47); zones can't be chosen (accepted limit) |
| RESILIENCY-09 | Compliant | Autoscaling 2–6 |
| RESILIENCY-11, 12 | Compliant | Backup and restore; point-in-time recovery gate O19 |
| RESILIENCY-13 | Compliant | Restore and failover runbooks |
| RESILIENCY-15 | Compliant | Incident process runbook (D52) |
