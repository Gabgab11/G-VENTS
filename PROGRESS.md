# G-vents progress (handoff notes)

## Status
- Live preview: https://g-vents.vercel.app (Vercel project `g-vents`, staging Supabase keys)
- Supabase: `gvents-staging` (eu-west-2) and `gvents-prod` (eu-west-2), both with the same schema
- Build: passes (`npm run build`)

## Done
- Organizer event page /dashboard/[id] with tabs: Overview (share link, open/close registration, capacity with waiting list), Guests (check-in, waiting list promotion), Registration (custom questions: text, multiple choice, social, company, checkbox terms, phone, website), Announcements (saved as drafts).
- Guest registration on /e/[slug] using the register_guest database function (checks open/closed, capacity, duplicates).
- Attendee count via public_attendee_count function (respects the organizer's setting).
- Sign-in card (Luma-style): email code, then 6-digit code. Redirects to /dashboard.
- Create event (Luma-style two-column): cover themes, dates, location, tickets (free or paid), options: public/private, show attendee count, require approval, refund policy.
- Organizer dashboard (/dashboard): public/private toggle, show-count toggle, draft publish, registration count (only the owner sees it when hidden).
- Public event page shows the attendee count only when the organizer allows it.
- Database: events.visibility, events.show_attendee_count, events.require_approval, events.cover_theme (applied to staging and production).
- Home page: globe with city pins, categories, "Happening soon" list (sample data until real events exist)
- Sign in with email code (`/sign-in`)
- Create event, 3 steps: basics, tickets, review. Saves as draft or published (`/events/new`)
- Public event page (`/e/[slug]`): details and tickets, shows drafts only to the owner

## Not done yet (in order)
1. Supabase Auth email template must show the 6-digit code (`{{ .Token }}`). Set it in Supabase: Authentication → Email Templates.
2. Custom SMTP for auth emails (Supabase's built-in sender is limited). Use Resend.
3. Sending announcements by email (needs the Resend connection on the server).
4. Require-approval workflow.
5. Payment for paid tickets (registrations stay pending until then).
6. Registration and payment (`reserve_ticket` function exists in the database; no UI yet).
4. Discover page (currently placeholder).
5. Team and roles, blast email, check-in: designed in the prototype, not built.
6. Missing pages linked from footer: /pricing, /help, /terms, /privacy, /refunds.
7. Replace sample globe pins with real city counts from the database.
8. Turn on Supabase daily backups before the December event.

## Decisions made
- Currency: NGN (kobo stored in `price_minor`). Prices are typed in whole naira.
- Time zone: events stored with Africa/Lagos (UTC+1, no daylight saving).
- Categories: Music, Conferences, Tech, Faith, Arts, Food, Sports, Business, Nightlife, Education, Community, Charity, Family, Other.
- Keys: only the anon key goes in the app. The service role key is never used in the browser.

## Notes for next session
- Schema file: `supabase/gvents-schema.sql` (matches both databases).
- Staging first, then production.
