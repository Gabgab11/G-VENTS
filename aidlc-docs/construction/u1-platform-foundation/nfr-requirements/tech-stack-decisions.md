# U1 Platform — Tech Stack Decisions (version 2, Change 1)

Version 1 is in `v1/tech-stack-decisions.md`. Everything there stands unless it is listed as **changed** or **removed** below. Exact versions are pinned in `package-lock.json`.

## Changed

| Concern | Version 1 | Version 2 | Reason |
|---|---|---|---|
| Database | Render Postgres 18 | **Supabase Postgres** (existing projects `gvents-staging` and `gvents-prod`) through the **Supabase pooler (Supavisor), transaction mode** | D31, D33. The pooler gives IPv4 access from Render and a large client budget. |
| Driver settings | `pg` Pool | `pg` Pool ×3 (web, worker, reports); TLS `verify-full` with the Supabase CA; no named prepared statements (transaction-mode pooler) | AD19, SECURITY-01 |
| Migrations | Drizzle Kit generate and migrate | **Supabase CLI** (`supabase db push`) from `G-VENTS/supabase/migrations`, run by CI. **Drizzle Kit `pull`** generates the TypeScript schema. | D35 |
| Access tokens | `jose`, our own HS256 signing | `jose` **`createRemoteJWKSet`** to verify Supabase asymmetric tokens | AD14 |
| Lint boundaries | `eslint-plugin-boundaries` | `no-restricted-imports` rules (already implemented in U1 code) | Version 1 build finding |
| Load test | autocannon | **k6** (scenarios), plus autocannon for micro-benchmarks | Q6 A |
| Logging destination | stdout and the Render dashboard | stdout, plus **`pino-loki`** transport to Grafana Cloud Loki (free tier, 14 days), plus a **daily NDJSON export to S3-compatible object storage** (Cloudflare R2, write-only key) for 90+ days | Q4 B, SECURITY-14. Export details in NFR Design. |
| Postgres in tests | Testcontainers Postgres with Drizzle migrations | Testcontainers **`supabase/postgres`** image, with `G-VENTS/supabase/migrations` applied and auth schema stubs | D35 |

## Added

| Concern | Choice | Reason | Rejected |
|---|---|---|---|
| Tracing and metrics | **OpenTelemetry** Node SDK (`@opentelemetry/sdk-node`, HTTP, Fastify, `pg` and ioredis instrumentations, OTLP exporter) → Grafana Cloud | AD20, RESILIENCY-05 | Vendor agents (lock-in) |
| Error tracking | **Sentry** (`@sentry/nestjs` on the API; `@sentry/nextjs` in U6) | D53 | Rollbar |
| Circuit breaker | **`opossum`**, wrapped by the platform `CircuitBreaker` interface | RESILIENCY-10; mature, with metrics events | Hand-rolled |
| Outbox relay | Postgres table plus a BullMQ repeatable job (`outbox-relay`, every second, `FOR UPDATE SKIP LOCKED` batches) | AD18 | Debezium or logical replication (too heavy) |
| Uptime and synthetics | Grafana Cloud Synthetic Monitoring (free tier) | RESILIENCY-06 | Separate uptime service |
| SBOM | `@cyclonedx/cyclonedx-npm` in the release workflow | SECURITY-10 | — |
| Vulnerability scanning | `npm audit --audit-level=high` in CI, plus Dependabot (npm, GitHub Actions, Docker) | SECURITY-10 | Paid scanners |
| Log export | `@aws-sdk/client-s3` against R2 (S3 API) | Q4 B | — |

## Removed (parked with U2 own-auth or replaced)
- `openid-client`: Google sign-in is now done by Supabase.
- Our own access-token signing key ring: Supabase signs tokens.
- Render Postgres: replaced by Supabase.
- The `drizzle/` migrations folder: replaced by Supabase migrations.
- Cloudinary SDK (version 1 U5): replaced by Supabase Storage (`@supabase/storage-js` or signed-URL REST calls; chosen in U5).

## Services (owned by the product owner)

| Service | Plan (default, Q1/Q3: confirm at purchase) | Used by | Item |
|---|---|---|---|
| Supabase | Pro, Small compute (Medium for the December peak); **point-in-time recovery add-on before go-live** | all | O19, O9 |
| Render | Professional workspace for autoscaling (or a fixed 2 instances); Standard API ×2 to 6, Standard worker, Key Value Standard; staging Starter | U1 | O7 |
| Grafana Cloud | Free tier (logs 14 days, metrics, traces, synthetics, alerting) | U1 | O16 |
| Cloudflare R2 (or any S3-compatible store) | Pay-as-you-go; 90-day log archive | U1 | O16 |
| Sentry | Developer (free) or Team | U1, U6 | O16 |
| Resend | Plan sized for 20,000+ emails a day | U2 (Supabase SMTP), U4 | O5 |
| GitHub | `gventz-api` repository | all | O2 |
| Paystack, Stripe | Business accounts | U7, U8 | O15 |
