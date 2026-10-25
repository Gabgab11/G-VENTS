# U5 Media, Discovery and Revalidation — Functional Design Plan (light)

**Scope** (unit-of-work.md): flyers on Supabase Storage, outside event listings, the Places proxy that replaces `/api/places/*`, and the signed revalidation job. Featured events already exist (U3).

**Kept from the current app, so not asked:**
- **Flyers:**
  - bucket `event-covers`, public, 5 MB, JPEG/PNG/WebP
  - path `{eventId}/{timestamp}.{ext}`
  - the file type is checked from its first bytes, never the declared type
  - the old file is removed after a replace, and the folder after an event delete
  - who: `flyer.manage` (owner, admin, editor)
- **Outside listings:**
  - Ticketmaster, PredictHQ and iCal feeds; each optional (skipped without a key or URL)
  - worldwide, upcoming only, soonest first, 12 shown
  - only `http(s)` links become clickable
  - cached 1 hour, 4 s timeout per source
  - the per-source status report shows outside production only, as today
- **Places:**
  - Google Places (New): autocomplete limited to the chosen country, region results first, then details
  - one billing session token per search
  - signed-in users only, 60 lookups a minute and 1,000 a day per user
  - the Google key stays on the server
- **Revalidation:** HMAC-signed calls to the website's `/api/revalidate` (built in U6b), queued with retries (AD4).

**Settled by the application design:**
- **Flyer uploads use a signed upload URL.** The API issues a short-lived Supabase upload URL for a new path. The file goes straight to Storage, not through the API. A confirm call then checks the file's first bytes and size, sets the flyer, and removes the old one.
- The API therefore needs the Supabase **secret key** for Storage, server-side only: new setting `SUPABASE_SECRET_KEY` (owner item, set with O17).

## Plan
- [x] 1. Collect and analyze answers
- [x] 2. `u5-media-discovery/functional-design/business-rules.md`: flyer flow and checks; listings (sources, normalisation, cache, failure); Places (inputs, limits, errors); revalidation (triggers, paths, debounce, signature)
- [x] 3. `business-logic-model.md`: flows, ports, testable properties
- [x] 4. `domain-entities.md`: `Flyer`, `ExternalListing`, `PlaceSuggestion` and `PlaceDetails`, `RevalidationRequest`
- [x] 5. Security and Resiliency check

## Questions

Put your choice after each `[Answer]:` tag, and save the file before replying.

### Question 1 — How fresh the public event page is
The public page is cached by the website and refreshed when the API asks (revalidation). Host edits always trigger a refresh. The open question is the **attendee count** (when "show attendee count" is on), and the "sold out" or "few left" state, which change with every order.

A) **Refresh after orders, at most once a minute per event.**
   - The first order in a quiet minute schedules one refresh 60 seconds later; more orders in that minute add nothing.
   - At the December rush that's one refresh a minute for that event, not 50 a second.
   - (Recommended.)

B) Refresh only on host edits. The count and "sold out" can be stale until the page's normal cache time (5 minutes) runs out.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — Flyer images
Today the uploaded file is stored as it is, up to 5 MB, and shown everywhere. A 5 MB photo makes the event page and the Discover cards slow on mobile data.

A) **Keep the original as today for go-live.** Add resizing later with Supabase's image transformations (a paid-plan feature) or our own resize job. (Recommended for 15 November: no new moving parts.)

B) Resize on confirm: the API makes a 1600 px WebP copy (about 200–400 KB, with the `sharp` library), stores it next to the original and uses it as the flyer. About a day of work; adds a native dependency to the Docker image.

X) Other (please describe after [Answer]: tag below)

[Answer]: A
