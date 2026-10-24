# Units of Work

The backend `gventz-api` is one deployable service (one build, API and worker roles). Units are development slices of it, plus the data migration and the frontend switch-over. Decisions come from `aidlc-docs/inception/plans/unit-of-work-plan.md` (all answers A).

- **Sequence**: one developer with AI, one unit at a time (Question 3).
- **Two-pass code generation** (Question 2):
  - Each unit's design (Functional Design, NFR, Infrastructure) covers its full scope and is approved once.
  - Code Generation runs a **pass 1 (M1 slice)** first. U1 and U2 are entirely M1. U3 and U4 have partial slices.
  - **Pass 2** finishes U3 and U4 in M2 under the same approved design.
- **Frontend design upgrade** (M4): not part of any unit here; its own AI-DLC pass after U7 (Question 5).

## U1 — Platform foundation
- **Purpose**: the skeleton every other unit builds on.
- **Repository**: `gventz-api`
- **Modules / components**: `shared/` (Entity, AggregateRoot, ValueObject, DomainError, DomainEvent, Clock, IdGenerator, pagination); `platform/` (Config, Database + full Drizzle schema, Transaction, DomainEventBus, Redis, Queue, Logging, Http with ProblemDetailsFilter and versioning, RateLimiter, Health, OpenAPI).
- **Data**:
  - The Drizzle schema for all tables, carried over from `supabase/migrations`.
  - Adds `users`, `user_identities`, `sessions`, `sign_in_codes` and `events.active_count`.
  - Drops RLS, the PL/pgSQL functions and the `auth.*` dependency.
- **Endpoints**: `GET /health/live`, `GET /health/ready`, `/openapi.json`, `/docs`.
- **Also**:
  - Project scaffold: ESLint with layer-boundary rules, Prettier, Vitest, Testcontainers harness, fast-check.
  - GitHub Actions CI: lint, typecheck, unit and integration tests, build.
  - `Dockerfile`, `render.yaml`, `docker-compose.yml` for local Postgres and Redis.
- **Construction stages**: Functional Design (minimal: shared base classes and error model), NFR Requirements, NFR Design, Infrastructure Design, Code Generation.
- **Milestone**: M1 (whole unit).

## U2 — Identity
- **Purpose**: who the caller is.
- **Module**: Identity (User, ExternalIdentity, SignInCode, Session; EmailCodeSignInService, GoogleSignInService, SessionService, ProfileService, AccountLinker; Google OIDC client, JWT signer, PKCE store; AccessTokenGuard, CurrentUser).
- **Endpoints**: `POST /v1/auth/email/code`, `/email/verify`, `/google/start`, `/google/callback`, `/refresh`, `/sign-out`; `GET /v1/me`, `PATCH /v1/me`.
- **Includes the email core of Notifications**, because email-code sign-in in M1 needs it: `Mailer` interface, `ResendMailer` (with `Idempotency-Key`), `EmailProcessor` on the `email` queue, `SignInCodeTemplate`, `SignInEmailHandler`.
- **Construction stages**: Functional Design, NFR Requirements, NFR Design, Code Generation.
- **Milestone**: M1 (whole unit).

## U3 — Events and Engagement
- **Purpose**: what an event is, who may manage it, and what hosts ask guests.
- **Modules**: Events (Event, TicketType, EventMember, value objects, EventAccessPolicy, EventCommandService, EventQueryService, EventAccessService, EventPermissionGuard) and Engagement (QuestionSet, Question, Announcement, QuestionService, AnnouncementService, QuestionCatalog).
- **Endpoints**:
  - **Pass 1 (M1)**: `POST /v1/events`, `POST /v1/events/{id}/publish`, `GET /v1/events/by-slug/{slug}`.
  - **Pass 2 (M2)**:
    - `GET /v1/me/events`, `GET /v1/events/featured`
    - `GET`, `PATCH` and `DELETE /v1/events/{id}`, plus `PUT .../location`, `PATCH .../settings`, `POST .../cancel`, `GET .../deletion-check`
    - questions and announcements endpoints
- **Fixes**: C1 (venue replaced as a whole), C2 (location validation on edit), C3 (question limit under concurrency).
- **Construction stages**: Functional Design, Code Generation (NFR covered by U1; no separate NFR stages per the execution plan).
- **Milestone**: M1 slice, rest M2.

## U4 — Registration and Notifications
- **Purpose**: getting a guest a place, a ticket, an email and in through the door.
- **Modules**: Registration (EventInventory, Registration, AnswerSet, TicketCode; RegistrationService, WaitlistService, CheckInService, TicketQueryService, GuestListQueryService; RegistrationStats) and the ticket email in Notifications (TicketEmailTemplate, QR renderer, TicketEmailHandler), on the email core built in U2.
- **Endpoints**:
  - **Pass 1 (M1)**: `POST /v1/events/{id}/registrations`, `GET /v1/tickets/{code}`, `POST /v1/tickets/{code}/check-in`.
  - **Pass 2 (M2)**: `GET /v1/events/{id}/guests`, `POST /v1/events/{id}/guests/{registrationId}/check-in`, `POST /v1/events/{id}/waitlist/promote`, ticket email job with retries and idempotency.
- **Construction stages**: Functional Design, NFR Requirements, NFR Design (concurrency, counters, queue retries), Code Generation.
- **Milestone**: M1 slice, rest M2.

## U5 — Discovery, Media and revalidation
- **Purpose**: browsing, flyers and keeping Next.js's cache fresh.
- **Modules**: Discovery (FeaturedEventsQuery via EventQueryService, OutsideListingsService with Ticketmaster, PredictHQ and iCal sources, PlacesService), Media (FlyerService, FileStorage → Cloudinary, cleanup processor) and the revalidation half of Notifications (RevalidationHandler, RevalidationProcessor, NextRevalidationClient).
- **Endpoints**: `GET /v1/discover/outside`, `GET /v1/places/autocomplete`, `GET /v1/places/{placeId}`, `POST /v1/events/{id}/flyer/upload-signature`, `PUT /v1/events/{id}/flyer`, `DELETE /v1/events/{id}/flyer`.
- **Construction stages**: Functional Design, Code Generation.
- **Milestone**: M2.

## U6 — Data migration
- **Purpose**: move all data and flyers from Supabase, keeping ids and ticket codes.
- **Location**: `gventz-api/scripts/migrate-from-supabase/`, a standalone TypeScript command (Question 6). It reads Supabase through a read-only connection string and writes to Render Postgres.
- **Scope**:
  - Copies `auth.users` to `users` (same ids), then profiles, events, ticket types, registrations, questions, members, campaigns, suppressions and the audit log.
  - Backfills `events.active_count`.
  - Copies flyers from Supabase Storage to Cloudinary and rewrites `cover_url`.
  - Can be re-run safely, with a row-count report per table.
- **Construction stages**: Functional Design (mapping rules and verification), Infrastructure Design (staging rehearsal and production cutover runbook), Code Generation.
- **Milestone**: rehearsal in M2, production run in M3.

## U7 — Frontend integration (this repository)
- **Purpose**: switch the Next.js app from Supabase to the API without changing how it looks.
- **U7a (after U2)**:
  - Backend-for-frontend cookie layer: httpOnly access and refresh cookies, server-side refresh.
  - Generated API client from `/openapi.json`, called from the server only.
  - Sign-in page with "Continue with Google" next to the email code; `/auth/google/callback` route.
  - New middleware in place of the Supabase session middleware.
- **U7b (after U5)**:
  - Replace every remaining Server Action and page data load that touches Supabase.
  - Flyer upload goes straight to Cloudinary.
  - `POST /api/revalidate` (HMAC-checked).
  - Remove `@supabase/*` packages, `src/lib/supabase/*` and `/api/places/*`.
- **Construction stages**: Functional Design (minimal: auth cookie flow and error mapping), Code Generation.
- **Milestone**: M2.

## Code organization strategy

### New repository `gventz-api` (`/Users/payazaafrica/gventz-api`)
```text
gventz-api/
├── src/
│   ├── main.ts                     # APP_ROLE = api | worker | all
│   ├── app.module.ts
│   ├── shared/{domain,kernel}/
│   ├── platform/{config,database,transaction,events,redis,queue,logging,http,rate-limit,health,openapi}/
│   └── modules/{identity,events,engagement,registration,media,discovery,notifications}/
│       └── {domain,application,infrastructure,presentation}/ + <name>.module.ts + index.ts
├── drizzle/                        # generated SQL migrations, applied on deploy
├── scripts/migrate-from-supabase/  # U6
├── test/{integration,e2e,support}/ # Testcontainers Postgres and Redis
├── .github/workflows/ci.yml
├── Dockerfile
├── docker-compose.yml              # local Postgres 16 and Redis 7
├── render.yaml                     # web service, worker, Postgres, Key Value
├── CLAUDE.md                       # project brief + pointer to AI-DLC rules
└── .claude/CLAUDE.md, .aidlc-rule-details/   # AI-DLC rules copied from this repo (O2)
```
- Unit tests sit next to the code (`*.spec.ts`), and property-based tests go in `*.pbt.spec.ts`. Integration and e2e tests live under `test/`.
- AI-DLC documentation for the whole change stays in **this** repository's `aidlc-docs/`. The backend repository's `CLAUDE.md` points to it.
- Git: initialise on `main`, work on branches. The GitHub remote is added when you create it.

### This repository (G-VENTS)
- U7 changes stay in the existing `src/` layout.
- New code:
  - `src/lib/api/`: generated client and server-side caller.
  - `src/lib/session/`: cookie handling and refresh.
  - `src/app/auth/google/callback/route.ts`
  - `src/app/api/revalidate/route.ts`
- Removed: `src/lib/supabase/`, `src/app/api/places/`, Supabase middleware. `supabase/` stays until Supabase is retired after M3.
