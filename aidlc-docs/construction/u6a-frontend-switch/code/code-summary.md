# U6a Frontend Switch — Code Summary

**Plan:** `construction/plans/u6a-frontend-switch-code-generation-plan.md` (7 steps, all done).

**Code:** G-VENTS, branch `feature/backend-split`. Small API fixes in gventz-api.

**Commits:** none made by the AI.

## What changed

| Area | Files |
|---|---|
| API client | `src/lib/api/{server,problem,headers}.ts`, `schema.d.ts` (generated); `npm run api:types`; `serverEnv()` (`API_URL`, `BFF_SHARED_SECRET`); dependencies `openapi-fetch` 0.17.0, `server-only`, `jsqr` 1.4.0; dev `openapi-typescript` 7.13.0 |
| Sign-in | Google button on `/sign-in`; `src/app/auth/callback/route.ts` (code exchange, safe `next`) |
| Create and publish | `src/app/events/create-event-input.ts` (form → `CreateEventDto`), `actions.ts` via `POST /v1/events`; the form gains Online event, a time zone picker and max tickets per person; dashboard quick toggles (publish, visibility, attendee count) via the API |
| Public page | `src/lib/event-page.ts` and `src/app/e/[slug]/page.tsx` from `GET /v1/events/by-slug/{slug}` |
| Tickets | `OrderForm.tsx` (quantity per type, guest names, questions, buyer name), `order-input.ts`, `placeOrder` (retries `order.busy` once after 2 s); `/orders/[orderId]`; `/my-tickets`; `components/OrderCard.tsx`; `/t/[code]` from `GET /v1/tickets/{code}` with check-in via the API |
| Door scanner | `/dashboard/[id]/scan` (camera + jsQR, typed codes, full-screen green or red, vibration), `scanTicket` action, `scan-screen.ts`; "Scan tickets at the door" on the dashboard |
| Local dev | `supabase/scripts/gen-signing-key.mjs` (ES256 local key, gitignored output; CI runs it before `supabase db start`); `config.toml` `[auth]` (signing keys, site URL, callback URL, code email template `supabase/templates/sign-in-code.html`); README |

**Kept for U6b:**
- `getLegacyTicket` and `send-ticket.ts`: the dashboard's approve and promote still email through the old path
- `/api/places/*`, the outside listings, and the remaining Server Actions

**API changes made during U6a:**
- **Ticket view:** now carries the event's `startsAt`, `endsAt` and `status`.
- **OpenAPI types:** nullable numbers and strings had no type in the spec (`capacity`, `quantity`, `description`, `refundPolicy` showed as empty objects in generated clients). Fixed in the API's DTOs.

## Verification (2026-10-25)

| Check | Result |
|---|---|
| `npm run lint`, `typecheck` | clean |
| `npm test` | 53 passed (new: API client, create mapping, order mapping, scan screen) |
| `next build` | pass; new routes `/orders/[orderId]`, `/my-tickets`, `/dashboard/[id]/scan`, `/auth/callback` |
| gventz-api after its small changes | build, ticketing integration 16/16, `openapi.json` regenerated |
| Smoke (production build `next start` + gventz-api + local Supabase with ES256 keys) | 12/12 — see below |

**Smoke steps:**
1. Sign in with an email code.
2. Create and publish an event through the API.
3. The public order form shows the per-person limit.
4. Get 3 tickets across 2 types with a guest name.
5. Going over the limit shows the API's message.
6. The order page lists 3 tickets with QR codes.
7. The ticket page shows the guest, "2 of 3" and the staff check-in button.
8. The scanner page loads for the host.
9. A scan of the ticket link is green.
10. Scanning again shows already used.
11. My tickets lists the order.
12. Signed-out visitors see the sign-up card.

The smoke called the real Server Actions through React's own `encodeReply`. Ticket emails were pointed at a missing stub, so they retried and the provider breaker opened, as designed.

## Notes and owner items
- **O17:** enable Google in Supabase Auth (client id and secret; redirect URLs `https://<site>/auth/callback` plus preview and local). Set the code email template (same content as `supabase/templates/sign-in-code.html`) and asymmetric signing keys in both projects.
- **Vercel settings:** `API_URL` (the Render URL) and `BFF_SHARED_SECRET` for Preview and Production. `TICKETMASTER_API_KEY`, `PREDICTHQ_API_KEY` and `ICAL_FEED_URLS` stay in `.env.example` until U6b removes the outside listings.
- **Not tested:** the camera on real phones. jsQR decoding is the same library the API's tests verify; a real iPhone and Android check belongs in Build and Test.
- **Region:** the README states eu-west-2 (London) for both Supabase projects; that settles O9 unless you say otherwise.
