# U5 Media, Discovery and Revalidation — Business Logic Model

## 1. Flyer upload (signed URL)

```text
client                    API                                  Supabase Storage
  | POST upload-url  ---->  flyer.manage; type allowed
  |                         path = {eventId}/{ms}-{rand}.{ext}
  |                         POST /storage/v1/object/upload/sign/event-covers/{path}  ---> token
  | <---- { path, uploadUrl, expiresAt }
  | PUT uploadUrl (bytes) -------------------------------------------------------------> stored (bucket: 5 MB, types)
  | POST flyer {path} ---->  path under {eventId}/ and well formed
  |                         GET public object, Range: bytes=0-15  ---> first bytes + Content-Range total
  |                         sniff type; size <= 5 MB   (else delete + 422)
  |                         [tx] EventCoverPort.setCover(eventId, url)   (EventUpdated{coverUrl}; outbox: revalidate,
  |                                                                       media-cleanup of the previous file)
  | <---- { url }
```

**Ports (Media):**
- `FileStorage`: `signUpload(bucket, path)`, `head(bucket, path, bytes)`, `remove(bucket, paths)`, `list(bucket, prefix)`
- adapter `SupabaseStorageFileStorage` (REST, secret key, 5 s timeout, breaker `storage.supabase`)

## 2. Outside listings — removed (2026-10-25)

## 3. Places
`PlacesService.autocomplete/details`:
- limit `places.lookup` (user)
- validate
- `PlacesClient` (Google, breaker `places.google`, 3 s)
- region ordering (pure)

## 4. Revalidation
- **Outbox routes** (registered by Notifications):
  - events → `revalidation` queue, job `revalidate.{eventName}.{aggregateId}.{occurredAt}`, run at once
  - orders → job `revalidate.orders.{eventId}.{floor(occurredAt/60s)}`, `runAt = occurredAt rounded down to the minute + 60 s`
  - duplicate job ids are ignored, so a burst collapses to one job
- **Outbox change:** an `OutboxRoute` may give `runAt(event)`. The writer stores it in `outbox_events.run_at`, and `JobQueueSink` adds the job with `delay = max(0, runAt − now)`.
- **`RevalidationWorker`** (queue `revalidation`, worker role):
  - resolve the paths (the slug by event id, or from the payload for deletes)
  - `WebRevalidator.revalidate(paths)` (HMAC, 5 s, breaker)
  - classify the answer (RV3)

## 5. Testable properties (PBT)

| Component | Property | Category |
|---|---|---|
| `sniffImage` | For any bytes: returns a kind iff the magic number matches; any prefix of a valid header shorter than its signature returns null | Oracle |
| `FlyerPath` | Built paths always parse back to the same event and extension; parse refuses `..`, other folders, and other extensions | Round-trip, Invariant |
| Region ordering | Output is a permutation of the input; in-region items precede the others; relative order is kept within each group | Invariant |
| HMAC signature | Verify(sign(body, ts)) is true; flipping any byte of the body, timestamp or secret makes it false | Round-trip, Invariant |
| Debounce job ids | Any two orders of one event in the same minute give the same job id and runAt; different minutes give different ids | Invariant |
