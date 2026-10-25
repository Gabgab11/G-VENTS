# U5 Media, Discovery and Revalidation — Domain Entities

**Answers** (`construction/plans/u5-media-discovery-functional-design-plan.md`):
- **Q1 A:** refresh the public page after orders, at most once a minute per event.
- **Q2 A:** flyers are kept as uploaded (no resizing) for go-live.

**Modules:**
- `src/modules/media/`
- `src/modules/discovery/`
- revalidation in `src/modules/notifications/` (application design §4.6: Notifications owns the outbound calls to the website)

## Media

| Concept | Shape | Notes |
|---|---|---|
| `FlyerPath` (value) | `{eventId}/{epochMillis}-{random6}.{jpg\|png\|webp}` | Built by the API, never taken from the client. The folder is the event id, which the bucket's storage policies also use. |
| `FlyerUpload` (value) | `{ path, uploadUrl, token, expiresAt }` | A Supabase signed upload URL for exactly that path (valid 2 hours, Supabase's fixed lifetime) |
| `ImageKind` (value) | `jpeg` \| `png` \| `webp` | From the first 12 bytes (magic numbers), the same as today |
| `Flyer` (read) | `{ url, path }` | The public URL `…/storage/v1/object/public/event-covers/{path}`, stored in `events.cover_url` (U3 `EventCoverPort`) |

## Discovery

Outside listings were removed (2026-10-25); Discovery is the venue search only.

| Concept | Shape | Notes |
|---|---|---|
| `PlaceSuggestion` | `{ placeId, main, secondary }` | |
| `PlaceDetails` | `{ placeId, name, address, city, countryCode, lat, lng }` | The shape U3's `place` input expects (`placeId`, `lat`, `lng`) |
| `PlacesSession` (value) | `^[A-Za-z0-9-]{8,64}$` | Google billing session token, sent by the client |

## Revalidation

| Concept | Shape | Notes |
|---|---|---|
| `RevalidationRequest` | `{ paths: string[] }` | Paths only, e.g. `/e/{slug}`, `/`, `/discover`; at most 20 |
| `SignedCall` (value) | headers `x-gventz-timestamp` (seconds), `x-gventz-signature` = hex HMAC-SHA256(secret, `{timestamp}.{body}`) | Verified by the website (U6b), which refuses timestamps more than 5 minutes off |

## Platform change
**`outbox_events.run_at`** (new, nullable): "don't queue before". An outbox route may set it; the relay turns it into a BullMQ delay. It is used for the once-a-minute refresh (Q1 A).
