# U1 Platform Foundation — Infrastructure Design

Answers used (u1-platform-foundation-infrastructure-design-plan.md):
- **Q1 A:** staging deploys automatically, production deploys on a tag or by hand.
- **Q2 A:** a one-off copy of staging data for M1.
- **Q3 A:** `api.gventz.com` and `api-staging.gventz.com`. The DNS provider is still to be confirmed (O3).
- **Q4 A + B:** Render's notifications plus an external uptime check.
- **Q5 A:** one Render workspace, one project, two environments.

Earlier decisions: Render in Frankfurt (D2, D9), the newest Postgres major (NFR Q5), start-small sizes (NFR Q7), stdout logs (NFR Q6).

## 1. Service mapping

| Logical component | Staging | Production |
|---|---|---|
| API (HTTP) + worker | 1 Render **web service**, Docker, smallest paid instance, `APP_ROLE=all` | Render **web service** `gventz-api`, Starter (`0.5c-512mb`), `APP_ROLE=api` |
| Worker | (same process as API) | Render **background worker** `gventz-worker`, Starter (`0.5c-512mb`), `APP_ROLE=worker`, same image |
| PostgreSQL | Render Postgres, smallest paid plan, newest major, Frankfurt | Render Postgres **Basic** (`0.5c-1g`; daily backups, point-in-time recovery if the plan includes it), PostgreSQL 18, Frankfurt |
| Redis (cache, rate limits, BullMQ) | Render Key Value, **free** tier (no persistence) | Render Key Value, smallest **paid** plan with persistence on, `maxmemoryPolicy: noeviction` (required by BullMQ) |
| Secrets and settings | Environment group `gventz-staging` | Environment group `gventz-production` |
| TLS | Render-managed certificates | Render-managed certificates |
| Hostname | `api-staging.gventz.com` (until DNS: `gventz-api-staging.onrender.com`) | `api.gventz.com` (until DNS: `gventz-api.onrender.com`) |
| Logs | Render log view (stdout) | Render log view (stdout) |
| Alerts | Render email notifications | Render email notifications + UptimeRobot (free) on `/health/ready` every 5 minutes |
| Frontend | Vercel preview deployments → staging API | Vercel production (`gventz.com`, functions in `fra1`) → production API |

All services are in **Frankfurt**. The API, worker, Postgres and Key Value talk over Render's private network, using internal connection strings, never the public ones.

## 2. Render layout (Q5 A)

```text
Workspace (yours)
└── Project "G-ventZ"
    ├── Environment "staging"
    │   ├── web service  gventz-api-staging   (Docker, APP_ROLE=all)
    │   ├── postgres     gventz-db-staging
    │   ├── key value    gventz-kv-staging     (free)
    │   └── env group    gventz-staging
    └── Environment "production"
        ├── web service  gventz-api            (Docker, APP_ROLE=api)
        ├── worker       gventz-worker         (Docker, APP_ROLE=worker)
        ├── postgres     gventz-db-production
        ├── key value    gventz-kv-production  (paid, persistent)
        └── env group    gventz-production
```

Environments are isolated. Production secrets are never set in staging, and staging can't reach production's private network.

## 3. Database roles (NFR design §4)

Render creates one owner user per database. A one-time bootstrap script (`scripts/db/bootstrap-roles.sql`, run once per database by the owner) creates:

| Role | Rights | Used by |
|---|---|---|
| Render owner user (`gventz_owner`) | Owns the schema | `MIGRATION_DATABASE_URL` in the pre-deploy step; the bootstrap script; the data migration tool (U6) |
| `gventz_app` | `CONNECT`; `USAGE` on schema `public`; `SELECT, INSERT, UPDATE, DELETE` on all tables; `USAGE, SELECT` on sequences; default privileges for future tables created by the owner | `DATABASE_URL` for the API and worker |

`DATABASE_URL` is built from the internal host plus the `gventz_app` credentials and stored as a secret in the environment group. `MIGRATION_DATABASE_URL` uses the owner connection string from the database.

## 4. Environment variables per service

| Setting | Staging web (all) | Prod web (api) | Prod worker | Source |
|---|---|---|---|---|
| `NODE_ENV` | production | production | production | literal |
| `APP_ENV` | staging | production | production | literal (log field and safety checks) |
| `APP_ROLE` | all | api | worker | per service |
| `PORT` | 10000 (Render default) | 10000 | — | Render |
| `LOG_LEVEL` | debug | info | info | group |
| `DATABASE_URL` (`gventz_app`) | ✓ | ✓ | ✓ | group secret |
| `MIGRATION_DATABASE_URL` (owner) | ✓ | ✓ | — | from database |
| `DATABASE_POOL_MAX` | 10 | 10 | 5 | group |
| `REDIS_URL` | ✓ | ✓ | ✓ | from Key Value (internal) |
| `CORS_ORIGINS` | Vercel preview + localhost | `https://gventz.com` | — | group |
| `BFF_SHARED_SECRET` | ✓ | ✓ | — | group secret (also in Vercel) |
| `JWT_ACCESS_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE` | ✓ | ✓ | — | group secret (U2) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URIS` | ✓ | ✓ | — | group secret (U2, O4) |
| `RESEND_API_KEY`, `EMAIL_FROM` | ✓ | — | ✓ | group secret (U2, O5) |
| `CLOUDINARY_URL` | ✓ | ✓ | ✓ | group secret (U5, O6) |
| `GOOGLE_PLACES_API_KEY` | ✓ | ✓ | — | group secret (U5) |
| `TICKETMASTER_API_KEY`, `PREDICTHQ_TOKEN`, `ICAL_FEEDS` | optional | optional | — | group (U5) |
| `REVALIDATE_URL`, `REVALIDATE_SECRET` | ✓ | — | ✓ | group secret (U5) |

`NODE_ENV=production` everywhere on Render, so production behaviour (required settings, no `/docs` UI) is the default. Only `APP_ENV` differs. `/docs` is shown when `APP_ENV` isn't `production`.

## 5. CI/CD (Q1 A)

| Step | Where | Detail |
|---|---|---|
| Pull request | GitHub Actions `ci.yml` | install → lint → typecheck → unit + PBT → integration (Testcontainers) → build → OpenAPI drift check. Required check for merging. |
| Merge to `main` | Render staging | Auto-deploy **after CI checks pass** (Render "deploy when checks pass"). Pre-deploy: `npm run db:migrate`. Health check: `/health/ready`. |
| Release | GitHub Actions `release.yml` | On a pushed tag `v*.*.*`, fast-forward branch `production` to the tag. |
| Production deploy | Render production | Both services track branch `production`. Auto-deploy on that branch after checks pass, or "Manual Deploy" from the dashboard. Pre-deploy migrations run once, on the web service. |

Production therefore changes only when you tag a release or deploy by hand.

## 6. Backups and recovery
- **Postgres:** Render's daily backups, plus point-in-time recovery if the plan includes it. Restoring creates a new database; `DATABASE_URL` is then pointed at it. Recovery time objective: 4 hours (O8, assumed).
- **Before every production migration** that changes or drops data, take a manual backup or export from the Render dashboard (runbook step in U6).
- **Key Value:** persistence on in production; jobs survive restarts. Losing Redis loses only queued jobs and rate-limit counters (logged, Q3 A).
- **Rollback:** Render "Rollback" to the previous deploy. Expand-and-contract migrations keep the previous version compatible (NFR design §5).

## 7. Monitoring and alerts (Q4 A + B)
- **Render notifications** to your email: deploy failed, service failed or unhealthy, for both environments.
- **UptimeRobot** (free plan): an HTTPS monitor on `https://api.gventz.com/health/ready` every 5 minutes, alerting by email. A second monitor on staging is optional. Set it up once DNS is live (until then, the `onrender.com` address).
- **Logs:** the Render log view, with search by `requestId`.

## 8. M1 data copy (Q2 A)

A one-off script, `scripts/m1-copy-staging/`, copies data for M1. U6 replaces it with the real migration tool.

1. Connect to Supabase **staging** using its direct connection string, and only read.
2. Connect to Render staging as the owner.
3. In dependency order, copy:
   1. `auth.users` merged with `profiles` into `users`: same id, email, `email_confirmed_at` → `email_verified_at`, then name, country, theme.
   2. `events`, with `active_count` computed from registrations.
   3. `ticket_tiers`
   4. `registrations`
   5. `event_questions`
   6. `event_members`
   7. `email_campaigns`
   8. `email_suppressions`
   9. `audit_log`
4. It truncates the target first, so it can be run again during M1 work.
5. Flyers aren't copied for M1. `cover_url` keeps pointing at Supabase Storage, which stays public until U6.
6. It never connects to Supabase **production**. The script refuses to run if the source project ref isn't staging's.

## 9. DNS (Q3 A, O3)
- The provider for `gventz.com` is **to be confirmed** by you.
- When it is, add:
  - `CNAME api` → `gventz-api.onrender.com`
  - `CNAME api-staging` → `gventz-api-staging.onrender.com`
- Then add both custom domains in Render, which issues the certificates.
- Until then, the `onrender.com` addresses are used in Vercel's `API_BASE_URL` and in Google's redirect URIs (U2).
