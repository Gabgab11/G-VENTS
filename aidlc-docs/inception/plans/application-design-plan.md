# Application Design Plan

Scope: the NestJS backend (TypeScript strict, object-oriented) and the shape of its contract with the Next.js app. Detailed business rules come later, in each unit's Functional Design.

Please fill in each `[Answer]:` tag below with a letter, or X plus your own text. Each question names a recommended option. After answering, tell me "done".

## Plan

- [x] 1. Analyze context: requirements.md (FR-1..FR-16, NFR-1..NFR-8), reverse-engineering artifacts (BT1–BT14, permission matrix, PL/pgSQL functions)
- [x] 2. Collect and analyze answers to the questions below; ask follow-ups if any are ambiguous
- [x] 3. Generate `aidlc-docs/inception/application-design/components.md`
  - [x] 3.1 Platform components (config, database, transactions, Redis, queue, logging, errors, health, OpenAPI)
  - [x] 3.2 Bounded-context modules: Identity, Events, Engagement, Registration, Media, Discovery, Notifications
  - [x] 3.3 Layers inside each module and what each layer may depend on
  - [x] 3.4 Domain entities and value objects per module
  - [x] 3.5 External adapters behind interfaces (Google OIDC, Google Places, Resend, Cloudinary, outside event sources, Next.js revalidation)
- [x] 4. Generate `component-methods.md`: public method signatures of services, repository interfaces and adapters, with input and output types
- [x] 5. Generate `services.md`: application services (use cases), orchestration, transactions, where domain events are raised and handled
- [x] 6. Generate `component-dependency.md`: dependency matrix, communication patterns, data flow for sign-in, create event, register, check-in
- [x] 7. Generate `application-design.md` consolidating the above, plus the REST resource map (endpoints per module)
- [x] 8. Validate completeness: every FR maps to a component; no module reaches into another module's repository; diagrams validated

## Questions

### Question 1 — Backend repository location and name
You asked for the repository to be on this machine too. Which location and name?

A) `/Users/payazaafrica/gventz-api` (next to G-VENTS), a new git repository named `gventz-api`. It's pushed to GitHub when you create the remote. (Recommended)

B) Inside this repository as a folder (for example `G-VENTS/api`), as a monorepo. This reverses decision D1 (separate repository).

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — Layering style inside each module
A) Layered "clean" modules: `domain/` (entities, value objects, domain errors, repository interfaces), `application/` (use-case services, DTOs), `infrastructure/` (Drizzle repositories, external adapters), `presentation/` (controllers). Domain has no NestJS or Drizzle imports. (Recommended)

B) The same, with full hexagonal naming (ports and adapters folders for every dependency, including inbound)

C) CQRS with `@nestjs/cqrs`: a command or query class plus a handler for every use case

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — How much behaviour lives in domain classes
A) Rich domain model. Entities enforce their own rules, for example `Event.changeVenue()`, `Event.close()`, `TicketType.reserveSeat()`, `Registration.checkIn()`. Value objects such as `Money`, `Slug`, `Email`, `TicketCode`, `IanaTimeZone` validate themselves. Services orchestrate, load and save. (Recommended)

B) Simple data entities; all rules in services

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4 — Communication between modules
A) Synchronous calls go through a small public interface that each module exports, never its repositories. Side effects use in-process domain events: ticket email, cache revalidation, flyer cleanup. Handlers put durable work on BullMQ. (Recommended)

B) Direct calls only. The service that registers a guest also enqueues the email itself.

C) All cross-module work through BullMQ messages

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5 — Transactions
A) A transaction context carried automatically per request (`@nestjs-cls/transactional` with its Drizzle adapter). A service method marked `@Transactional()` makes every repository call inside it share one transaction. (Recommended)

B) A `UnitOfWork` interface whose `run(work)` hands a transaction object to the repositories explicitly

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 6 — Read-heavy queries (dashboard lists, guest list, public event page, discovery)
A) Separate read queries. A query service per module selects straight into response DTOs with Drizzle and skips loading entities. Writes always go through entities. (Recommended for the p95 targets)

B) Everything through entities and repositories, including lists

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 7 — Errors
A) Domain errors are classes in the domain layer, such as `EventNotFound`, `RegistrationClosed`, `CapacityReached` and `AlreadyCheckedIn`. One global exception filter maps them to HTTP status codes and RFC 9457 `application/problem+json` bodies with a stable `code`. This replaces today's `P0001` convention: only domain errors show their message to users. (Recommended)

B) Services throw NestJS `HttpException` subclasses directly

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 8 — Background job processing
A) One codebase, two roles. The same build runs as the API (Render web service) and as a worker (Render background worker), chosen by an environment variable. For M1 both roles can run in one process. (Recommended)

B) Job processors always run inside the API process

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 9 — API versioning and naming
A) Versioned paths (`/v1/...`) because the mobile app will pin to a version. Resource-style paths, for example `POST /v1/events`, `POST /v1/events/{id}/registrations` and `POST /v1/tickets/{code}/check-in`. Responses in camelCase. (Recommended)

B) No version prefix

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 10 — Organizer roles and permissions in code
A) A single `EventAccessPolicy` class implements today's permission matrix: role → allowed actions such as `event.edit`, `guests.read` and `guests.checkIn`. A NestJS guard and a `@RequireEventPermission('guests.checkIn')` decorator use it. It returns 404 when the caller has no access (FR-11.3). (Recommended)

B) Role checks written inside each service method

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Follow-up

### Your question on Question 4 — Is BullMQ a free service?
BullMQ isn't a hosted service. It's a free, open-source (MIT) Node.js library that we install in the backend. It needs a **Redis** server to store its jobs, and the only cost is that Redis.

- **Redis is already in the plan (D14).** It also handles caching (outside listings for 1 hour) and rate limits (sign-in codes, venue search). BullMQ adds no new provider or bill.
- **Render's free Redis plan isn't enough for production.** It keeps nothing on disk, so queued emails would be lost on a restart. Production needs a paid Key Value instance with persistence. The smallest is roughly $10 a month; check Render's pricing page for the current price. This is already part of open item O7.
- **For local development and M1**, Redis runs free in Docker, or on Render's free plan for the staging copy.
- **Alternative if you want no Redis at all:** `pg-boss`, a free library that keeps the queue in Postgres. Caching and rate limits would then move to Postgres or memory, which is slower and doesn't share across instances. I don't recommend it given the scale-out goal.

### Question 4 (again) — Communication between modules
Please answer Question 4 with the information above.

A) Small public module interfaces for synchronous calls, in-process domain events for side effects, with durable work on BullMQ (backed by Render Redis) (Recommended)

B) Direct calls only. The service that registers a guest also enqueues the email itself (still BullMQ).

C) Same as A, but the queue is `pg-boss` in Postgres instead of BullMQ and Redis

X) Other (please describe after [Answer]: tag below)

[Answer]: A (recorded from chat on 2026-10-23: "that is fine then, I have answered all")
