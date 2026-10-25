# U5 Media, Discovery and Revalidation — Business Rules

## 1. Flyers (Media)
`flyer.manage`: owner, admin, editor.

- **FL1. Request an upload:** `POST /v1/events/{id}/flyer/upload-url` `{ contentType }`.
  - `contentType` must be `image/jpeg`, `image/png` or `image/webp` (`flyer.type`).
  - Answers 201 `{ path, uploadUrl, expiresAt }`. The client PUTs the file to `uploadUrl`.
  - The bucket itself refuses more than 5 MB and other types.
- **FL2. Confirm:** `POST /v1/events/{id}/flyer` `{ path }`.
  - `path` must be under `{eventId}/` and match the FlyerPath pattern (`flyer.path_invalid`, 400).
  - The API reads the object's **first 16 bytes and total size** (a ranged GET):
    - missing → 409 `flyer.not_uploaded` "Upload the image first."
    - over 5 MB → 422 `flyer.size` "Flyers can be at most 5 MB." (and the object is deleted)
    - not JPEG, PNG or WebP by its bytes → 422 `flyer.type` "Use a JPEG, PNG or WebP image." (and deleted)
  - Then `events.cover_url` becomes the public URL (U3 `EventCoverPort`, which records `EventUpdated{fields:['coverUrl']}`).
  - The previous flyer file is deleted **after** commit (a media-cleanup job). A leftover file only costs storage.
  - Answers 200 `{ url }`.
- **FL3. Remove:** `DELETE /v1/events/{id}/flyer` → `cover_url` null; the file is deleted after commit; 204. Removing when there is none → 204.
- **FL4. Event deleted:** `events.event_deleted` → media-cleanup job `flyers.{eventId}` lists `{eventId}/` and deletes every file (up to 1,000; more pages if needed).
- **FL5. Only our own files:** the API deletes only paths under `event-covers/{eventId}/` that it derives itself; a `cover_url` from elsewhere is ignored (as today).
- **FL6. Sizes:** stored as uploaded (Q2 A). Resizing is backlog.

## 2. Outside listings — removed
**Removed by the product owner on 2026-10-25** ("no ticketmaster or external ticketing integration, we do not need that"): no Ticketmaster, PredictHQ or iCal listings, settings or route. The website's Discover page shows G-ventZ events only; its "elsewhere" section goes in U6b.

## 3. Places (Discovery)
Signed-in only. Limit `places.lookup`: 60 a minute and 1,000 a day per user, failing open (a lookup is not a security boundary; the Google bill is capped by Google's quota as well).

- **PL1. Autocomplete:** `GET /v1/places/autocomplete?q=&country=&region=&session=`
  - `q` trimmed and cut to 120 characters; fewer than 2 → `{ suggestions: [] }` without calling Google
  - `country` must be ISO 3166-1 alpha-2 (U3 `CountryCatalog`); `session` must match `PlacesSession` (400 `places.bad_request`)
  - `region` cut to 120; added to the search text when not already there; suggestions in that region first
- **PL2. Details:** `GET /v1/places/details?id=&session=`; `id` must match `^[A-Za-z0-9_-]{10,300}$`.
- **PL3. Errors:**
  - no `GOOGLE_MAPS_API_KEY` → 503 `places.not_configured`
  - Google failing or timing out (3 s, breaker `places.google`) → 503 `places.unavailable`
  - over the limit → 429 with Retry-After
- **PL4.** Responses are `Cache-Control: no-store`. The Google key never leaves the server.

## 4. Revalidation (Notifications)

| Domain event | Paths | When |
|---|---|---|
| `events.event_published`, `events.event_cancelled` | `/e/{slug}`, `/`, `/discover` | at once |
| `events.event_updated` | `/e/{slug}`; plus `/` and `/discover` when `title`, `startsAt`, `coverUrl`, `visibility` or `location` changed | at once |
| `events.event_deleted` | `/e/{slug}`, `/`, `/discover` | at once |
| `ticketing.order_completed`, `ticketing.order_pending` (Q1 A) | `/e/{slug}` | once a minute per event: job `revalidate.orders.{eventId}.{minute}`, run 60 s after the first order of that minute |
| `ticketing.order_declined`, approve and promote (they emit `order_completed`) | `/e/{slug}` | as above |

- **RV1. Signature:** `POST {REVALIDATE_URL}` with JSON `{ paths }` and the signed headers. The secret `REVALIDATE_SECRET` is at least 32 characters, also set in Vercel.
- **RV2. Not configured** (`REVALIDATE_URL` empty, e.g. locally): jobs complete as skipped, logged at debug level.
- **RV3. Delivery:**
  - 2xx = done
  - 4xx = permanent (logged; no retry); for example 401 is a secret mismatch, which raises the `revalidation_failed` metric
  - 5xx, timeout (5 s) or network error = retried with the standard backoff (5 attempts)
  - breaker `revalidation.web`
- **RV4.** Revalidation never blocks or fails a user action: it runs from the outbox after commit.
- **RV5. Slug:** the job resolves the slug when it runs (the event may have changed). For deleted events the slug is carried in the event payload (`EventDeleted.slug`).

## 5. Errors

| Code | HTTP | Message |
|---|---|---|
| `flyer.type` | 422 | Use a JPEG, PNG or WebP image. |
| `flyer.size` | 422 | Flyers can be at most 5 MB. |
| `flyer.not_uploaded` | 409 | Upload the image first. |
| `flyer.path_invalid` | 400 | That upload doesn't belong to this event. |
| `flyer.storage_unavailable` | 503 | Flyer uploads are unavailable right now. Please try again shortly. |
| `places.bad_request` | 400 | Check the search and try again. |
| `places.not_configured` | 503 | Place search isn't set up yet. |
| `places.unavailable` | 503 | Place search is unavailable right now. Type the address instead. |
