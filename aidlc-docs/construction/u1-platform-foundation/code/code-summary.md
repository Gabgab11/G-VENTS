# U1 Platform Foundation — Code Summary

- **Repository:** `/Users/payazaafrica/gventz-api` (new, `git init` on `main`, **nothing committed**)
- **Plan:** `aidlc-docs/construction/plans/u1-platform-foundation-code-generation-plan.md`, all steps ticked
- **Generated:** 2026-10-23

## Files created

| Area | Files |
|---|---|
| Project | `package.json` (+ lock), `.nvmrc`, `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json` (tsc builder + Swagger plugin), `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, `.gitignore`, `.env.example`, `vitest.config.mts`, `vitest.integration.config.mts`, `docker-compose.yml`, `drizzle.config.ts`, `CLAUDE.md`, `README.md`, `.claude/CLAUDE.md`, `.aidlc-rule-details/` |
| Shared domain | `src/shared/domain/{entity,aggregate-root,value-object,domain-event,domain-error}.ts`, `value-objects/{email,money,iana-time-zone,user-id}.ts` |
| Shared kernel | `src/shared/kernel/{clock,id-generator,page,cursor}.ts` |
| Config | `src/platform/config/{environment,app-config,config.module}.ts` |
| Context | `src/platform/context/{request-context,context.module}.ts` |
| Logging | `src/platform/logging/{logging.module,redaction}.ts` |
| HTTP edge | `src/platform/http/{request-id,client-context,problem-details,problem-details.filter,validation.pipe,parse-uuid-or-404.pipe,public.decorator,configure-http}.ts` |
| Database | `src/platform/database/{database.module,database.tokens,pool,postgres-error,db-error-translator,migrate}.ts`, `schema/{constants,users,events,ticket-tiers,registrations,event-questions,event-members,email,audit-log}.ts` |
| Transactions and events | `src/platform/transaction/{unit-of-work,transactional.decorator}.ts`, `src/platform/events/{domain-event-bus,domain-event-explorer,event-collector,on-domain-event.decorator}.ts` |
| Audit | `src/platform/audit/audit-trail.ts` |
| Redis, rate limits, queues | `src/platform/redis/{redis.module,redis.tokens}.ts`, `rate-limit/{rate-limit-policy,rate-limit-store,redis-rate-limit-store,rate-limiter,global-rate-limit.guard,rate-limit.module}.ts`, `queue/{queues,job-queue,queue.module}.ts` |
| Health and OpenAPI | `src/platform/health/{dependency-health,health.controller,health.module}.ts`, `src/platform/openapi/{openapi,export-openapi}.ts`, `openapi.json` |
| Bootstrap | `src/platform/platform.module.ts`, `src/app.module.ts`, `src/main.ts` |
| Migrations and scripts | `drizzle/0000_baseline.sql` (+ meta), `scripts/db/bootstrap-roles.sql`, `scripts/m1-copy-staging/{index,tables}.ts`, `scripts/generate-secrets.sh` |
| Deploy | `Dockerfile`, `.dockerignore`, `render.yaml`, `.github/workflows/{ci,release}.yml` |
| Tests | 27 unit/PBT files next to the code. `test/support/{setup,fc-config,arbitraries,fake-transaction-host,containers.global-setup,probe.module,test-app}.ts`. `test/integration/{schema,platform,redis-down}.integration.spec.ts` |

## Design to code

| Design item | Code |
|---|---|
| Error model, E1–E6 | `DomainError` family; `ProblemDetailsFilter` + `problem-details.ts`; `translateDbError` |
| Ids, time, money (I1–I3, T1–T2, M1) | `UuidV7Generator`, `ParseUuidOr404Pipe`, `Clock`, `Money` |
| Pagination P1–P4 | `PageRequest`/`Page`, `Cursor`/`CursorRequest`/`toCursorPage` |
| Rate limiting R1–R5 | `RateLimiter` + `RedisRateLimitStore`, `GlobalRateLimitGuard` (300/min per caller IP) |
| Domain events D1–D5, jobs J1–J4 | `UnitOfWork` (collect, then dispatch after commit, then retry), `@Transactional()`, `DomainEventBus` + `@OnDomainEvent`, `JobQueue` + `DEFAULT_JOB_OPTIONS` |
| Audit A1–A4 | `AuditTrail.record()` inside the transaction; `audit_log.event_id` set null on delete |
| Requests Q1–Q4 | Fastify `genReqId` + CLS middleware; `ClientContextResolver` (BFF key, forwarded IP); `createValidationPipe`; `@Public()` |
| Config C1–C4 | `validateEnvironment` (lists names only), typed config classes |
| Health H1–H3 | `HealthController` (`live`, `ready` with 1 s checks, 503 naming the failed check) |
| NFR design: degraded mode, shutdown | Redis connects at startup but the app starts without it; tolerant close; enqueue failure logged as `job.enqueue_failed` |
| Least-privilege roles | `scripts/db/bootstrap-roles.sql` (tested by running it with psql in the test container) |

## PBT properties → tests (PBT-01..PBT-10)

| Property (business-logic-model §7) | Test file |
|---|---|
| Email round-trip / idempotence / invariant | `email.pbt.spec.ts` |
| Money commutativity, associativity, invariants | `money.pbt.spec.ts` |
| Cursor round-trip, decode totality | `cursor.pbt.spec.ts` |
| Pager oracle, page invariants | `page.pbt.spec.ts` |
| ProblemDetailsFilter kind→status, no message leak | `problem-details.filter.pbt.spec.ts` |
| RateLimiter vs fixed-window model (oracle) | `rate-limiter.pbt.spec.ts` |
| UnitOfWork + DomainEventBus stateful (commit and rollback sequences) | `unit-of-work.pbt.spec.ts` |
| Request id invariant and idempotence | `request-id.pbt.spec.ts` |
| IanaTimeZone round-trip | `iana-time-zone.pbt.spec.ts` |

- Generators live in `test/support/arbitraries.ts` and are domain-shaped (PBT-07).
- `fcParams()` defaults to 200 runs, prints the seed, and replays with `FC_SEED`/`FC_PATH` (PBT-08).
- Every PBT file has an example-based `*.spec.ts` beside it (PBT-10).

## Verification results (2026-10-23, local)

| Check | Result |
|---|---|
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm test` (unit + PBT) | **27 files, 124 tests, all pass** |
| `npm run test:integration` (Postgres 18, Redis 7) | **3 files, 17 tests, all pass** |
| `npm run build` | pass |
| `npm run openapi:export` / `openapi:check` | pass (no business endpoints yet, so the document has no paths) |
| `docker build` | pass on retry (the first attempt hit a Docker daemon 500 unrelated to the image) |
| Smoke run of `node dist/main.js` | `/health/live` 200; `/health/ready` 200; unknown route returns 404 problem JSON with the request id echoed; security headers present; `/openapi.json` and `/docs` 200; SIGTERM stops cleanly |
| M1 copy script against a fake staging DB | users merged (1 user without an email skipped and reported); bad themes normalized; `active_count` computed; ticket codes, jsonb and text[] kept; audit sequence reset; refuses a production source and a non-staging target |
| Coverage (report only; gate blocks M3) | unit 53.2% lines, integration 67.0% lines, measured separately. The combined figure is produced in Build and Test. |

## Changes from the design, made during generation
1. **Retry-After** waits for the *latest* blocking window, since every window must pass. The design said "earliest". business-rules R3 and business-logic-model §3 are corrected.
2. **PostgreSQL 18.** Render's Blueprint spec lists 18 as the newest version, which follows NFR Q5 A ("newest major"). Docker compose, Testcontainers and `render.yaml` use 18. Render plan ids are the real ones (`0.5c-512mb`, `256mb`, `0.1c-256mb`, `0.5c-1g`). Notes were added in deployment-architecture.md, infrastructure-design.md and tech-stack-decisions.md.
3. **Layer rules use ESLint's built-in `no-restricted-imports`** instead of `eslint-plugin-boundaries`, whose v7 rule syntax is undocumented in the package. The same rules are enforced.
4. **`@nestjs/event-emitter` dropped.** `DomainEventBus` is a small ordered registry, so dispatch order and handler isolation are explicit and tested.
5. **The `@Transactional()` decorator is the platform's own.** It wraps the library's `TransactionHost` in a `UnitOfWork`, because the library has no after-commit hook.
6. **Redaction convention.** Sign-in codes must be logged (if ever) only under the field `signInCode`. Generic `code` fields (error codes) stay readable.
7. **`Cache-Control: no-store` on every API response** unless a route sets its own. Public caching happens in Next.js (NFR design Q2 A).
8. **The `@typescript-eslint/consistent-type-imports` rule is off**, because NestJS DI needs constructor types as value imports.

## Known gaps (tracked)
- **Processor registration by role:** no queue processors exist yet. U2 adds the first one (sign-in email), and with it the rule that processors register only when `APP_ROLE` includes the worker.
- **Transaction retry on a real 40001/40P01:** tested with a fake transaction host, not with a real deadlock.
- **Not run on Render yet:** needs the GitHub repo (O2), Render setup, secrets and the Supabase staging connection string (checklist in deployment-architecture.md).
- **`openapi.json` is generated but not committed.** It goes in with the first commit.
- **Local services:** docker compose Postgres and Redis are left running locally, with the tables emptied after testing.

---

# Change 1 rework (2026-10-24)

- **Plan:** `aidlc-docs/construction/plans/u1-platform-change1-code-generation-plan.md`. Every step is ticked; deviations are noted on the step.
- **Repositories:** `/Users/payazaafrica/gventz-api` (no commits yet) and G-VENTS branch `feature/backend-split` (uncommitted).
- **Own-auth (U2 v1):** removed from the tree; the snapshot is `/Users/payazaafrica/gventz-api-own-auth-snapshot.tar.gz`, because no first commit was approved for a `parked/own-auth` branch.

## What changed

| Area | Change | Files |
|---|---|---|
| Schema (G-VENTS) | `gventz_api` login role: grants per table, one RLS policy per table for this role only, insert-only audit, `extensions` usage, statement timeout 5 s | `supabase/migrations/20261024000100_api_role.sql` |
| Schema (G-VENTS) | `outbox_events`; RLS on; default grants to `anon` and `authenticated` revoked | `supabase/migrations/20261024000200_outbox.sql` |
| Tests (G-VENTS) | pgTAP for the role and outbox; regenerated `database.types.ts` | `supabase/tests/api_role_and_outbox.test.sql`, `src/lib/supabase/database.types.ts` |
| CI/CD (G-VENTS) | Deploy migrations: staging on push, production by hand with approval | `.github/workflows/supabase-migrations.yml`, `supabase/README.md` |
| Database | Supabase pooler, three pools, TLS with Supabase CA; hand-maintained column maps plus a drift test; Drizzle migrations removed | `src/platform/database/{pool,database.module,database.tokens}.ts`, `schema/tables.ts`, `certs/`, `test/integration/schema-drift.integration.spec.ts` |
| Test database | Supabase's Postgres image with G-VENTS migrations, tests connect as `gventz_api` | `scripts/db/{supabase-db,reset-local}.ts`, `scripts/db/sql/supabase-stubs.sql`, `test/support/containers.global-setup.ts`, `docker-compose.yml` |
| Outbox | Registry, writer (inside the UnitOfWork transaction), relay with SKIP LOCKED, 1-second worker loop, 7-day clean-up | `src/platform/outbox/*`, `src/platform/transaction/unit-of-work.ts` |
| Resilience | Clock-driven breaker state machine, `CircuitBreaker` with timeouts, retry with jitter | `src/platform/resilience/*` |
| Telemetry | OpenTelemetry SDK preload, Sentry (errors only), `Metrics`, RED metrics per route, pool, breaker, outbox and queue gauges | `src/telemetry/register.ts`, `src/platform/telemetry/*`, `src/platform/http/configure-http.ts` |
| Logging | Loki transport, trace ids, payment-field redaction, nightly export to R2 | `src/platform/logging/{logging.module,redaction,log-archive,log-export.job}.ts` |
| HTTP | HSTS, raw body kept, per-IP limit 1,500, webhooks excluded, fail-closed policies return 503 | `configure-http.ts`, `src/platform/rate-limit/*`, `src/main.ts` |
| API docs (user request) | `/api/docs`: modern Swagger UI with a System / Light / Dark switch; `/` redirects there; off in production | `src/platform/openapi/{openapi,docs-theme}.ts`, `test/integration/api-docs.integration.spec.ts` |
| Config | Supabase, pools, telemetry, log settings; own-auth settings removed | `src/platform/config/*`, `.env.example` |
| Deploy | Blueprint without Render Postgres, autoscaling 2–6, digest-pinned image, CI with G-VENTS migrations, SBOM, Sentry release, Dependabot | `render.yaml`, `Dockerfile`, `.github/{workflows/ci.yml,workflows/release.yml,dependabot.yml}`, `gvents-migrations.ref`, `scripts/generate-secrets.sh` |
| Operations | 13 alert rules, 2 dashboards, runbooks (deploy/rollback, restore, pre-scale, incidents, drills, 12 alert pages) | `ops/grafana/*`, `docs/runbooks/*` |

## Verification (2026-10-24, local)

| Check | Result |
|---|---|
| gventz-api lint, typecheck | Clean |
| Unit and property-based tests | 150 passed (36 files) |
| Integration tests (Supabase Postgres 17 image + G-VENTS migrations, as `gventz_api`; Redis 7) | 33 passed (6 files) |
| Build, OpenAPI check | Pass (snapshot regenerated: own-auth paths removed) |
| Docker image | Builds; started in production mode it refuses an unencrypted database (TLS required), and in test mode it serves `/health/ready` with Postgres and Redis up, HSTS and `no-store` headers |
| G-VENTS with Supabase CLI 2.121.0 | `db lint` clean; `test db` 17/17; types regenerated; `npm run lint`, `typecheck`, `npm test` (39) green |
| Docs page in a browser | Viewed by the product owner (dark theme and switch work). Fixed after review: Authorize button text and icon made white for contrast; health endpoints now listed under "Health" so the page isn't empty before U2 |
| Coverage | 60.7% lines (gate of 80% applies at go-live, Build and Test) |

New property tests: outbox delivers every committed row exactly once by job id, in order, under flaky relays; breaker state machine against a model; retry backoff bounds; log archive hours cover a day exactly once.

## Changes from the design

1. **No `BYPASSRLS` for `gventz_api`:** a per-table RLS policy for the role gives the same access, keeps RLS on, and doesn't depend on Supabase allowing the attribute.
2. **No generated Drizzle schema:** `drizzle-kit pull` output doesn't compile (it references `auth.users` and copies policies badly). Column maps are hand-written and a drift test compares them with the database.
3. **Outbox relay and log export are timers on the worker,** not BullMQ repeatable jobs, so they keep working while Redis is down.
4. **Own breaker** instead of `opossum`, so the property test checks our logic. It closes after one successful trial (the design said three).
5. **Body limit stays 100 KB** for webhooks too (Paystack and Stripe payloads are small); revisit in U7.
6. **Local database port 55432,** so it doesn't clash with the Supabase CLI's 54322.
7. **API docs page added** at the user's request; shown on local and staging only (SECURITY-09).

## Findings for later units

- **U3:** Supabase's `audit_log.event_id` foreign key is `on delete cascade`, so deleting an event deletes its audit rows. The U3 design expects them to survive. U3 needs a migration changing it to `on delete set null`.
- **U2:** the alert on failed token checks expects `auth_token_rejected_total` from the token guard.
- **Follow-up:** the daily Supabase backup check (`backup_check_failed`) needs a Supabase Management API token (owner item); its alert rule is ready.
- **U7:** `webhook_rejected_total` metric and the webhook body limit.

## Owner items still open

O9 (Supabase region; Blueprint uses Frankfurt), O19 (point-in-time recovery before go-live), O7 (Render workspace), O16 (Grafana, Sentry, R2), O10 (on-call contact), the first commits and GitHub remote for gventz-api, and the GitHub environment secrets for the migrations workflow.
