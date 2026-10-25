# U3 Events and Engagement — Code Generation Plan (Change 1)

This plan is the single source of truth for U3 code generation. It replaces the withdrawn version 1 plan (`u3-events-engagement-code-generation-plan-v1-withdrawn.md`). The work is done in two passes (unit-of-work.md), and each step is ticked as soon as it's done.

## Unit Context
- **Design:** `u3-events-engagement/functional-design/{domain-entities,business-rules,business-logic-model}.md` plus `change1-delta.md`.
- **Code locations:**
  - `/Users/payazaafrica/gventz-api/src/modules/events/`, and `src/modules/engagement/` (pass 2)
  - G-VENTS `supabase/migrations/`
- **Depends on:** U1, U2 (`CurrentUser`, `OptionalUser`, the new `ProfileProvisioner`).
- **Exposes:**
  - pass 1: `EventAccessService`, `EventPermissionGuard`, `@RequireEventPermission()`, `EventPurchaseRules`
  - pass 2: `EventSummaryReader`, `EventCoverPort`, `QuestionCatalog`
- **Ports declared, implemented later:**
  - `PayoutReadiness`, implemented by U7 (stub: not ready)
  - `TicketingStats`, implemented by U4 (pass 1 has a read-side default)
- **Stories:**
  - pass 1: US-2.1 and the US-2.7 page part
  - pass 2: US-2.2, US-2.4 (setting), US-2.5 (free events), US-2.6, US-2.8
- **Not committed.**

## Pass 1 — M1: create, publish, public page, permissions

### Step 1 — Reference data
- [x] Choose and add the datasets. Each needs an open licence, works offline, is maintained, and loads in Node 22 CommonJS. Record versions and licences in the code summary. — *countries-and-timezones 3.11.0 (MIT), country-to-currency 3.0.1 (MIT), country-region-data 4.1.0 (MIT), @photostructure/tz-lookup 11.7.0 (CC0, 96 KB; geo-tz rejected at 72 MB)*
  - countries (ISO 3166-1, English names)
  - first-level subdivisions (ISO 3166-2)
  - country → currency (ISO 4217)
  - country → IANA zones
  - coordinates → zone, offline
- [x] `events/domain/reference/`: `CountryCatalog`, `SubdivisionCatalog`, and the `TimeZoneLocator` port. — *`CountryCatalog` holds countries and subdivisions together; `TimeZoneLocator` port*
- [x] `events/infrastructure/`: the offline locator adapter and catalog loaders (loaded once, kept in memory).
- [x] PBT: catalog invariant (every currency is valid ISO 4217, every zone is a valid IANA zone); region canonicalisation is idempotent.

### Step 2 — Migrations (G-VENTS)
- [x] `20261024000400_events_purchase_policy.sql`: `per_buyer_limit`, `fee_choice` (Δ1).
- [x] `20261024000500_audit_keep_on_event_delete.sql`: `audit_log.event_id` changed to `on delete set null` (Δ4).
- [x] pgTAP for both; regenerated `database.types.ts`; `tables.ts` and the drift test updated; Supabase CLI lint and test.

### Step 3 — Events domain
- [x] Value objects:
  - `EventTitle`, `Slug`, `Category`
  - `EventSchedule` (local ↔ instant; gap refused; overlap takes the earlier time)
  - `Location` (`Venue`, `Online`, `Place`), `CountryCode`, `Region`
  - `Capacity`, `CoverTheme`, `Visibility`, `EventStatus`, `EventRole`, `EventPermission` (Δ7)
  - `PurchasePolicy` (Δ1)
- [x] The `Event` aggregate with `TicketType` (one currency, Δ2; price must be 0); `publish(now, payoutReady)` (Δ3); domain events; errors (business-rules §10 plus delta).
- [x] `EventAccessPolicy` (matrix §6 plus Δ7, strongest role wins).
- [x] Ports: `EventRepository`, `EventMemberReader`, `PayoutReadiness`, `TicketingStats`.

### Step 4 — Domain tests
- [x] Example tests for CE1–CE9, LO1–LO5, PM1–PM2, Δ1, Δ2.
- [x] PBT, with generators in `test/support/events-arbitraries.ts`:
  - `EventSchedule` round-trip, invariant and `Intl` oracle (zones and local times, including DST edges)
  - `Slug` invariant over Unicode titles
  - `Location` C1 invariant and idempotence
  - capacity and quantity invariant
  - policy oracle, role-resolution oracle, visibility oracle
  - `PurchasePolicy` invariant; single-currency invariant

### Step 5 — Application (pass 1)
- [x] `EventCommandService.create` (Δ5 calls `ProfileProvisioner.ensure`; slug retry ×3) and `publish` (`PayoutReadiness`).
- [x] `EventQueryService.getPublicPage` (three queries, visibility VR1, attendee count VR2).
- [x] `EventAccessService` (role per request, cached in CLS).
- [x] Identity: add `ProfileProvisioner` to its public interface.
- [x] DTO mappers, including local times; tests with fakes.

### Step 6 — Infrastructure (pass 1)
- [x] `DrizzleEventRepository`: insert the event with its ticket types, retry on slug conflict, `findForUpdate`, save.
- [x] `DrizzleEventQueries` (public page), `DrizzleEventMemberReader`, `DrizzleTicketingStats` (read side, confirmed count), `PayoutReadiness` stub.

### Step 7 — Presentation (pass 1)
- [x] `EventPermissionGuard` plus `@RequireEventPermission()`: 404 without a role, 403 without the permission.
- [x] `EventsController`:
  - `POST /v1/events`
  - `POST /v1/events/{id}/publish`
  - `GET /v1/events/by-slug/{slug}` (public, optional viewer)
- [x] Request DTOs (nested location and ticket types), validation, Swagger.

### Step 8 — Wiring and integration tests (pass 1)
- [x] `events.module.ts`, `index.ts`, registered in `AppModule`; OpenAPI regenerated.
- [x] Integration tests: — *7 tests; found that `events_guard` failed for the API role, fixed by migration `20261024000600_events_guard_api_role.sql`*
  - **Create:** zone given; zone derived from coordinates; multi-zone country without a zone → `time_zone_required`; gap time → `time_not_in_zone`; invalid region; more than 20 ticket types; paid ticket; mixed currency; buyer limit 11; first-time host without a profile.
  - **Publish:** owner ✓; editor → 403; stranger → 404; cancelled → 409.
  - **Public page:** published → 200 for a guest; draft → 404 for a guest and 200 for the owner; attendee-count rules; local times returned.
  - **Audit:** an audit row survives event deletion (DB-level).

### Step 9 — Pass 1 verification
- [x] lint, typecheck, unit and PBT, integration, build, `openapi:check`, Supabase CLI. — *green 2026-10-24: 191 unit/PBT, 49 integration, Supabase CLI tests 4/4 files*
- [x] Results in the code summary (pass 1 section).

## Pass 2 — M2: the rest of Events, and Engagement

### Step 10 — Events: edit, cancel, delete, reads
- [x] Commands:
  - `updateDetails`
  - `changeLocation` (C1, C2)
  - `updateSettings` (including `perBuyerLimit`)
  - `cancel` (with audit; confirmation)
  - `deletionCheck`
  - `delete` (typed title; refused with paid orders; audit; `events.event_deleted` via the outbox)
- [x] Queries: featured (cursor), `me/events` (pages), dashboard summary.
- [x] Reference endpoints: `/v1/reference/countries`, `/countries/{code}/subdivisions`, `/time-zone` (public cache header).
- [x] Exported for U5: `EventCoverPort`, `EventSummaryReader`.
- [x] Tests (example and PBT where listed).

### Step 11 — Engagement domain and application
- [x] `QuestionSet`/`Question`, `Announcement`, value objects and errors.
- [x] `QuestionService`, `AnnouncementService`, `QuestionCatalog`.
- [x] Tests, plus PBT: `QuestionSet` stateful; option normalisation idempotent.

### Step 12 — Engagement infrastructure and presentation
- [x] Repositories: `DrizzleQuestionSetRepository` (event row locked), `DrizzleAnnouncementRepository`. — *the unique `(event_id, position)` index is deferred to after go-live: the current app sets position = count + 1, which repeats after a delete, so an index would break it (AD17); the event-row lock is the guard*
- [x] `QuestionsController`, `AnnouncementsController`.
- [x] `engagement.module.ts`, `index.ts`.

### Step 13 — Pass 2 integration tests
- [x] Location edit (C1, C2); settings (capacity, buyer limit, registration on a cancelled event → 409).
- [x] Cancel (confirmation, audit, owner/admin only); delete (counts, title, paid → 409, audit survives, cascade).
- [x] Featured cursor; `me/events` pages; dashboard counts.
- [x] Questions: limits, options, terms required, **two concurrent adds at 29 → one 409 (C3)**.
- [x] Announcements; reference endpoints.

### Step 14 — Documentation
- [x] README (events endpoints, reference data); `aidlc-docs/construction/u3-events-engagement/code/code-summary.md`.

### Step 15 — Pass 2 verification
- [x] lint, typecheck, unit and PBT, integration, build, `openapi:check`, docker build.
- [x] A local smoke run: token → create → publish → public page. — *found and fixed two issues: an empty JSON body gave 400 on publish; blank names came back as ""*
- [x] Results recorded.

## PBT Coverage (PBT-01 to PBT-10)
| Rule | Where |
|---|---|
| PBT-01 | Steps 1, 4, 11: all 14 properties from business-logic-model §8, plus 2 from Δ8 |
| PBT-02 round-trip | `EventSchedule` |
| PBT-03 invariant | Schedule, slug, location, capacity, catalog, options, delete confirmation, purchase policy, single currency |
| PBT-04 idempotence | Location, region canonicalisation, option normalisation |
| PBT-05 oracle | Schedule vs `Intl`, policy, role resolution, visibility |
| PBT-06 stateful | `QuestionSet` |
| PBT-07 generators | `events-arbitraries.ts` |
| PBT-08 to PBT-10 | `fcParams()`, fast-check, `*.pbt.spec.ts` alongside example tests |
