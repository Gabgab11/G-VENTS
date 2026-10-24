# U1 Platform Foundation — Code Generation Plan

This plan is the single source of truth for U1 code generation. Steps run in order, and each is ticked as soon as it's done.

## Unit context
- **Unit:** U1 Platform foundation, entirely M1 (unit-of-work.md).
- **Code location:** `/Users/payazaafrica/gventz-api` (new repository, AD1). Nothing goes into `aidlc-docs/` except the summary in step 16.
- **Toolchain:** Node 22 (`~/.nvm/versions/node/v22.23.3`), npm, Docker 29 (for Testcontainers and docker compose).
- **Requirements covered:** NFR-1 (structure, boundaries), NFR-2/3 baseline, NFR-4 (health, shutdown), NFR-5 platform parts, NFR-6, NFR-7 harness, FR-16.
- **Design inputs:**
  - `u1-platform-foundation/functional-design/*` (entities, rules, logic model, Testable Properties)
  - `nfr-requirements/*`, `nfr-design/*`, `infrastructure-design/*`
- **Depends on:** nothing.
- **Depended on by:** every other unit, which uses shared base classes, platform modules, the schema and the test harness.
- **Database entities owned:** the schema baseline for every table (domain-entities.md §3). Identity tables come later in U2.
- **Interfaces exposed:**
  - **Base classes and errors:** `AggregateRoot`, `ValueObject`, `DomainError` family, `DomainEvent`.
  - **Data access:** `TransactionHost` and `@Transactional()`, `DomainEventPublisher` and `@OnDomainEvent()`, `AuditTrail`, `DbErrorTranslator`.
  - **Redis-backed:** `RateLimiter`, `JobQueue`.
  - **Time and ids:** `Clock`, `IdGenerator`.
  - **Pagination:** `PageRequest`, `Cursor`.
  - **HTTP:** `@Public()` marker (the guard itself arrives in U2).
- **Not committed:** files are created in the new repository but not committed. You decide when to commit and push (repository rule).

## Steps

### Step 1 — Repository setup
- [x] Create `/Users/payazaafrica/gventz-api` and run `git init`.
- [x] Add the project files:
  - `package.json` with scripts: `start:dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:pbt`, `test:integration`, `test:cov`, `db:generate`, `db:migrate`, `openapi:export`, `openapi:check`
  - `.nvmrc` (22), `tsconfig.json` (strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`, decorators), `tsconfig.build.json`, `nest-cli.json`
  - `.gitignore`, `.env.example`, `.prettierrc`
- [x] `eslint.config.mjs` with `typescript-eslint` and `eslint-plugin-boundaries`, using the layer rules from components.md §1.
- [x] `vitest.config.ts` with SWC (unit and PBT) and `vitest.integration.config.ts` (Testcontainers, longer timeouts). Coverage via v8 (report only).
- [x] `docker-compose.yml`: Postgres 17 and Redis 7.
- [x] `CLAUDE.md` with the project brief and a pointer to G-VENTS `aidlc-docs/`. Copy `.claude/CLAUDE.md` and `.aidlc-rule-details/` from G-VENTS (O2).
- [x] Install the dependencies from tech-stack-decisions.md and pin them in `package-lock.json`.

### Step 2 — Shared domain building blocks (`src/shared/`)
- [x] `domain/`: `Entity`, `AggregateRoot`, `ValueObject`, `DomainEvent`, `DomainError` with `ErrorKind`, plus common subclasses: `ValidationFailed`, `NotFoundError`, `ConflictError`, `InvalidError`, `UnauthenticatedError`, `ForbiddenError`, `RateLimitExceeded`, `ServiceUnavailable`.
- [x] `kernel/`: `Clock` (`SystemClock`, `FixedClock`), `IdGenerator` (`UuidV7Generator`), `PageRequest`, `Page`, `Cursor`, `CursorRequest`, `CursorPage`, `paginateInMemory` (test oracle helper).
- [x] `domain/value-objects/`: `Email`, `Money` (with `CurrencyMismatch`), `IanaTimeZone`, `UserId`.

### Step 3 — Shared tests (example-based and PBT)
- [x] `*.spec.ts` example tests for each class: known good and bad emails, money arithmetic, cursor errors, page offsets, time zones.
- [x] `*.pbt.spec.ts` properties from business-logic-model.md §7:
  - `Email` round-trip, idempotence and invariant
  - `Money` commutativity, associativity and invariants
  - `Cursor` round-trip and decode totality
  - Pager oracle and page invariants
  - `IanaTimeZone` round-trip
- [x] Shared fast-check arbitraries in `test/support/arbitraries.ts`: emails, money, cursor keys, time zones.

### Step 4 — Configuration (`src/platform/config/`)
- [x] Typed config classes (`AppConfig`, `DatabaseConfig`, `RedisConfig`, `HttpConfig`, `QueueConfig`, `RateLimitConfig`) validated with class-validator, with role-aware required rules (business-rules §9). Integration settings for later units are declared optional in U1 and become required when their unit arrives.
- [x] The startup error lists the names of missing settings, never their values.
- [x] Example tests per role and environment.

### Step 5 — Logging (`src/platform/logging/`)
- [x] `nestjs-pino` setup: JSON to stdout, `pino-pretty` in development, redaction paths (U1-SEC2), health at `debug`, request context fields (requestId, userId, clientIp truncated).
- [x] Example tests for the redaction list.

### Step 6 — HTTP edge (`src/platform/http/`)
- [x] `RequestIdMiddleware`, `ClientContextMiddleware` (BFF secret, constant-time compare, forwarded IP validation, truncation), `ProblemDetailsFilter`, `createValidationPipe()`, `ParseUuidOr404Pipe`, `@Public()` decorator.
- [x] `configureHttp(app)`: helmet, CORS allowlist, `/v1` URI versioning, body limit 100 KB, `trustProxy`, `no-store` on authenticated responses, shutdown hooks.

### Step 7 — HTTP edge tests
- [x] Example tests for each middleware, filter and pipe.
- [x] PBT:
  - `ProblemDetailsFilter`: kind → status, and the code is preserved.
  - `ProblemDetailsFilter`: no leak of non-domain error messages.
  - `RequestIdMiddleware`: output always valid; a valid id is kept unchanged.

### Step 7a — CLS context (`src/platform/context/`)
- [x] `nestjs-cls` module set up once: `requestId`, `client`, `user` slot, transaction, event collector. `RequestContext` accessor class.

### Step 8 — Database, transactions, events, audit (`src/platform/database/`, `transaction/`, `events/`, `audit/`)
- [x] `schema/`: Drizzle table definitions for `users`, `events`, `ticket_tiers`, `registrations`, `event_questions`, `event_members`, `email_campaigns`, `email_suppressions`, `audit_log`. These carry today's check constraints, unique and partial indexes, and FKs, with the agreed changes:
  - The `users` merge.
  - `active_count` and `cover_public_id` on `events`.
  - `audit_log.event_id` set to null on delete, with its new indexes.
- [x] `DatabaseModule`: `pg` Pool (limits, `statement_timeout`, `idle`, `connect` timeouts), Drizzle instance, shutdown.
- [x] `TransactionModule`: `@nestjs-cls/transactional` with the Drizzle adapter. A `TransactionRunner` retries on `40001` and `40P01` up to 3 times with jitter.
- [x] `DomainEventBus`: a per-transaction collector, after-commit dispatch in order, `@OnDomainEvent()` handler registration, handler isolation, and an error if an aggregate is saved outside a transaction. A rollback clears the collector.
- [x] `AuditTrail.record()` in the ambient transaction, with the action catalogue type (business-rules §7).
- [x] `DbErrorTranslator` for 23505, 23514 and 23503.

### Step 9 — Migrations and roles
- [x] `drizzle.config.ts`. Generate `drizzle/0000_baseline.sql` from the schema and review it, adding `lock_timeout`.
- [x] `src/platform/database/migrate.ts`, run by `npm run db:migrate` against `MIGRATION_DATABASE_URL`.
- [x] `scripts/db/bootstrap-roles.sql`: creates `gventz_app` with grants and default privileges. Parameterised password via `psql -v`.

### Step 10 — Redis, rate limiting, queues (`src/platform/redis/`, `rate-limit/`, `queue/`)
- [x] `RedisModule`: a command client plus a BullMQ connection factory.
- [x] `RateLimiter` interface. `RedisRateLimiter` implements fixed windows with `INCR` + `EXPIRE` in a `MULTI`, `retryAfter`, and `onStoreFailure`. `InMemoryRateLimitStore` is for tests.
- [x] `GlobalRateLimitGuard` (`global.ip`, 300/min, health routes excluded).
- [x] `JobQueue<T>` wrapper over BullMQ with the standard options (J1–J4) and the `job.enqueue_failed` log. The `email`, `revalidation` and `media-cleanup` queues are registered. Processors are registered only when `APP_ROLE` includes worker.

### Step 11 — Platform logic tests
- [x] Example tests: rate-limit windows and `Retry-After`; fail open and fail closed; `JobQueue` options and enqueue-failure log; event bus ordering and handler isolation; transaction retry on 40001.
- [x] PBT:
  - `RateLimiter` model-based oracle against an in-memory fixed-window model (PBT-05).
  - `DomainEventBus` + transaction stateful property with fast-check `commands` (PBT-06): random save / commit / rollback sequences.

### Step 12 — Health, OpenAPI, bootstrap
- [x] `HealthModule` (`@nestjs/terminus`): `live`, and `ready` (Postgres `select 1` and Redis `PING` with 1 s timeouts).
- [x] `OpenApiModule`: Swagger document, `/openapi.json`, `/docs` when `APP_ENV` isn't production; `scripts/export-openapi.ts` writes `openapi.json`.
- [x] `src/app.module.ts` and `src/main.ts`: Fastify adapter, `APP_ROLE` (api, worker, all), graceful shutdown ≤ 25 s.
- [x] A worker-only bootstrap path (Nest application context, no HTTP listener).

### Step 13 — Integration tests (`test/integration/`, Testcontainers Postgres 17 + Redis 7)
- [x] Migrations apply cleanly to an empty database, and the schema has the expected constraints.
- [x] Transactions: commit dispatches events once; rollback dispatches none and writes no audit entry; nested calls join.
- [x] Audit trail: an entry is written only on commit; it survives event deletion (`set null`).
- [x] `DbErrorTranslator` maps a real unique violation and a real check violation.
- [x] `RedisRateLimiter` on real Redis matches the in-memory behaviour; fail-open when Redis is stopped.
- [x] HTTP end-to-end through Fastify (`app.inject`):
  - health live and ready
  - ready returns 503 when Redis is stopped
  - problem-details body for a sample failing route
  - validation 400 shape, request id echo, BFF client IP handling
  - global rate limit 429 with `Retry-After`

### Step 14 — Deployment artifacts
- [x] `Dockerfile` (multi-stage, `node:22-slim`, non-root, `dist` + `drizzle/`) and `.dockerignore`.
- [x] `render.yaml` from the deployment-architecture outline, with field names checked against Render's Blueprint docs.
- [x] `.github/workflows/ci.yml`: lint, typecheck, unit + PBT, integration, build, OpenAPI drift.
- [x] `.github/workflows/release.yml`: tag `v*.*.*` → fast-forward `production`.
- [x] `scripts/generate-secrets.sh` prints random values for `BFF_SHARED_SECRET`, `JWT_ACCESS_SECRET` and `REVALIDATE_SECRET`.

### Step 15 — M1 staging data copy (`scripts/m1-copy-staging/`)
- [x] A one-off TypeScript command (infrastructure-design §8). It reads Supabase staging, refuses any other project ref, truncates the target, and merges `auth.users` + `profiles` into `users`. It then copies the tables in dependency order and computes `active_count`.
- [x] Prints a row-count table.
- [x] Not run in this step: running it needs the Supabase staging connection string (setup checklist #8).

### Step 16 — Documentation
- [x] `README.md` in gventz-api: what it is, local setup (`nvm use`, `docker compose up -d`, `npm ci`, `npm run db:migrate`, `npm run start:dev`), scripts, structure, layer rules, environment variables, deploy summary.
- [x] `aidlc-docs/construction/u1-platform-foundation/code/code-summary.md` in G-VENTS: files created, design-to-code mapping, how the PBT properties map to tests, known gaps.

### Step 17 — Verify
- [x] `npm run lint`, `npm run typecheck`, `npm test` (unit + PBT), `npm run test:integration`, `npm run build`, `npm run openapi:export`.
- [x] `docker build` of the image.
- [x] Record the results (pass or fail, with output) in code-summary.md. Failures are fixed before the completion message, or reported as they are.

## PBT coverage in this plan (PBT-01..PBT-10)
| Rule | Where |
|---|---|
| PBT-01 properties carried forward | Steps 3, 7, 11, matching business-logic-model.md §7 |
| PBT-02 round-trip | Email, Cursor, IanaTimeZone (step 3) |
| PBT-03 invariants | Email, Money, pages, filter, request id (steps 3, 7) |
| PBT-04 idempotence | Email normalization, request id (steps 3, 7) |
| PBT-05 oracle | Pager vs `paginateInMemory`; RateLimiter vs model (steps 3, 11) |
| PBT-06 stateful | DomainEventBus + transaction commands (step 11) |
| PBT-07 generator quality | Domain arbitraries in `test/support/arbitraries.ts`, no unconstrained strings where a domain type exists (step 3) |
| PBT-08 shrinking and reproducibility | fast-check defaults; seed printed on failure; `FC_SEED` / `FC_NUM_RUNS` env read in a shared `fcConfig` (step 3) |
| PBT-09 framework | fast-check + `@fast-check/vitest` dependency (step 1) |
| PBT-10 complementary | Every PBT-covered component also has example tests in a separate `*.spec.ts` (steps 3, 7, 11) |

## Traceability
| Requirement | Steps |
|---|---|
| NFR-1 architecture | 1 (boundaries lint), 2, 7a, 8 |
| NFR-2 performance baseline | 6, 8 (pool), 12 (Fastify) |
| NFR-3 scalability | 7a (CLS, no shared state), 10 |
| NFR-4 availability | 12 (health, shutdown), 14 |
| NFR-5 security (platform) | 4, 5, 6, 9 (roles), 10 (rate limits) |
| NFR-6 observability | 5, 6 |
| NFR-7 testing | 3, 7, 11, 13, 17 |
| FR-16 operations | 9, 12, 14 |
| Q5 B audit | 8, 13 |
