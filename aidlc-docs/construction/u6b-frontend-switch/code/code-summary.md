# U6b Frontend Switch — Code Summary

**Plan:** `construction/plans/u6b-frontend-switch-code-generation-plan.md` (9 steps, all done).

**Code:** G-VENTS, branch `feature/backend-split`. Small API additions in gventz-api.

**Commits:** none made by the AI.

## What changed

| Area | Files |
|---|---|
| Access | `src/lib/auth.ts`: `requireEvent` (the dashboard response from `GET /v1/events/{id}`, cached per request; 404 for outsiders) and `can()`. `requireUser` uses Supabase for sign-in only. |
| Dashboard | `/dashboard` (`GET /v1/me/events`, paged, role-based quick toggles); `getTheme`/`setDashboardTheme` via `/v1/me`; `[id]/page.tsx` and all tabs read the dashboard response; controls show according to permissions |
| Actions | `[id]/actions.ts`: settings, details, venue (`PUT …/location`, reuses the create form's `locationInput`), questions, announcements, flyer (signed upload URL → server PUT to Storage → confirm), cancel, delete, check-in from the list, approve, decline (message), promote |
| Messages | `src/lib/api/messages.ts`: API error codes → user text; `messageFor` reads `api.<code>` |
| Guest list | Search, status and ticket type filters, sort, pages, totals; pending requests grouped by order; `guests.csv/route.ts` streams the API's CSV (`apiFetch`) |
| Home and Discover | `src/lib/events.ts` via `GET /v1/events/featured`; anonymous API calls read no cookies or headers and use a 60 s fetch cache, so the home page stays static |
| Removed | `src/lib/external.ts`, `ElsewhereEvents`, `src/app/api/places/*`, `src/lib/places.ts`, `src/lib/email/*`, `src/lib/supabase/public.ts`, the legacy ticket reader; outside-listing, Google and Resend settings from `.env.example` |
| Venue search | `src/app/events/places-actions.ts` (server actions → `/v1/places/*`); `LocationFields` uses them; stale answers dropped by comparing against the latest search |
| Page refresh | `src/app/api/revalidate/route.ts` + `src/lib/revalidate.ts` (HMAC as the API's `verifyRevalidation`, 5-minute window, public paths only) |
| Headers | `src/lib/csp.ts`: CSP (Supabase origin for connections and images), `camera=(self)`, COOP; `next.config.ts` |

**API additions:**
- the dashboard response carries `notifyRegistration`
- "my events" rows carry `showAttendeeCount`

OpenAPI and types were regenerated, and the events integration tests still pass.

## Verification (2026-10-25)

| Check | Result |
|---|---|
| `lint`, `typecheck` | clean |
| `npm test` | 59 passed (new: revalidate signature and paths, CSP) |
| `next build` | pass; home page still static (refreshed every minute) |
| U6b smoke (production build + gventz-api + local Supabase) | 33/33, on two runs |
| U6a smoke again on the U6b build | 12/12 |
| Direct Supabase data access in `src/` | none (`.from`, `.rpc`, `.storage`) |

**What the U6b smoke covered:**
- **Dashboard:** list; edit details; a short title refused; add a question; an API rule error shown with the API's wording; remove the question.
- **Flyer:** uploaded to local Storage and checked by the API.
- **Waiting list:** capacity 1, one guest in and one waitlisted; promote refused, then succeeds after raising capacity.
- **Guest list and export:** @domain search with a status filter; CSV export with BOM; a guest can't export; a guest sees "Page not found" on the dashboard.
- **Approvals:** requests grouped by order; approve; decline with a message; approving twice is refused.
- **Overview counts.**
- **Cancel and delete:** cancel; delete refused with the wrong name, then succeeds.
- **Venue search** goes through the API.
- **Public pages and headers:** Discover lists only G-ventZ events; CSP and camera headers present; `/api/revalidate` accepts a signed call (200) and refuses a forged one (401); home shows the event after a refresh.

## Findings and changes
- **Camera blocked:** `Permissions-Policy` had `camera=()`, which would have blocked the U6a door scanner. Now `camera=(self)`.
- **CSP change from the plan:** `script-src 'self' 'unsafe-inline'` instead of a per-request nonce. The static home page can't carry a fresh nonce. All other directives are strict.
- **Streamed pages:** the root `loading.tsx` makes pages stream, so "not found" and sign-in redirects arrive in the body with HTTP 200 (as before U6b). No event data reaches outsiders; checked in the smoke.

## Known gaps
- **Old pending tickets:** pending tickets created by the old app have no order, so they can't be approved from the new guest list. This only matters for approval events with open requests from before go-live.
- **Announcements** are saved as drafts only; sending comes with a later unit, as before.
- `database.types.ts` stays only for the auth clients' typing; remove it after go-live, along with the old app's database functions.
