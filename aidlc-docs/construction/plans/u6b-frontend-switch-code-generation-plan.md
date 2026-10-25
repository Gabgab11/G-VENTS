# U6b Frontend Switch — Code Generation Plan (M2)

This plan is the single source of truth for U6b code generation. Each step is ticked as soon as it's done.

## Unit Context
- **Repository:** G-VENTS (`feature/backend-split`). Code generation only (unit-of-work.md).
- **Goal:** every remaining screen goes through gventz-api, and Supabase is used for sign-in only. Also:
  - the outside listings and `/api/places/*` are removed
  - the HMAC `/api/revalidate` route is added
  - the security headers are completed
- **Stories:**
  - US-2.2 edit, US-2.3 flyer, US-2.5 settings, US-2.6 delete
  - US-3.3 approvals, US-3.4 waiting list
  - US-7.3 guest list (I2 search and filters, I3 CSV export, I4 decline)
  - US-5 Discover (G-ventZ events only)
- **Not committed.**

## Finding while planning
The current `Permissions-Policy` sets `camera=()`, which would block the U6a door scanner in every browser. Step 8 changes it to `camera=(self)`.

## Steps

### Step 1 — Event access and dashboard data from the API
- [x] `requireEventRole` → `GET /v1/events/{id}`. The API answers 404 without a role; the dashboard keeps the returned role and permissions to show or hide controls.
- [x] `/dashboard` (my events) → `GET /v1/me/events`; event rows from it.
- [x] Dashboard theme → `GET`/`PATCH /v1/me` (`dashboardTheme`).
- [x] Overview tab counts from the dashboard response (confirmed, pending, waitlisted, declined, checked in).
- *API additions for this unit: the dashboard response carries `notifyRegistration`; "my events" rows carry `showAttendeeCount`. Quick toggles and tab controls show according to the caller's permissions. API error codes travel in the URL as `api.<code>` and are shown from a fixed table (`src/lib/api/messages.ts`), so links can't inject text.*

### Step 2 — Dashboard actions through the API
- [x] Registration open, capacity, theme, attendee count → `PATCH /v1/events/{id}/settings`.
- [x] Details → `PATCH /v1/events/{id}`; the venue → `PUT /v1/events/{id}/location`.
- [x] Questions → `GET`/`POST /v1/events/{id}/questions`, `DELETE …/{questionId}`.
- [x] Announcements (drafts) → `GET`/`POST /v1/events/{id}/announcements`.
- [x] Cancel → `POST …/cancel`; delete → `GET …/deletion-check` then `DELETE /v1/events/{id}` (the name typed to confirm).
- [x] Flyer: the server action asks for an upload URL, PUTs the file to Supabase Storage from the server, then confirms. Remove → `DELETE …/flyer`. The page keeps its file input; the API checks the bytes.
- [x] Each action shows the API's message on failure (the existing `ok`/`err` messages stay for successes).

### Step 3 — Guest list, approvals, waiting list, export
- [x] The Guests tab → `GET /v1/events/{id}/guests`:
  - search (name, email, @domain, code)
  - filters (status, ticket type), sort, pages
  - totals and the waitlist count
  - a row per ticket with "n of m" and the order
- [x] Check in from the list → `POST …/guests/{ticketId}/check-in`.
- [x] Pending requests are grouped by order, with **Approve** and **Decline** (optional message) → `POST …/orders/{orderId}/approve|decline` (I4).
- [x] **Promote next** from the waiting list → `POST …/waitlist/promote`, showing the API's "none fits" or "empty" messages.
- [x] **Export CSV:** `src/app/dashboard/[id]/guests.csv/route.ts` streams the API's CSV with the user's token (owner, admin, finance; others see the API's 403).

### Step 4 — Home and Discover from the API; outside listings removed
- [x] `getFeaturedEvents` → `GET /v1/events/featured?category=&limit=` (anonymous; cached with Next's fetch revalidation, 60 s). — *anonymous API calls read no cookies or request headers, so the home page stays static*
- [x] Remove `src/lib/external.ts`, `src/components/ElsewhereEvents.tsx`, and their use on `/discover`. Remove `TICKETMASTER_API_KEY`, `PREDICTHQ_API_KEY` and `ICAL_FEED_URLS` from `.env.example`.

### Step 5 — Venue search through the API
- [x] Server actions `searchPlaces` and `placeDetails` → `GET /v1/places/autocomplete|details` (the user's token and limits apply).
- [x] `LocationFields` calls them instead of `/api/places/*`.
- [x] Remove `src/app/api/places/*` and `src/lib/places.ts`. Remove `GOOGLE_MAPS_API_KEY` from the website (the API holds it). — *the env cleanup is done with step 4*

### Step 6 — `/api/revalidate`
- [x] `src/app/api/revalidate/route.ts`:
  - verify `x-gventz-timestamp` and `x-gventz-signature` (HMAC-SHA256 of `{timestamp}.{body}`, at most 5 minutes old, constant-time compare), exactly as gventz-api's `verifyRevalidation`
  - `revalidatePath` for each path (`/e/…`, `/`, `/discover` only; others refused)
  - 401 on a bad signature
- [x] `REVALIDATE_SECRET` (server only) in `.env.example`.
- [x] Unit tests: signature accept and refuse, path allow-list.

### Step 7 — Supabase for sign-in only
- [x] Remove:
  - the legacy ticket reader and the old email sender (`src/lib/email/*`, `getLegacyTicket`); approvals and promotions now email through the API
  - `src/lib/supabase/public.ts`
  - every remaining `.from()`, `.rpc()` and `.storage` call
- [x] `src/lib/supabase/` keeps the auth helpers only (server and browser clients and the middleware session refresh). `database.types.ts` stays for now, unused, and is removed after go-live with the old app's functions.
- [x] `grep` check: no data access through Supabase in `src/`.

### Step 8 — Security headers and CSP
- [x] `Permissions-Policy`: `camera=(self)` (the door scanner); the rest unchanged.
- [x] **CSP set per request in the middleware:**
  - `default-src 'self'`
  - `script-src 'self' 'nonce-…' 'strict-dynamic'` (Next applies the nonce to its scripts)
  - `style-src 'self' 'unsafe-inline'` (inline style attributes and the ticket page's style block)
  - `img-src 'self' data: blob: <supabase>`, `connect-src 'self' <supabase>`
  - `font-src 'self'`
  - `frame-ancestors 'none'`, `base-uri 'self'`, `object-src 'none'`, `form-action 'self' <supabase>` (the Google redirect)
- [x] Unit test for the CSP builder; manual check that the pages load with no CSP errors.
- *Changed from the plan: `script-src 'self' 'unsafe-inline'` instead of a per-request nonce. The home page is static (refreshed every minute), and cached HTML can't carry a fresh nonce, so a nonce policy would block its scripts. Every other directive is strict (no external scripts, `object-src 'none'`, `frame-ancestors 'none'`, connections only to the site and Supabase). Headers live in `src/lib/csp.ts` and are applied in `next.config.ts`; COOP same-origin added.*

### Step 9 — Verification and docs
- [ ] `lint`, `typecheck`, `test`, `build`.
- [ ] Smoke (production build + API + local Supabase): the dashboard list, overview counts, edit details, add and remove a question, flyer upload (API storage on local Supabase), guest list search, approve and decline on an approval event, promote, CSV download, cancel, delete; home and Discover listings; `/api/revalidate` accepts a signed call and refuses a forged one; no direct Supabase data calls.
- [ ] README; `aidlc-docs/construction/u6b-frontend-switch/code/code-summary.md`.
