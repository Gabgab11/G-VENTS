# U5 Media, Discovery and Revalidation — Code Generation Plan

This plan is the single source of truth for U5 code generation. Each step is ticked as soon as it's done.

## Unit Context
- **Design:** `u5-media-discovery/functional-design/{domain-entities,business-rules,business-logic-model}.md` (Q1 A, Q2 A).
- **Code:**
  - `/Users/payazaafrica/gventz-api`: `src/modules/media/`, `src/modules/discovery/`, revalidation in `src/modules/notifications/`, platform outbox change
  - G-VENTS: one migration
- **Depends on:**
  - U1: outbox, queues, breaker, rate limits, Redis
  - U2: `CurrentUser`
  - U3: `EventPermissionGuard`, `EventCoverPort`, `CountryCatalog`, event domain events
  - U4: order domain events
- **Stories:** US-2.3 (flyer), US-5.x Discover outside listings, the venue search in US-2.1, page freshness (NFR).
- **Not committed.**

## Steps

### Step 1 — Platform: delayed outbox jobs
- [x] G-VENTS `20261025000400_outbox_run_at.sql`: `outbox_events.run_at timestamptz` (nullable); pgTAP check; types regenerated; API `tables.ts` and drift test.
- [x] `OutboxRoute.runAt?(event)`; `OutboxWriter` stores it; `JobQueueSink` passes `delayMs = max(0, runAt − now)`; `JobQueue.add` already takes `delayMs`.
- [x] Tests: writer stores `runAt`; sink delay is computed and clamped at 0.

### Step 2 — Settings
- [x] `SUPABASE_SECRET_KEY` (required in production for both roles: the API signs uploads, the worker cleans up).
- [x] `REVALIDATE_URL`, `REVALIDATE_SECRET` (32 characters or more when the URL is set).
- [x] `TICKETMASTER_API_KEY`, `PREDICTHQ_API_KEY`, `ICAL_FEED_URLS`, `GOOGLE_MAPS_API_KEY` (all optional).
- [x] Config sections, validation tests, `.env.example`, `render.yaml` (`sync: false`).

### Step 3 — Media
- [x] Domain: `FlyerPath` (build and parse), `sniffImage`, errors.
- [x] `FileStorage` port; `SupabaseStorageFileStorage` (sign upload, ranged head, remove, list; breaker `storage.supabase`, 5 s).
- [x] `FlyerService`: `requestUpload`, `confirm`, `remove`; outbox route `events.event_deleted` → `media-cleanup` job `flyers.{eventId}`; previous-file clean-up job `flyer-old.{eventId}.{ms}`.
- [x] `MediaCleanupWorker` (queue `media-cleanup`, worker role).
- [x] Routes:
  - `POST /v1/events/{id}/flyer/upload-url`
  - `POST /v1/events/{id}/flyer`
  - `DELETE /v1/events/{id}/flyer`
  - all `flyer.manage`
- [x] Tests:
  - PBT for `sniffImage` and `FlyerPath`
  - storage adapter contract tests (fetch mocked)
  - service unit tests
  - integration with a fake storage server (sign → confirm → old file removed; wrong type and size deleted; other event's path refused; permissions)
  - *the fake Storage server (`test/support/fake-storage.ts`) checks the request formats (secret key header, sign, ranged read, delete, list), so it serves as the adapter contract test; 4 PBT/unit + 5 integration tests. The old file's clean-up job is written in the same transaction as the cover change (`media.flyer_file_released`)*

### Step 4 — Discovery: outside listings — REMOVED (product owner, 2026-10-25)
*Built, then removed on request: no Ticketmaster, PredictHQ or iCal integration. Code, settings, route and tests deleted; the route now answers 404.*
- [x] `ExternalEventSource` port; `TicketmasterSource`, `PredictHqSource`, `IcalFeedSource` (pure mappers, each fetch behind a breaker, 4 s).
- [x] `ExternalListingService` (Redis cache 1 h, or 5 min after a failure; merge, dedupe, sort, limit; report outside production).
- [x] Route `GET /v1/discover/external?limit=` (public, `Cache-Control: public, max-age=300`).
- [x] Tests:
  - PBT: merge invariant; iCal round-trip
  - mapper examples using the current app's provider shapes
  - integration: a source failing or slow is skipped; cache hit; Redis down still answers
  - *sources have a unique id (a hash of the feed URL), so two feeds on one host don't share a cache key or breaker; Redis-down and production-report cases are unit tests; 11 unit/PBT + 3 integration tests*

### Step 5 — Discovery: Places
- [x] `PlacesClient` (Google Places New; breaker `places.google`, 3 s); `PlacesService` (limit `places.lookup` 60/min and 1,000/day, failing open; validation; region ordering).
- [x] Routes `GET /v1/places/autocomplete`, `GET /v1/places/details` (signed in, `no-store`).
- [x] Tests:
  - PBT: region ordering
  - client contract test (request body, field mask, session token)
  - integration: not configured → 503; limit → 429; bad input → 400
  - *`places.unavailable` is 503 (the API's 'unavailable' kind), not 502 as first written; business-rules updated*

### Step 6 — Revalidation
- [x] `WebRevalidator` (HMAC-SHA256, 5 s, breaker `revalidation.web`; classify 2xx, 4xx, 5xx); `RevalidationPaths` (the triggers table, slug lookup).
- [x] Outbox routes:
  - event facts → immediate
  - order facts → `revalidate.orders.{eventId}.{minute}` with `runAt`
- [x] `RevalidationWorker` (queue `revalidation`, worker role; skipped when not configured).
- [x] Tests:
  - PBT: signature; debounce ids
  - unit: paths per trigger
  - integration: orders in one minute → one job delayed about 60 s; publish → job with `/`, `/discover`, `/e/{slug}`; the worker signs and the stub verifies
  - *creating a published event records both created and published facts, so only published triggers a refresh (found by the integration test); 7 unit/PBT + 3 integration tests*

### Step 7 — Wiring, docs, verification
- [x] Modules registered; OpenAPI regenerated; README sections; runbook note (revalidation 401 = secret mismatch); `ticketing.json`/`operations.json` panels for discovery sources and revalidation failures.
- [x] `aidlc-docs/construction/u5-media-discovery/code/code-summary.md`.
- [x] Verification: lint, typecheck, unit and PBT, integration, Supabase CLI, build, `openapi:check`, smoke run (flyer flow against a storage stub, listings, places not configured, revalidation to a stub). — *2026-10-25: lint and typecheck clean; 298 unit/PBT; 100 integration; Supabase CLI 45/45; build; `openapi:check` (34 paths); smoke 6/6 (the listings check is now 'no route')*
