# G-vents progress (handoff notes)

## Status
- Live preview: https://g-vents.vercel.app (Vercel project `g-vents`, staging Supabase keys)
- Supabase: `gvents-staging` (eu-west-2) and `gvents-prod` (eu-west-2), both with the same schema
- Build: passes (`npm run build`)

## Done
- Phone layout: single-column forms and cards under 600px, 44px tap targets, no sideways scrolling, wrapped tabs and buttons.
- Create event requires an account (sign-up first). New events start with the host's dashboard style.
- Event and registration pages use the event's chosen style. Hosts can change it in Settings.
- Host Settings tab per event: flyer upload (JPG/PNG/WebP, 5 MB max, stored in the event-covers bucket), event details, email-on-registration preference (sending not connected yet), cancel event.
- Flyers appear on event pages and in Discover.
- Back buttons on dashboard, event pages, Discover, sign-in, create-event, and info pages.
- External events are worldwide (no country limit on Ticketmaster or PredictHQ). Shows up to 12.
- Discover page (/discover): G-vents events plus a 'Happening elsewhere' section from Ticketmaster, PredictHQ, and iCal feeds. Each source is optional and needs its key or URL in Vercel (TICKETMASTER_API_KEY, PREDICTHQ_API_KEY, ICAL_FEED_URLS). Results cached 1 hour; loads separately so the page shows first.
- Guests must create a free account (email code) before registering. Accounts can register once per event.
- Christmas style with falling snow and a running Santa (cover picker and dashboard).
- Dashboard changes to registration questions appear on the guest form on its next load.
- Fixed: guest registration links returned 404 for signed-out visitors (policy check needed anon permission on has_event_role). Fixed on both databases.
- Organizers choose their dashboard style (Minimal, Sunset, Ocean, Forest, Night, Ember, Blush, Mint, Lavender). Saved to profiles.dashboard_theme.
- Organizer event page /dashboard/[id] with tabs: Overview (share link, open/close registration, capacity with waiting list), Guests (check-in, waiting list promotion), Registration (custom questions: text, multiple choice, social, company, checkbox terms, phone, website), Announcements (saved as drafts).
- Guest registration on /e/[slug] using the register_guest database function (checks open/closed, capacity, duplicates).
- Attendee count via public_attendee_count function (respects the organizer's setting).
- Sign-in card (Luma-style): email code, then 6-digit code. Redirects to /dashboard.
- Create event (Luma-style two-column): cover themes, dates, location, tickets (free or paid), options: public/private, show attendee count, require approval, refund policy.
- Organizer dashboard (/dashboard): public/private toggle, show-count toggle, draft publish, registration count (only the owner sees it when hidden).
- Public event page shows the attendee count only when the organizer allows it.
- Database: events.visibility, events.show_attendee_count, events.require_approval, events.cover_theme (applied to staging and production).
- Home page: falling event cards (with a tap-to-play tilt game on phones), categories, "Happening soon" list
- Sign in with email code (`/sign-in`)
- Create event, 3 steps: basics, tickets, review. Saves as draft or published (`/events/new`)
- Public event page (`/e/[slug]`): details and tickets, shows drafts only to the owner

## Architecture review fixes (October 2026, branch `fix/architecture-review`)
- CI (lint, typecheck, tests, build), `.gitignore`, and unit tests.
- Schema now lives in `supabase/migrations/`. The hand-made objects are reconstructed there (see `supabase/README.md` before the first push).
- Security: safe sign-in redirect; private events not listable; no anonymous ticket reservation; one registration per person; registration answers validated in the database; email can't be claimed; staff limited by role; flyer storage rules.
- Dashboard: an ownership check on every page and action; no false "Saved" messages; message codes in the URL; guest list paged; one query for the event list.
- Paid tickets are hidden until payments exist. The database refuses them too.
- Error and not-found pages. Sample events removed. Sign out added. Music is opt-in.

## Architecture review fixes (22 October 2026, branch `fix/review-2026-10-22`)
- CI applies every migration to a throwaway database, lints it, runs the database tests (`supabase/tests/`) and fails if `database.types.ts` is stale.
- Ticket emails go to the guest's verified account email only (`register_guest` ignores the typed address).
- Places lookups: shared per-user limit in the database (60 a minute, 1000 a day).
- Supabase clients are typed from the generated schema.
- Security headers: no framing, motion sensors for this site only, no camera/microphone/location.
- Tilt game: starts only on tap and can be stopped; sensor listener removed on leaving the page; the loop sleeps when the cards settle; physics unit tested.
- Home page is cached (refreshed every minute) and its fonts load through `next/font`.
- Removed unused music, globe, hero photo and old CSS files.

## Not done yet (in order)
1. Apply the October 2026 migrations to staging, test, then production (`supabase/README.md`). Check what each database has with `supabase migration list --linked`. CI proves they apply in order to an empty database, not that the live databases have them.
2. Supabase Auth email template must show the 6-digit code (`{{ .Token }}`). Set it in Supabase: Authentication → Email Templates.
3. Custom SMTP for auth emails (Supabase's built-in sender is limited). Use Resend.
4. Confirmation emails to guests and sending announcements (needs RESEND_API_KEY in Vercel and a verified domain). The registration page shows the ticket code for now.
5. Approve/decline screen for require-approval events (guests are saved as `pending`).
6. Payments for paid tickets, with unpaid reservations expiring.
7. Team invitations and roles UI (the database supports roles already).
8. A captcha on sign-in and registration if abuse appears (Supabase rate-limits sign-in codes already).
9. Error monitoring (e.g. Sentry) and end-to-end tests for create → register → check in.
10. Time zone picker on create event (code supports any zone; the form still uses Lagos).
11. Turn on Supabase daily backups before the December event.
12. In Google Cloud, set a daily quota and API restrictions on the Places key (the app limit is per user, not a total).
13. A full Content-Security-Policy for scripts and styles (needs nonces, and the inline `<style>` blocks moved into CSS files first).
14. Upload flyers straight to Supabase Storage with a signed URL, so the 6 MB server action limit can go back to the default.

## Decisions made
- Currency: NGN (kobo stored in `price_minor`). Prices are typed in whole naira.
- Time zone: each event stores its own zone; new events default to Africa/Lagos.
- Categories: Music, Conferences, Tech, Faith, Arts, Food, Sports, Business, Nightlife, Education, Community, Charity, Family, Other (`src/lib/categories.ts`).
- Keys: only the anon key goes in the app. The service role key is never used in the browser.
- Writes that need several steps or special permissions go through database functions (`register_guest`, `check_in_guest`, `create_event_with_tiers`, ...).

## Notes for next session
- Schema: `supabase/migrations/` (applied in filename order).
- Staging first, then production.
