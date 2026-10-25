# U6a Frontend Switch — Code Generation Plan (M1)

This plan is the single source of truth for U6a code generation. Each step is ticked as soon as it's done.

## Unit Context
- **Repository:** G-VENTS (Next.js 15, branch `feature/backend-split`). Code at the repository root (`src/`).
- **Design stages:** code generation only (unit-of-work.md). The contract is gventz-api's `openapi.json` (34 paths).
- **Depends on:** U1–U5 (the API). Supabase stays for sign-in only.
- **Stories:**
  - US-1.x sign-in (email code + Google)
  - US-2.1 create and publish
  - US-2.4 (setting) per-buyer limit
  - US-2.7 public page
  - US-3.1 several free tickets
  - US-3.2 tickets email (sent by the API)
  - US-8.1–8.3 door scanning
  - I7 my tickets (the API's emails link to `/my-tickets`)
- **Out of U6a (U6b, M2):**
  - every other Server Action (dashboard, settings, questions, flyer, guest list, approvals, announcements)
  - the venue search switching to `/v1/places/*`
  - removing `/api/places/*` and the outside listings (`src/lib/external.ts`, `ElsewhereEvents`)
  - the `/api/revalidate` route
  - security headers and CSP
- **Not committed.**

## Decisions made here (conventional, no question needed)
- **API client:**
  - Types are generated from `openapi.json` with `openapi-typescript`; requests go through `openapi-fetch` (small, typed).
  - Server-side only: the browser never calls the API directly (AD13, the BFF pattern).
- **Each call carries:**
  - the user's Supabase access token, read from the session cookie on the server
  - the request id
  - `x-gventz-bff-key` + `x-gventz-client-ip` (so the API's per-IP limits see the real visitor)
- **New server-only settings:** `API_URL`, `BFF_SHARED_SECRET`.
- **Errors:** the API's problem details carry user-safe `detail` text, which is shown as is. Network errors and 5xx show a generic message (project rule: unexpected errors are logged and replaced).
- **Door scanning** works in the browser on any phone:
  - the camera through `getUserMedia`
  - QR decoding with `jsqr` (BarcodeDetector isn't available on iPhone Safari)
  - typing the code by hand also works

## Steps

### Step 1 — API client and settings
- [x] Dev dependency `openapi-typescript`; dependency `openapi-fetch`. Script `npm run api:types` → `src/lib/api/schema.d.ts` from `../gventz-api/openapi.json` (or `API_OPENAPI_URL`).
- [x] `src/lib/api/server.ts`: `api()` with token, request id, BFF headers; `ApiError` from problem details; `apiMessage(error)` for forms. Server-only (`import "server-only"`).
- [x] `src/lib/env.ts`: `apiUrl`, `bffSharedSecret` (server only); `.env.example` updated.
- [x] Unit tests: problem details → message; header building; client IP from `x-forwarded-for`.

### Step 2 — Sign-in with Google
- [x] "Continue with Google" on `/sign-in` (`signInWithOAuth`, provider `google`, redirect to `/auth/callback?next=…`), above the email code.
- [x] `src/app/auth/callback/route.ts`: exchange the code for a session; safe `next` redirect (`safeNextPath`); error → `/sign-in?error=google`.
- [x] Owner item O17 *(recorded; the owner enables Google in both projects)*: enable Google in Supabase Auth (client id and secret, redirect URLs for production, preview and local).

### Step 3 — Create and publish through the API
- [x] `createEvent` action → `POST /v1/events`:
  - local `startsAt`/`endsAt` + `timeZone`
  - the location input (venue with optional place, or online)
  - ticket types (name, quantity)
  - `perBuyerLimit`, `requireApproval`, `showAttendeeCount`, `visibility`, `coverTheme`, `refundPolicy`, `publish`
- [x] Form additions:
  - an **Online event** switch
  - a **time zone** select, shown for online events and for countries with several zones; default the browser's zone or the country's only zone; the list comes from `/v1/reference/countries` *(changed: the browser's built-in `Intl` zone list; same zones, no extra call; the API still checks the zone)*
  - **Max tickets per person** (1–10, default 10)
- [x] The dashboard's "Publish" button → `POST /v1/events/{id}/publish`. — *all three quick toggles on the event list (publish, visibility, attendee count) now go through the API*
- [x] Unit tests for the form → command mapping.

### Step 4 — Public event page through the API
- [x] `/e/[slug]` reads `GET /v1/events/by-slug/{slug}` (with the viewer's token when signed in): page, ticket types, questions, attendee count, `canManage`. Same look as today.
- [x] Draft and cancelled notices and "Manage this event" as today, from the API's `status` and `canManage`.

### Step 5 — Getting tickets
- [x] The order form replaces `RegisterForm`:
  - quantity per ticket type, total up to the event's per-person limit
  - optional names for tickets 2..n
  - the event's questions once
  - the buyer's name (prefilled from the profile)
- [x] `placeOrder` action → `POST /v1/events/{id}/orders`. On `order.busy` (503): wait 2 s and retry once, then show the message (NFR design Q2 A).
- [x] The order result page `/orders/[orderId]` (from `GET /v1/me/orders/{orderId}`):
  - completed: every ticket with its QR and link
  - pending: "request received"
  - waitlisted: "you're on the list"
- [x] The ticket page `/t/[code]` reads `GET /v1/tickets/{code}`; the QR is drawn from `qrPayload` (existing `qrSvg`); staff see "Check in" (`canCheckIn`) → `POST /v1/events/{id}/check-in`.
- [x] `/my-tickets` → `GET /v1/me/orders?when=upcoming|past` with "load more".
- [x] The old email sender for tickets (`src/lib/email/send-ticket.ts`) is no longer called: the API emails tickets. — *still used by the dashboard's approve/promote actions until U6b; its reader is kept as `getLegacyTicket`*
- *API change made for this step: the ticket view now includes the event's `startsAt`, `endsAt` and `status` (the page shows the times and the cancelled notice). Fixed OpenAPI types for nullable numbers and strings (`capacity`, `quantity`, `description`, `refundPolicy` were typed as empty objects).*

### Step 6 — Door scanner
- [x] `/dashboard/[id]/scan`:
  - camera preview, decoding frames with `jsqr`
  - each code is sent once to a server action → `POST /v1/events/{id}/check-in`
  - a full-screen green or red result with the reason, name and ticket "n of m"; ready for the next scan after 1.5 s
  - typing a code by hand also works
- [x] A link from the dashboard ("Scan tickets"), shown to roles with `guests.checkIn`.
- [x] Unit test: the scan result → screen text and colour mapping.

### Step 7 — Verification and docs
- [x] `npm run lint`, `typecheck`, `test`, `build`.
- [x] Smoke against the local API: sign-in with an email code (local Supabase) → create and publish → public page → get 3 tickets → order page → ticket page → scan green → scan again red → my tickets.
- [x] README (the API settings, `api:types`); `aidlc-docs/construction/u6a-frontend-switch/code/code-summary.md`.
