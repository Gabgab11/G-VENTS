# Application Design Plan — Change 1 (revision)

The version 1 plan and its answers are in `application-design-plan.md`. Those decisions still stand:
- repository `gventz-api`
- clean layers per module
- rich domain model
- module interfaces plus domain events
- `@Transactional()`
- separate read queries

This plan revises the design for Change 1:
- Supabase stays
- several tickets per purchase
- payments
- platform staff
- monitoring

Detailed business rules come later, in each unit's Functional Design.

Put your choice after each `[Answer]:` tag, and save the file before replying.

## Plan

- [x] 1. Analyze context: `requirements.md` rev 2.1, `stories.md` (45), the version 1 design documents, `execution-plan.md` v2
- [x] 2. Collect and analyze answers; ask follow-ups if any are ambiguous
- [x] 3. Revise `components.md`
  - [x] 3.1 Platform: Supabase pooler connection; no own migrations; schema generated from Supabase; OpenTelemetry, Grafana and Sentry; circuit breaker and timeout policy
  - [x] 3.2 Identity: Supabase token verifier, current user, MFA level, platform staff role; own-auth components removed (parked)
  - [x] 3.3 Events / Engagement: per-buyer limit, fee choice, paid-type gate (port to Payments)
  - [x] 3.4 Ticketing (was Registration): orders for several tickets, allocation and holds, approval, waitlist, check-in
  - [x] 3.5 **Payments (new):** `PaymentProvider` port with Paystack and Stripe adapters, checkout sessions, webhook inbox, payment confirmation, refunds, disputes, payout accounts, fee policy, ledger, reconciliation
  - [x] 3.6 Media (Supabase Storage), Discovery, Notifications, Revalidation
  - [x] 3.7 Platform staff / admin surface
- [x] 4. Revise `component-methods.md`: signatures for the new and changed services, ports and adapters
- [x] 5. Revise `services.md`: orchestration for free purchase, paid checkout, webhook confirmation, hold expiry, refund, cancellation refunds, reconciliation
- [x] 6. Revise `component-dependency.md`: matrix, communication, and data-flow diagrams (several free tickets, paid checkout, webhook, refund, check-in)
- [x] 7. Revise `application-design.md` (consolidated), including the REST resource map
- [x] 8. Validate:
  - [x] every requirement and Must or Should story maps to a component
  - [x] no cross-module repository access
  - [x] diagrams validated
  - [x] Security and Resiliency rules applicable at design time are checked (SECURITY-08, 11, 15; RESILIENCY-01, 10)

## Questions

### Question 1 — One "order" for free and paid tickets
Buying several tickets now applies to free events too (D56). Paid purchases need an order with a hold.

A) **One `Order` model for both, owned by the Ticketing module:**
   - A free order completes straight away.
   - A paid order waits for payment.
   - Tickets always belong to an order, which keeps groups, the per-buyer limit and approval in one place.
   - Payments only deals with money, and tells Ticketing "order paid" or "refund done" through domain events.
   - (Recommended: one path for free and paid, and payments plug in later without changing ticketing.)

B) Free tickets stay as today's single registrations with a group id. Only paid purchases create an order, inside the Payments module.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — How overselling is prevented at 50 purchases a second
A) **Postgres is the single source of truth:**
   - Each purchase runs in one short transaction.
   - The transaction locks the ticket type's row and checks sold + held against quantity and the event's capacity.
   - It then writes the tickets or the hold.
   - Today's `reserve_ticket` works the same way.
   - The load test (100 a second) proves it. If it fell short, a Redis counter could be added in front as a fast pre-check. (Recommended: simplest, and correct by construction.)

B) A Redis counter decides first, and Postgres records the result afterwards. Faster at extreme load, but two places can disagree after a failure.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — Handling provider webhooks
A) **Inbox, then process:**
   - The webhook endpoint checks the signature.
   - It stores the raw event once in an inbox table, keyed on the provider's event id.
   - It answers 200 straight away.
   - The worker processes inbox rows from the queue: it verifies with the provider, updates the order, and issues tickets.
   - Fast answers mean providers don't retry needlessly. Nothing is lost if processing fails, and replays are harmless. (Recommended)

B) Process inside the webhook request, and answer once done.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4 — Checking Supabase tokens in the API
A) **Supabase's asymmetric JWT signing keys:**
   - Switched on in the Supabase dashboard.
   - The API verifies tokens with the published public keys (JWKS), cached.
   - No shared secret leaves Supabase.
   - (Recommended; Supabase's current approach.)

B) The project's legacy JWT secret, copied into the API's settings (HS256).

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5 — Where the platform staff role is kept
A) **A `platform_staff` table**, added by migration and managed only by SQL, with no UI for now.
   - The API checks it on staff-only routes, with a short cache.
   - Removing someone takes effect within a minute.
   - (Recommended)

B) A claim in the Supabase token (`app_metadata.role = staff`), set through Supabase's admin API. No database lookup, but a removed person keeps access until their token expires (up to 1 hour).

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 6 — How the door scanner reaches the API
A) **Through Next.js, like everything else:**
   - The scanner page calls a Next.js server action, which calls the API.
   - It adds about 20–50 ms, keeping the 1-second target easily.
   - Tokens never reach browser JavaScript.
   - (Recommended)

B) The scanner calls the API directly from the browser for the lowest delay. This needs CORS and exposes the access token to the page.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 7 — Existing database functions during the switch
Today's app calls SQL functions such as `register_guest`, `check_in_guest` and `create_event_with_tiers`. The `main` branch stays deployable until go-live, so those functions must keep working, and the API reimplements the rules in NestJS.

A) **Keep them unchanged until go-live is confirmed:**
   - The API doesn't call them.
   - New migrations only add, so the old app keeps working as a rollback.
   - After go-live is stable, a later migration removes them and the Supabase Data API grants (NFR-6, SECURITY-08).
   - (Recommended)

B) Have the API call the existing functions for registration and check-in, instead of reimplementing them. Less work now, but the rules stay in SQL, against D11, and multi-ticket orders would need the functions rewritten anyway.

X) Other (please describe after [Answer]: tag below)

[Answer]: A
