# U1 Platform Foundation — Tech Stack Decisions

The versions are release lines. Exact versions are pinned in `package-lock.json` when the project is set up.

## Runtime and framework

| Concern | Choice | Reason | Rejected |
|---|---|---|---|
| Runtime | Node.js 22 LTS | D1; long-term support; native `fetch`, `AbortSignal.timeout` | Bun (NestJS support less proven) |
| Language | TypeScript 5.x, strict | D1, D6 | — |
| Framework | NestJS 11 | D1; dependency injection fits the OOP design | — |
| HTTP adapter | Fastify (`@nestjs/platform-fastify`) | Q1 A; higher throughput, lower latency | Express |
| Package manager | npm | Q4 A; same as the frontend | pnpm |
| Compiler for tests and dev | SWC (`@swc/core`, `unplugin-swc`) | Fast; supports decorator metadata for NestJS DI | ts-jest, tsc in watch mode |

## Data

| Concern | Choice | Reason | Rejected |
|---|---|---|---|
| Database | PostgreSQL 18 (newest major on Render at creation), Frankfurt | D4, D8, D9, Q5 A | MongoDB (Clarification 7) |
| Driver | `pg` (node-postgres) with a bounded `Pool` | Mature; supported by Drizzle and the transaction adapter | `postgres` (postgres.js): less support in the CLS adapter |
| ORM / query builder | Drizzle ORM + Drizzle Kit (migrations) | D10; typed SQL, no runtime magic, good for read-side queries | Prisma (heavier runtime, weaker raw SQL), TypeORM |
| Transactions | `@nestjs-cls/transactional` + `@nestjs-cls/transactional-adapter-drizzle-orm` | AD5 | Hand-passed transaction objects |
| IDs | `uuid` package, v7 | Q4 A | Database-generated v4 |

## Redis, queues, caching

| Concern | Choice | Reason | Rejected |
|---|---|---|---|
| Redis | Render Key Value (Redis-compatible): free tier on staging, paid with persistence in production | D14, Q7 A | Upstash (another provider) |
| Client | `ioredis` | Required by BullMQ; cluster-ready | `redis` (node-redis) |
| Queue | BullMQ (`@nestjs/bullmq`) | AD4; free MIT library; retries, backoff, job ids | pg-boss |
| Domain events in process | `@nestjs/event-emitter`, behind the platform `DomainEventBus` (after commit) | AD4 | — |

## API surface

| Concern | Choice | Reason | Rejected |
|---|---|---|---|
| Validation | `class-validator` + `class-transformer` | Q3 A; class DTOs suit the OOP style | Zod |
| OpenAPI | `@nestjs/swagger` with the CLI plugin | D21; generated from DTOs and controllers | Hand-written spec |
| Versioning | NestJS URI versioning (`/v1`) | AD9 | Header versioning |
| Errors | Custom `ProblemDetailsFilter` (RFC 9457) | AD7 | Built-in Nest exception body |
| Security headers | `@fastify/helmet` | U1-SEC5 | — |
| CORS | `@fastify/cors` (via Nest `enableCors`) | U1-SEC4 | — |
| Health | `@nestjs/terminus` | FR-16 | Hand-rolled |
| Config | `@nestjs/config` with class-validator–validated config classes | Business-rules §9 | envalid |
| JWT | `jose` | Standards-complete; HS256 now, RS256 later | `jsonwebtoken` |

## Observability

| Concern | Choice | Reason | Rejected |
|---|---|---|---|
| Logging | `nestjs-pino` + `pino` (JSON to stdout) | Q6 A, D28; fast, built-in redaction | winston |
| Local log formatting | `pino-pretty` (development only) | Readable local output | — |

## Testing (PBT-09)

| Concern | Choice | Reason | Rejected |
|---|---|---|---|
| Test runner | Vitest + `@vitest/coverage-v8` | Q2 A; same as the frontend | Jest |
| Property-based testing | **fast-check** (+ `@fast-check/vitest`) | PBT-09: custom arbitraries for domain types, automatic shrinking, seed replay (`seed`, `path`), Vitest integration | jsverify (unmaintained) |
| Containers | Testcontainers (`@testcontainers/postgresql`, `@testcontainers/redis`) | NFR-7; real Postgres and Redis | Mocks of the database |
| HTTP e2e | `supertest` through Nest's Fastify adapter (`app.inject` where simpler) | Endpoint tests without a network port | — |
| Load benchmark | `autocannon` (on demand) | U1-P1 | k6 (separate binary) |

## Quality and build

| Concern | Choice | Reason |
|---|---|---|
| Lint | ESLint 9 (flat config) + `typescript-eslint` + `eslint-plugin-boundaries` | U1-M2 layer rules |
| Format | Prettier | U1-M3 |
| CI | GitHub Actions: install, lint, typecheck, unit, integration (Testcontainers on the runner's Docker), build, OpenAPI drift check | U1-M3, U1-M4 |
| Container | Multi-stage `Dockerfile` on `node:22-slim` (Render runs it as a Docker service) | Same image for API and worker |
| Local services | `docker-compose.yml`: Postgres (same major as Render) and Redis 7 | U1-T5 |
| Hosting definition | `render.yaml` blueprint: web service, background worker, Postgres, Key Value, environment groups | Infrastructure Design |

## Services (accounts owned by the product owner)

| Service | Used by | Open item |
|---|---|---|
| Render (API, worker, Postgres, Key Value) | U1 | O7 |
| Google Cloud OAuth client | U2 | O4 |
| Resend | U2, U4 | O5 |
| Cloudinary | U5 | O6 |
| Google Places, Ticketmaster, PredictHQ | U5 | existing keys |
| GitHub repository `gventz-api` | all | O2 (local repo first) |
