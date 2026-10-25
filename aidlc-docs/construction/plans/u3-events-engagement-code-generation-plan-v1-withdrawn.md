# U3 Events and Engagement — Code Generation Plan

This plan is the single source of truth for U3 code generation, done in **two passes** (unit-of-work Q2 A):
- **Pass 1 (M1):** steps 1–9.
- **Pass 2 (M2):** steps 10–15.

Each pass ends with a verification step.

## Unit context
- **Unit:** U3 Events and Engagement.
- **Code location:** `/Users/payazaafrica/gventz-api`
  - `src/modules/events/`
  - `src/modules/engagement/`
  - migration `drizzle/0002_events.sql`
- **Requirements:**
  - FR-2 (events, C1, C2)
  - FR-3 (questions, C3)
  - FR-9.1, FR-9.2 (featured, public page)
  - FR-10.1–10.3 (host lists, dashboard, announcement drafts)
  - FR-11 (roles and permissions)
  - BT2, BT3, BT4, BT10, BT11, BT12, BT13 (G-ventZ part)
  - Worldwide reference data (Q5 follow-ups)
- **Design inputs:** `u3-events-engagement/functional-design/*`, application design, U1/U2 contracts.
- **Depends on:**
  - U1 platform
  - U2 `CurrentUser`, `AccessTokenGuard` principal, `UserDirectory` (not needed in U3)
- **Exposes:**
  - `EventAccessService`, `EventPermissionGuard`, `@RequireEventPermission()`
  - `EventCoverPort`, `EventSummaryReader`
  - `QuestionCatalog`
  - the `RegistrationStats` port (default read-side implementation; replaced in U4)
- **Tables owned:**
  - `events` and `ticket_tiers` (definition columns), `event_members`
  - `event_questions`, `email_campaigns`
- **Not committed.**

## Pass 1 — M1 slice: create, publish, public page, permissions

### Step 1 — Reference data
- [ ] Pick and add the datasets. Each must have an open licence, ship inside the build with no network calls, and be maintained:
  - ISO 3166-1/3166-2 (countries, subdivisions)
  - country → currency
  - country → IANA zones
  - coordinate → zone (offline)
- [ ] Record the choices in the code summary.
- [ ] `events/domain/reference/`: `CountryCatalog`, `SubdivisionCatalog`, port `TimeZoneLocator`. `infrastructure/`: the offline locator adapter.

### Step 2 — Events domain
- [ ] Value objects: `EventTitle`, `Slug`, `Category`, `EventSchedule` (local ↔ instant, gap and overlap rules), `Location` (`Venue`, `Online`, `Place`), `CountryCode`, `Region`, `Capacity`, `CoverTheme`, `Visibility`, `EventStatus`, `EventRole`, `EventPermission`.
- [ ] `Event` aggregate with `TicketType`, domain events, errors (business-rules §10).
- [ ] `EventAccessPolicy` (matrix §6, strongest-role resolution).
- [ ] Ports: `EventRepository`, `EventMemberReader`, `RegistrationStats`.

### Step 3 — Events domain tests
- [ ] Example tests for CE1–CE9, ED3, LO1–LO5 and PM1–PM2.
- [ ] PBT, using shared arbitraries in `test/support/events-arbitraries.ts`:
  - `EventSchedule` round-trip, invariant and oracle
  - `Slug` invariant
  - `Location` C1 invariant and idempotence
  - region canonicalization idempotence
  - capacity and quantity invariant
  - policy oracle, role resolution oracle, visibility oracle
  - catalog invariant

### Step 4 — Events application (pass 1 services)
- [ ] `EventCommandService.create`, `EventCommandService.publish`.
- [ ] `EventQueryService.getPublicPage`.
- [ ] `EventAccessService` (role per request, cached in CLS).
- [ ] DTO mappers, including local times.
- [ ] Tests with fakes.

### Step 5 — Events infrastructure (pass 1)
- [ ] `DrizzleEventRepository`: insert with ticket types, retry on slug conflict, `findForUpdate`, save.
- [ ] `DrizzleEventQueries`: public page in three queries.
- [ ] `DrizzleEventMemberReader`.
- [ ] `DrizzleRegistrationStats` (read side; replaced in U4).

### Step 6 — Events presentation (pass 1)
- [ ] `EventPermissionGuard` + `@RequireEventPermission()` (404/403 rules).
- [ ] `EventsController`: `POST /v1/events`, `POST /v1/events/{id}/publish`, `GET /v1/events/by-slug/{slug}` (public, optional viewer).
- [ ] Request DTOs: nested location and ticket types, class-validator, Swagger.

### Step 7 — Module wiring and migration
- [ ] `events.module.ts` and `index.ts`, registered in `AppModule`.
- [ ] `drizzle/0002_events.sql` (expand only):
  - accepted-members index
  - featured index
  - unique `(event_id, position)` on questions
- [ ] Regenerate `openapi.json`.

### Step 8 — Pass 1 integration tests
- [ ] Create:
  - a valid event (zone given; zone derived from coordinates)
  - a multi-zone country without a zone → `time_zone_required`
  - a gap time → `time_not_in_zone`
  - an invalid region
  - more than 20 ticket types
  - a paid ticket
- [ ] Publish:
  - owner ✓
  - editor → 403 (inserted member)
  - a stranger → 404
  - a cancelled event → 409
- [ ] Public page:
  - published → 200 for a guest
  - a draft → 404 for a guest, 200 for the owner
  - attendee count rules
  - local times returned

### Step 9 — Pass 1 verification
- [ ] lint, typecheck, unit + PBT, integration, build, `openapi:check`.
- [ ] Results recorded in code-summary.md (pass 1 section).

## Pass 2 — M2: the rest of Events and Engagement

### Step 10 — Events: edit, cancel, delete, reads
- [ ] Commands: `updateDetails`, `changeLocation` (C1/C2), `updateSettings`, `cancel` (with audit), `deletionCheck`, `delete` (with audit, `events.event_deleted`).
- [ ] Queries: featured (cursor), `me/events` (pages), dashboard summary.
- [ ] Controllers: `HostEventsController`.
- [ ] Reference controller: `/v1/reference/countries`, `/countries/{code}/subdivisions`, `/time-zone` (public cache header).
- [ ] Ports exported for U5: `EventCoverPort`, `EventSummaryReader`.
- [ ] Tests (example and PBT where listed).

### Step 11 — Engagement domain and application
- [ ] `QuestionSet`/`Question`, `Announcement`, value objects, errors.
- [ ] `QuestionService`, `AnnouncementService`, `QuestionCatalog`.
- [ ] Example tests and PBT: `QuestionSet` stateful, option normalization.

### Step 12 — Engagement infrastructure and presentation
- [ ] Repositories: `DrizzleQuestionSetRepository` (loads with the event row locked), `DrizzleAnnouncementRepository`.
- [ ] Controllers: `QuestionsController`, `AnnouncementsController` (permission guard).
- [ ] `engagement.module.ts` and `index.ts`.

### Step 13 — Pass 2 integration tests
- [ ] Location edit clears Google fields (C1), and edit validation (C2).
- [ ] Settings: capacity, registration switch on a cancelled event → 409.
- [ ] Cancel (needs confirm; audit; owner and admin only).
- [ ] Delete:
  - check counts
  - title confirmation
  - paid → 409
  - audit survives
  - cascade
- [ ] Featured cursor, `me/events` pages, dashboard summary counts.
- [ ] Questions:
  - limits
  - options
  - terms required
  - **two concurrent adds at 29 → one 409 (C3)**
- [ ] Announcements draft and list.
- [ ] Reference endpoints.

### Step 14 — Documentation
- [ ] README (events endpoints, reference data).
- [ ] `aidlc-docs/construction/u3-events-engagement/code/code-summary.md`.

### Step 15 — Pass 2 verification
- [ ] lint, typecheck, unit + PBT, integration, build, `openapi:check`, `docker build`.
- [ ] A local smoke run: sign in → create → publish → public page.
- [ ] Results recorded.

## PBT coverage (PBT-01..PBT-10)
| Rule | Where |
|---|---|
| PBT-01 properties carried forward | Steps 3, 11 (all 14 from business-logic-model §8) |
| PBT-02 round-trip | `EventSchedule` |
| PBT-03 invariant | Schedule, slug, location, capacity, catalog, options, delete confirmation |
| PBT-04 idempotence | Location, region canonicalization, option normalization |
| PBT-05 oracle | Schedule vs `Intl`, policy, role resolution, visibility |
| PBT-06 stateful | `QuestionSet` add/remove sequences |
| PBT-07 generators | `events-arbitraries.ts` (zones, local times incl. DST edges, Unicode titles, locations, roles) |
| PBT-08 reproducibility | `fcParams()` |
| PBT-09 framework | fast-check |
| PBT-10 complementary | Example tests for every error code; PBT in `*.pbt.spec.ts` |

## Traceability
| Requirement | Steps |
|---|---|
| FR-2.1, 2.2, 2.8 | 1–9 |
| FR-2.3–2.7 (C1, C2) | 10, 13 |
| FR-3 (C3) | 11–13 |
| FR-9.1 | 10, 13 |
| FR-9.2 | 4–8 |
| FR-10.1–10.3 | 10–13 |
| FR-11 | 2–3, 6, 8, 13 |
| Worldwide (Q5) | 1–3, 10 |
