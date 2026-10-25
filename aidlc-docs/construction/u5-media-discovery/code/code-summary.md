# U5 Media, Discovery and Revalidation — Code Summary

**Plan:** `construction/plans/u5-media-discovery-code-generation-plan.md` (all steps done; step 4 built, then removed on request).

**Code:**
- `/Users/payazaafrica/gventz-api`: `src/modules/media/`, `src/modules/discovery/`, revalidation in `src/modules/notifications/`, platform outbox and config
- G-VENTS: `supabase/migrations/20261025000400_outbox_run_at.sql`

**Commits:** none made by the AI.

## Scope change during generation
The product owner asked on 2026-10-25: "no ticketmaster or external ticketing integration, we do not need that".
- Outside listings (Ticketmaster, PredictHQ, iCal feeds) were removed: code, settings, route and tests.
- `/v1/discover/external` answers 404.
- The website's Discover "elsewhere" section goes in U6b.
- The venue search (Google Places) stays.

Recorded in requirements (change note), the U5 FD, and the plan.

## What was built

| Area | Components |
|---|---|
| Platform | `outbox_events.run_at` + `OutboxRoute.runAt` → BullMQ delay (`JobQueueSink`); settings `SUPABASE_SECRET_KEY`, `REVALIDATE_URL`, `REVALIDATE_SECRET`, `GOOGLE_MAPS_API_KEY` with validation; `RevalidationConfig`, `DiscoveryConfig` |
| Media | `FlyerPath`, `sniffImage`, `FileStorage` port, `SupabaseStorageFileStorage` (sign upload, ranged read, remove, list; breaker `storage.supabase`), `FlyerService` (request upload, confirm, remove), `MediaCleanupWorker`, outbox routes (released file; deleted event's folder), 3 routes |
| Discovery | `PlacesService` (validation, 60/min and 1,000/day per user, region first), `GooglePlacesClient` (same requests as the current app; breaker `places.google`), 2 routes |
| Revalidation | `eventRevalidation` and `pathsFor` (which pages per fact), `orderRevalidation` (once a minute per event), HMAC `signRevalidation`/`verifyRevalidation`, `RevalidationWorker` (4xx permanent, 5xx retried, breaker `revalidation.web`), outbox routes |
| Ops and docs | Alert `revalidation-refused` and runbook `alerts/revalidation.md`; operations dashboard panels (refresh failures; Storage, Places and refresh breakers); README section; `.env.example`, `render.yaml` |

**Routes:**
- `POST /v1/events/{id}/flyer/upload-url`, `POST|DELETE /v1/events/{id}/flyer`
- `GET /v1/places/autocomplete`, `/v1/places/details`

OpenAPI: 34 paths.

## Verification (2026-10-25)

| Check | Result |
|---|---|
| Lint, typecheck, build, `openapi:check` | pass |
| Unit and property tests | 298 passed |
| Integration | 100 passed (11 new: 5 media, 3 places, 3 revalidation) |
| Supabase CLI | 45/45 |
| Smoke (built server, disposable database, fake Storage, stub website) | create → upload → confirm flyer → venue search 503 unconfigured → no listings route → signed refreshes delivered by the worker |

## Found and fixed
- **Duplicate refreshes:** creating a published event records both created and published facts, which queued the refresh twice. Only "published" triggers it now.
- **Test escaping:** a test helper had the same single-backslash slip as in U4 (`'\;'`). Lint caught it.
- **Flaky my-tickets test (U4):** a row timestamped by the database clock was compared with orders timestamped by the API clock. The test now sets the row's time relative to the order.
- **Places status:** `places.unavailable` is 503 (the API's "unavailable" kind), not 502.

## Notes
- **Storage key:** new `sb_secret_…` keys are sent in `apikey`; a legacy service-role JWT is also sent as a bearer token. Confirm with the real project when O17 is done.
- **U6b website work:**
  - the HMAC-checked `/api/revalidate` route, verifying exactly as `verifyRevalidation` does
  - the flyer form switches to upload URL → PUT → confirm
  - the event form's venue search calls `/v1/places/*`
  - Discover drops the outside listings
