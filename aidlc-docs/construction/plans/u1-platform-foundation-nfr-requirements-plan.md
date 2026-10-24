# U1 Platform Foundation — NFR Requirements Plan

Most of the stack is decided already: NestJS 11, Node 22, TypeScript strict, Drizzle, Render Postgres and Redis in Frankfurt, BullMQ, fast-check, Testcontainers, 80% coverage. These questions settle what's left for the foundation every unit inherits.

Please fill in each `[Answer]:` tag with a letter, or X plus your own text, then tell me "done".

## Plan

- [x] 1. Collect and analyze answers below
- [x] 2. `nfr-requirements.md`: performance budgets for the platform layer, scalability, availability, security (functional), reliability, maintainability, observability, testing; each with a measurable target and how it is checked
- [x] 3. `tech-stack-decisions.md`: every library and service with version line, reason, and rejected alternative; PBT framework (PBT-09)
- [x] 4. Validate against NFR-1..NFR-8 and U1 functional design

## Questions

### Question 1 — HTTP layer under NestJS
A) Fastify (`@nestjs/platform-fastify`). It has roughly twice Express's raw throughput and lower latency, which helps the p95 targets. Every library we plan to use supports it. (Recommended)

B) Express (NestJS default). Most examples online use it, but it's slower.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — Test runner
A) Vitest, with SWC so NestJS decorators work. It's the same runner the frontend uses and is fast, and fast-check and Testcontainers both work with it. (Recommended)

B) Jest (NestJS default)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — Request validation style
A) `class-validator` and `class-transformer`. DTOs are classes with decorators, which suits the OOP style. The NestJS Swagger plugin reads them to build the OpenAPI document automatically. (Recommended)

B) Zod schemas (`nestjs-zod`). Schema-first, with types inferred from schemas.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4 — Package manager
A) npm, the same as the frontend repository (Recommended for consistency)

B) pnpm (faster installs, stricter dependency resolution)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5 — PostgreSQL version
A) The newest major version Render offers when the database is created (PostgreSQL 17 or later), the same for staging and production. Local development and Testcontainers use the same major version. (Recommended)

B) Match Supabase's current version exactly, for the smoothest dump and restore

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 6 — Where logs go
You chose logs only (Q22 C). Render keeps logs for a limited time that depends on the plan.

A) Standard output only, read in the Render dashboard. Add a log stream later if needed. (Recommended for now)

B) Also stream logs to an external service with a free tier (for example Better Stack), for search and longer retention

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 7 — Starting server sizes on Render (this decides open item O7)
Prices change, so check Render's pricing page. These are the smallest paid sizes that don't sleep.

A) Start small and scale when the logs show the need (Recommended for the design load of about 50 registrations a minute):
- Staging: API with the worker in one process (`APP_ROLE=all`) on the smallest paid instance; the smallest paid Postgres; the free Redis tier.
- Production: API on one Starter instance, the worker as a separate Starter background worker, a Basic Postgres with backups, and a paid Redis (Key Value) with persistence.

B) Production with two API instances from day one, for zero single-instance downtime

X) Other (please describe after [Answer]: tag below)

[Answer]: A
