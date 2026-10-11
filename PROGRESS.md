# G-vents progress (handoff notes)

## Status
- Live preview: https://g-vents.vercel.app (Vercel project `g-vents`, staging Supabase keys)
- Supabase: `gvents-staging` (eu-west-2) and `gvents-prod` (eu-west-2), both with the same schema
- Build: passes (`npm run build`)

## Done
- Home page: globe with city pins, categories, "Happening soon" list (sample data until real events exist)
- Sign in with email code (`/sign-in`)
- Create event, 3 steps: basics, tickets, review. Saves as draft or published (`/events/new`)
- Public event page (`/e/[slug]`): details and tickets, shows drafts only to the owner

## Not done yet (in order)
1. Supabase Auth email template must show the 6-digit code (`{{ .Token }}`). Set it in Supabase: Authentication → Email Templates.
2. Custom SMTP for auth emails (Supabase's built-in sender is limited). Use Resend.
3. Registration and payment (`reserve_ticket` function exists in the database; no UI yet).
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
