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
