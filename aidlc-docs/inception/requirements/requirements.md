# Requirements — G-ventZ Backend Split, Payments and Scale (version 2)

Version 2 replaces version 1, which is kept in `requirements-v1-superseded.md`. Version 2 records Change 1 (2026-10-24): stay on Supabase, split the backend, add payments, and plan for 20,000 tickets a day.

**Revision 2.1 (2026-10-24, from the User Stories answers):**
- The December event is free only, so Paystack is off the 2026-11-15 path.
- Money is split on every sale, with fees taken before the host's share. Who pays the fees is chosen per event.
- Hosts are responsible for refunds.
- One purchase can include several tickets, all sent to the buyer.
- Offline check-in is deferred.

Sources: `inception/plans/story-generation-plan.md` (Q5–Q10) and `inception/plans/story-clarification-questions.md` (S1–S6).

**Revision 2.2 (2026-10-24, from the Luma and EventPorte research, U4 FD Q7 A):**

**Added before go-live (U4 and U6):**
- **I1:** a calendar invite (.ics) with the tickets email
- **I2:** guest list search and filters
- **I3:** guest list CSV export
- **I4:** a "declined" status for approval events, with an email
- **I7:** "My tickets" for attendees

**Recorded as backlog for after M5:** early-bird pricing, promoter links, a join link per guest for online events, a feedback email after the event.

**Not adopted for now:** hiding the address until approval (I6) and bulk status updates (I11).

Source: `inception/research/luma-eventporte-notes.md`.

The answers it is built from are in:
- `requirements-verification-questions.md` and `requirement-clarification-questions.md` (version 1, still valid where not replaced)
- `requirements-change-1-questions.md` (Q1–Q15)
- `requirements-change-1-followup-questions.md` (F1–F12 and R2.1–R2.4)

## Intent Analysis

- **User request (Change 1):** "we will keep everything in superbase for now but still split backend and frontend / backend will be built with enterprise standard to handle over 20k people being issued ticket / we will also implement paystack and maybe stripe for other users around the world, googlepay, apple pay as well". The full text and all earlier requests are in `aidlc-docs/audit.md`.
- **Request type:**
  - Architecture change: the backend moves out of Next.js into NestJS, and the database stays on Supabase.
  - New feature: paid tickets with Paystack and Stripe.
  - New feature: Google sign-in.
  - Non-functional: scale, security and resiliency.
- **Scope:** cross-system.
  - The NestJS repository (`gventz-api`) and this Next.js repository.
  - Supabase: database, Auth and Storage.
  - Paystack, Stripe, Resend, and Grafana Cloud with Sentry.
- **Complexity:** complex, because real money is handled and the deadline is fixed.
- **Depth:** comprehensive.

## Deadline

The December event is in **the first week of December 2026** with about **20,000 guests**. Everything it needs must be live in production by **2026-11-15**.

**The December event is free only** (story plan Q10 B). The 2026-11-15 go-live therefore covers the split, Google sign-in, buying several tickets at once, and the 20,000-a-day scale. **Paystack follows after go-live, then Stripe.**

## Decisions

Version 1 decisions still in force keep their numbers. Superseded ones are listed at the end of this section.

### Kept from version 1
| # | Decision |
|---|---|
| D1 | Backend is a separate **NestJS 11** application (Node 22, TypeScript strict), in its own repository `gventz-api`. |
| D2 | Backend hosted on **Render**. |
| D3 | Next.js frontend stays on **Vercel**. |
| D6 | **Object-oriented** design: modules with domain, application, infrastructure and presentation layers; NestJS dependency injection. |
| D7 | Work follows **AI-DLC**. |
| D10 | **Drizzle ORM** for queries. Repositories map rows to domain entities. |
| D11 | Business rules live in **NestJS domain and service classes**. Concurrency-critical writes use transactions with row locks. |
| D14 | **Redis on Render with BullMQ** for jobs, rate limits and short-lived cache. |
| D18 | Web: **Next.js is a backend-for-frontend.** The browser talks to Next.js. Next.js calls the API server to server. |
| D19 | Domain `gventz.com`; API at `api.gventz.com` (DNS still to be confirmed, O3). |
| D20 | A **mobile app is planned.** It calls the API directly. |
| D21 | **REST** with OpenAPI 3 generated from the NestJS code, and typed clients. |
| D22 | **Tag-based caching** in Next.js, revalidated by signed calls from the API. |
| D30 | Property-Based Testing extension **on** (full). |
| U3-FD | Worldwide events (U3 functional design, already approved): any ISO country and region, local date-time plus IANA zone, default zone from venue coordinates, default currency from the venue country (USD for online events). |

### New in Change 1
| # | Decision | Source |
|---|---|---|
| D31 | **Supabase stays** for the database, sign-in and file storage, for now. Moving off Supabase later remains possible. | Q1 A |
| D32 | **Sign-in stays in Supabase Auth** (email one-time code). **Google is turned on as a Supabase Auth provider.** NestJS checks the Supabase access token locally on every request, using the project's signing keys, cached. | Q1 A |
| D33 | **NestJS connects directly to Supabase Postgres** through the Supabase connection pooler over TLS, with Drizzle and a dedicated least-privilege role. **Permissions are enforced in NestJS.** Row-level security stays on as a second layer. | Q2 A |
| D34 | The browser uses Supabase **for sign-in only**. Every data read and write goes through the API. | Q3 A |
| D35 | `gventz-api` is kept:<br>• The U1 platform is reused.<br>• Its own Drizzle migrations are dropped; **`supabase/migrations/` in this repo stays the only place schema changes are made.**<br>• The U2 sign-in code is parked on a branch for a later move off Supabase. | Q4 A |
| D36 | **Dedicated branches** for the split in both repositories: this repository's branch is `feature/backend-split`. | R2.1 note |
| D37 | Capacity target:<br>• **20,000 tickets a day**<br>• up to **10,000 in one hour**<br>• bursts of **50 purchases a second**<br>Proven by a load test before go-live. | Q5, F2 A |
| D38 | **Free and paid ticket types** can be mixed on any event. Free tickets are issued at once. Paid tickets are **held for 10 minutes** while the buyer pays. | Q6, F1 A |
| D39 | **Payment provider chosen by event currency:**<br>• **Paystack** for the currencies it supports for the host's payout account (NGN, GHS, KES, ZAR, and USD where Paystack allows it)<br>• **Stripe** for all others | Q8 A |
| D40 | **Apple Pay and Google Pay** through the providers' own checkout pages. G-ventZ never handles card data (PCI DSS SAQ-A). | Q9 A |
| D41 | **The money is split on every sale.**<br>• The event owner adds a payout account (Paystack subaccount or Stripe Connect Express).<br>• On each sale, the provider's charge and the G-ventZ fee are deducted, and the host's balance is paid through the provider's normal settlement.<br>• G-ventZ never holds the host's money until after the event. | Q10 A; story Q5, S1–S3 |
| D42 | **G-ventZ fee** = a percentage plus a fixed amount per paid ticket. The rate is a setting per currency, and starts at zero until the owner sets it.<br>**Who pays the fees** (the G-ventZ fee plus the provider's charge) is chosen **per event by the host**:<br>• **Host absorbs** (default): the buyer pays the ticket price, and the host receives the price minus both fees.<br>• **Guest pays**: both fees are added on top, and the host receives the full ticket price. | Q11; story Q7, S4 |
| D43 | **Hosts are responsible for refunds.**<br>• The terms of service and checkout state that the organizer, not G-ventZ, is legally responsible for issuing and managing refunds.<br>• Refunds are issued by the host from the dashboard, and cancelling an event refunds every paid ticket automatically.<br>• The refunded amount comes from the host's share. The G-ventZ fee and the provider's charge are not returned by G-ventZ.<br>• No partial refunds for now. | Q12 A; story S5 |
| D56 | **One purchase can include several tickets.**<br>• Up to a limit the host sets per event (1–10, default 10).<br>• Ticket types can be mixed, and it applies to free and paid tickets.<br>• **Every ticket goes to the buyer's verified email**, each with its own QR code, and the buyer shares them.<br>• A buyer can hold at most the event limit in total across their purchases.<br>• On approval events, the whole purchase waits for approval, and payment is taken only after approval. | story Q6, S6 |
| D57 | **Check-in is online only** for now. Offline check-in is deferred. | story Q9 |
| D58 | **The December event is free only.** Paystack is not needed for 2026-11-15. | story Q10 B |
| D44 | **Delivery order:**<br>1. The split, on Supabase, at parity.<br>2. Load test.<br>3. Paystack.<br>4. Stripe. | Q13 A |
| D45 | **Security Baseline** and **Resiliency Baseline** extensions **on**. | Q14 A, Q15 A |
| D46 | **99.9% availability**. Recovery time objective **1 hour**. Recovery point objective **about 2 minutes** (Supabase point-in-time recovery). | Q7 A, F3 E |
| D47 | **Single region, several instances:**<br>• 2 or more API instances and a separate worker on Render.<br>• Supabase in the same region.<br>• **No cross-region disaster recovery.**<br>The production region is to be confirmed (O9). | F3 E, F4 A |
| D48 | **Change management:** every production change is a GitHub pull request with one approval and a rollback note. Production releases are tagged. | F5 B |
| D49 | **CI/CD:** GitHub Actions for checks; Render deploys the API when checks pass; Vercel's GitHub integration deploys the frontend. | F6 A |
| D50 | **Rollback** = redeploy the previous version (Render rollback, Vercel instant rollback). Database changes are made in two steps, adding first and removing in a later release, so rolling back code never needs a database rollback. | F7 A |
| D51 | **Rolling deploys:** traffic moves to a new instance only after its health check passes. | R2.1 B |
| D52 | **Incident response:**<br>• A lightweight process: alerts by email and Slack to the on-call person, a runbook per alert, and a post-incident review with GitHub issues for follow-ups.<br>• The on-call person is to be named (O10). | F9, R2.2 B |
| D53 | **Monitoring:** Grafana Cloud (logs, metrics, traces, alerts, dashboards, through OpenTelemetry) and Sentry (errors). Logs kept at least 90 days. | F10 A |
| D54 | **Two-step sign-in (TOTP, Supabase Auth MFA):**<br>• **Required** for hosts with a payout account when they change payout details or issue refunds.<br>• **Required** for platform staff.<br>• **Optional** for everyone else. | F11 A |
| D55 | **Seat reservation is the next feature after Change 1:** guests check in ahead of time and reserve a seat 30–60 minutes before arrival. It is out of scope now, but tickets and orders must leave room for it. | Q6 note |

### Superseded by Change 1
- **D4** (move to plain PostgreSQL), **D8** (Render Postgres), **D9** (Frankfurt; replaced by D47's "same region as Supabase"), **D12** (no row-level security), **D13** (Cloudinary), **D15–D17** (own authentication in NestJS), **D23–D24** (data migration and one cutover; no data moves now), **D25** (payments out of scope), **D26** (small design load), **D27** (99.5%, 24 hours), **D28** (logs only), and milestones M1–M4 of version 1.

## Target Architecture

```
+-----------+  https  +---------------------+  https  +----------------------+
| Browser   | ------> | Next.js on Vercel   | ------> | NestJS API on Render |
| (web)     |         | gventz.com (BFF)    |         | api.gventz.com       |
+-----------+         +---------------------+         | 2+ web instances     |
     |                                                | + 1 worker           |
     | sign-in only                                   +----------------------+
     v                                                   |    |    |    |
+-------------------+   direct, pooled, TLS             |    |    |    |
| Supabase          | <---------------------------------+    |    |    |
| Postgres, Auth,   |                                        |    |    |
| Storage           |                                        |    |    |
+-------------------+                                        |    |    |
+-------------------+                                        |    |    |
| Redis on Render   | <--------------------------------------+    |    |
| queues, limits    |                                             |    |
+-------------------+                                             |    |
+-------------------+  checkout redirect, webhooks back to API    |    |
| Paystack, Stripe  | <-------------------------------------------+    |
+-------------------+                                                  |
+-------------------+                                                  |
| Resend, Grafana,  | <------------------------------------------------+
| Sentry, Google    |
+-------------------+
```

Text alternative:
- **Browser and Next.js:** the browser signs in with Supabase Auth and otherwise talks only to Next.js on Vercel. Next.js sends the user's Supabase access token to the NestJS API, server to server.
- **Mobile:** the planned app calls the API directly with the same token.
- **API:** runs on Render as two or more web instances plus a background worker. It connects directly to Supabase Postgres through the pooler and uses Supabase Storage for flyers.
- **Redis:** Redis on Render holds the queues and rate limits.
- **Payments:** buyers pay on Paystack's or Stripe's own checkout page. The providers then notify the API by webhook.
- **Other services:** email goes through Resend. Logs, metrics and errors go to Grafana Cloud and Sentry.

## Functional Requirements

Business transactions BT1–BT14 are defined in `reverse-engineering/business-overview.md`. Each requirement keeps today's behaviour unless it says otherwise.

### FR-1 Sign-in and accounts (BT1, D32, D54)
1. **Email code** sign-in and sign-up stays in Supabase Auth.
   - Supabase Auth sends its emails through Resend (custom SMTP), so its built-in hourly email limit doesn't apply.
2. **Google sign-in** is turned on in Supabase Auth.
   - A Google account with the same verified email as an existing user signs in to that same user. Supabase Auth's identity linking handles this, so the user keeps their events and tickets.
3. **Token checks:** every authenticated API request carries the Supabase access token. The API checks its signature, expiry, issuer and audience locally, using Supabase's published signing keys, cached. There is no network call per request.
4. **Web sessions:** Next.js keeps the Supabase session in `httpOnly`, `Secure`, `SameSite=Lax` cookies, as today, and passes the access token to the API from the server.
5. **Mobile** uses Supabase Auth's mobile flows and sends the token to the API.
6. **Two-step sign-in (MFA, TOTP):** enrolment and verification follow D54. The API refuses changes to payout details and refunds unless the token shows a second factor was used (`aal2`).
7. **Bot protection:** Cloudflare Turnstile, which Supabase Auth supports, is on for sign-in code requests.
8. **Return path** after sign-in: same-site paths only, as today.
9. **Existing users need to do nothing.** It's the same Supabase project.

### FR-2 Events (BT2, BT3, BT11, BT12, BT14)
1. Everything in version 1 FR-2 and the approved U3 functional design applies:
   - create with ticket types; edit; venue fixes C1 and C2
   - cancel (owner/admin), publish (owner/admin), delete (owner, typed title)
   - unguessable slugs
   - worldwide countries, regions, zones and currencies
2. **Paid ticket types are now allowed.**
   - An event with a paid ticket type can only be published once the owner has a **verified payout account** for that currency's provider (FR-9).
   - Prices are integer minor units plus an ISO 4217 currency, including currencies with no minor unit or three decimals.
3. All ticket types on an event share one currency.
4. Cancelling an event with paid tickets starts automatic refunds (FR-10).
5. Deleting an event stays refused while paid tickets exist (as today).

### FR-3 Registration questions (BT4)
Unchanged from version 1: kinds, the 30-question limit, options rules, terms always required, and fix C3.

### FR-4 Free tickets (BT5)
1. Today's rules apply:
   - signed-in users only
   - the ticket goes to the account's verified email
   - required answers
   - sales window
   - capacity, then waitlist
   - approval → pending
   - the event's per-buyer limit (D56) replaces "one active registration per user per event"
2. Ticket allocation never exceeds capacity or ticket-type quantity, under bursts of 50 a second on a single ticket type across several API instances.
3. A unique 24-hex-character ticket code per ticket. Existing codes and links keep working.
4. **Several tickets in one registration (D56):**
   - The buyer picks a quantity per ticket type, up to the event's limit.
   - Optional guest names can be added; no guest emails are collected.
   - Every ticket is issued to the buyer and emailed to the buyer's verified email, each with its own QR code.
   - Each ticket is checked in separately.
   - All tickets in a registration succeed or fail together. If the event can't fit them all, the whole request is waitlisted or refused, with no partial fill. The exact rule is settled in Functional Design.

### FR-5 Paid tickets: checkout (D38–D40)
1. **Order.** A buyer starts checkout for a paid ticket type.
   - The API checks the same rules as FR-4.
   - It creates an **order** (status `awaiting_payment`) with a **10-minute hold** that counts against capacity and quantity.
   - The amount follows the event's fee choice (D42): the ticket prices alone, or the prices plus fees. It is in the event's currency, and fixed when the order is created.
2. **Checkout page.** The API creates a payment session with the provider (D39) and returns its URL.
   - Paystack: transaction initialize with a split to the host's subaccount. The G-ventZ fee is the transaction charge, and the provider charge is borne as set by D42.
   - Stripe: Checkout Session with a destination charge to the host's connected account. The G-ventZ fee plus the provider charge is the application fee.
   - Apple Pay and Google Pay appear on those pages wherever the provider supports them.
3. **Confirmation.**
   - An order is paid only when the provider's **webhook** has been **verified**:
     - its signature is valid
     - a server-side check with the provider confirms the payment
     - the amount and currency match the order exactly
   - The buyer's return to the site only shows the status. It never confirms payment.
4. **Issuing tickets.** On confirmation, tickets are issued in one transaction and the hold becomes a sale. The ticket email follows (FR-11).
5. **Idempotency.** Each provider event is processed once, keyed on its id. Repeated or out-of-order webhooks never issue two tickets or change a final state.
6. **Expiry.**
   - A hold that isn't paid within 10 minutes expires, and the tickets go back on sale.
   - A payment that arrives after expiry is accepted if a ticket is still available.
   - Otherwise it is **refunded automatically** and the buyer is told.
7. **Limits.** Rate limits per user and per IP on starting checkout. A buyer can't hold more tickets than the event's per-buyer limit (D56).
8. A provider outage disables paid checkout for that provider with a clear message. **Free tickets keep working** (graceful degradation).

### FR-6 Waiting list (BT9)
1. Unchanged for free tickets. A manager confirms the oldest waitlisted guest.
2. For paid tickets, a waitlisted guest who is offered a place gets a time-limited checkout link. Details are settled in Functional Design.

### FR-7 Tickets and check-in (BT7, BT8)
1. Unchanged from version 1:
   - reading a ticket by code
   - check-in by owner, admin, editor and check-in staff
   - a second check-in refused
2. Only confirmed tickets (free, or paid and confirmed) can be checked in. Refunded tickets show as **refunded** and can't be checked in.
3. **Check-in at the December event's scale:**
   - The target is 20,000 guests over about 2 hours on several staff devices, about 5 scans a second.
   - A scan is answered in under 300 ms p95 at the API.

### FR-8 G-ventZ fee (D42)
1. The fee is a percentage plus a fixed amount per paid ticket, set per currency. It is a platform setting that only platform staff can change, and changes are audited.
2. **Fee choice per event (D42):** host absorbs (default) or guest pays.
   - **Guest pays:** the fees are shown as a separate line before payment.
   - **Host absorbs:** the host's dashboard shows the fees deducted from each sale.
3. **Collecting it:** the G-ventZ fee goes to G-ventZ through the provider split, and the provider's charge is taken by the provider. The host receives the rest on each sale (D41).
4. **When guests pay**, the amount is grossed up so the host receives the full ticket price after the provider's percentage charge.
5. Free tickets carry no fee.

### FR-9 Host payout accounts (D41, D54)
1. **The event owner** connects one payout account on their profile, used for all their paid events. Admins and finance members can't change it. **MFA is required.**
   - **Paystack:** a subaccount created through the API from the host's bank details. Banks are listed and account numbers checked through Paystack.
   - **Stripe:** Stripe Connect Express onboarding, hosted by Stripe.
2. The account's status is kept up to date from provider webhooks: `pending`, `verified` or `restricted`.
3. Changing payout details requires MFA, is audited, and the host is notified by email.
4. Payouts happen **per sale**, on the provider's normal settlement schedule. G-ventZ doesn't hold the host's money (D41).

### FR-10 Refunds (D43)
1. **Host refund.** The owner, an admin or a finance member, with MFA, refunds a paid ticket from the dashboard.
   - **Who pays:** the refund comes from the host's share (D43). The G-ventZ fee and the provider's charge are not returned by G-ventZ.
   - **How it's recovered:** on Stripe, the transfer to the host is reversed. On Paystack, the mechanism for recovering a subaccount's share is confirmed in Functional Design (see risk R-P1).
   - The ticket is voided at once, and the place goes back on sale.
   - Guests can't request refunds in the app. They contact the host. The event's refund policy and the "organizer is responsible for refunds" statement are shown at checkout.
2. **Event cancellation** queues a refund for every paid ticket.
   - Refunds are retried with backoff until they succeed, and failures are reported to the host and on-call.
3. **Final state.** Refund results come back by provider webhook. Each refund ends as `refunded` or `failed`, with its history kept.
4. **Disputes and chargebacks** reported by the provider are recorded on the order and shown to the host. Contesting a dispute is done in the provider's dashboard.

### FR-11 Email (BT6)
1. Ticket emails and order receipts go through Resend from the API's queue.
   - Sending is retried with backoff and never sent twice.
   - A mail failure never undoes a ticket.
2. Refund and payout-account notices go out the same way.
3. Sign-in emails are sent by Supabase Auth through Resend (FR-1.1).
4. The sender domain is `gventz.com` (O5).

### FR-12 Flyers (BT3)
1. Flyers stay in **Supabase Storage** (bucket `event-covers`).
   - The API issues signed upload URLs to event managers.
   - It then confirms the upload and saves it on the event.
2. JPG, PNG or WebP only, 5 MB maximum, checked on confirm.
3. Replacing or removing a flyer, or deleting an event, deletes the old files, with no 100-file limit.
4. Storage stays behind a `FileStorage` interface.

### FR-13 Discovery and public reads (BT13)
Unchanged from version 1 FR-9:
- featured events
- the public event page with its visibility rules
- outside listings in the API, cached in Redis for 1 hour with a 4-second timeout per source

### FR-14 Host dashboard (BT3, BT10, BT14)
1. Version 1 FR-10 applies: my events, the guest list (50 per page), announcement drafts and the dashboard theme.
2. **Sales per event:**
   - tickets sold, gross amount, G-ventZ fees, provider charges, refunds and net
   - per currency
   - figures come from the payment ledger (FR-15)
3. **Orders list** for owner, admin and finance members, with each order's status and its refund action.

### FR-15 Payment ledger and reconciliation
1. Every money movement is an append-only ledger entry, in integer minor units plus currency: charge, fee, refund, dispute.
2. A daily job reconciles the ledger with each provider's records for the day. It alerts on any difference.
3. Changes to orders, refunds, payout accounts and fee settings are audited: who, what, when, before and after (SECURITY-13).

### FR-16 Venue search, cache revalidation, operations
1. **Venue search:** version 1 FR-12 applies, with Places proxied by the API and per-user limits.
2. **Cache revalidation:** version 1 FR-13 applies, through signed revalidation calls.
3. **Health checks:** `GET /health/live`, and `GET /health/ready` (database and Redis), used by Render to route traffic (RESILIENCY-06). Uptime checks from outside (FR-17).
4. **Migrations:** schema changes are new files in `supabase/migrations/`, applied by CI or the Supabase CLI, staging before production, never by hand. The API's Drizzle schema is generated from the database, and CI fails if it doesn't match.

### FR-17 Monitoring and alerting (D53, SECURITY-14, RESILIENCY-05, RESILIENCY-07)
1. **Logs:** structured JSON logs with a request id passed from Next.js to the API and on to the worker. Logs go to Grafana Cloud and are kept 90 days. The application can't delete them.
2. **Metrics:** for each component, latency, error rate, throughput and saturation. This includes:
   - database pool use
   - queue depth and age
   - hold and order counts
   - webhook lag
3. **Traces:** OpenTelemetry traces from Next.js to the API and the worker.
4. **Errors** go to Sentry, from both apps.
5. **Dashboards:** one operational dashboard and one payments dashboard.
6. **Alerts**, routed by email and Slack to on-call (D52):
   - **Errors and latency:** error rate, p95 latency.
   - **Infrastructure:** instance restarts, readiness failing, queue backlog, database connections over 80%.
   - **Payments:** webhook failures, reconciliation differences, refund failures, Supabase backup failures.
   - **Security:** repeated failed sign-ins, permission-denied spikes, MFA failures.

### FR-18 Frontend integration (D3, D18, D34, D36)
1. **Data access:** on `feature/backend-split`, every Supabase data and storage call in the Next.js app is replaced by the generated API client, called from the server. Supabase stays for sign-in only.
2. **Sign-in page:** adds "Continue with Google".
3. **Checkout:** a ticket page for paid tickets, a redirect to the provider, and a return page showing the order status.
4. **Host screens:** payout account, MFA enrolment, orders and refunds, sales.
5. **Security headers** on every page, including a restrictive Content-Security-Policy (SECURITY-04). Provider checkout pages are linked to, not framed, unless the provider requires embedding.
6. **Revalidation:** a route receives revalidation calls.

## Non-Functional Requirements

### NFR-1 Architecture and maintainability
1. **Modules:** one NestJS module per area, each with its own layers:
   - Identity (Supabase token adapter, users)
   - Events
   - Registration (free tickets, check-in, waitlist)
   - Payments (orders, holds, providers, webhooks, refunds, ledger, payout accounts)
   - Engagement
   - Media
   - Discovery
   - Notifications
   - Platform
2. **Payments stays separate:** payment code is isolated in the Payments module (SECURITY-11). Providers sit behind one `PaymentProvider` interface, with Paystack and Stripe adapters. Adding a provider means adding an adapter.
3. **Modules talk through their public interfaces only.** Layer rules are enforced by lint, as in U1.
4. **Configuration** is checked at startup. The app refuses to start with missing settings.

### NFR-2 Performance and capacity (D37)
1. **Load targets:**
   - 20,000 tickets a day
   - 10,000 in the peak hour
   - bursts of 50 ticket purchases or registrations a second
   - 5 check-ins a second
   - about 20 times that in page views, served mostly from the Next.js cache
2. **Response times** at those rates, measured at the API:

   | Request | p95 |
   |---|---|
   | Reads | under 150 ms |
   | Free registration | under 300 ms |
   | Starting checkout (provider call excluded) | under 500 ms |
   | Check-in | under 300 ms |
   | Webhook handling | under 1 s |

3. **No overselling:** ticket allocation and holds never oversell at the burst rate on a single ticket type. This is proven by a concurrency test and the load test.
4. **Load test before go-live:** run at **twice** the burst rate (100 a second) on staging sized like production. It must pass with no oversell, no errors above 0.1%, and the response times above.
5. **Efficient queries:** every list is indexed and paginated, with no N+1 queries. Database connections from all instances together stay within the Supabase plan's pooler limit.

### NFR-3 Scalability (RESILIENCY-09)
1. The API is stateless and scales out.
   - Render autoscaling for web instances: minimum 2, maximum set in Infrastructure Design.
   - The worker scales separately.
2. The scaling limits are written down and monitored, at 80% of each:
   - Supabase compute and pooler connections
   - Supabase Auth rate limits
   - Render instance count
   - Paystack and Stripe API rate limits
   - Resend sending volume
3. Instances are scaled up ahead of the December event's sales opening, as a scheduled pre-scale.

### NFR-4 Availability and recovery (D46, D47, RESILIENCY-01, 02, 08, 11–13)
1. **Targets:** 99.9% monthly availability, recovery time 1 hour, recovery point about 2 minutes.
2. **Workload criticality:**

   | Criticality | Components |
   |---|---|
   | Critical | Sign-in, ticket issuing (free and paid), checkout, payment webhooks, check-in |
   | High | Event management, refunds, email delivery, host dashboard |
   | Medium | Discovery, flyers, venue search |
   | Low | Announcement drafts |

   The business impact of each is written down in design.
3. **Regions and instances:** single region, with 2 or more web instances. The fact that zones can't be chosen on Render or Supabase is recorded as an accepted limit.
4. **Disaster recovery:** backup and restore within the region.
   - Supabase daily backups plus point-in-time recovery, encryption at rest, and retention set in design.
   - A test restore every quarter.
   - Runbooks for restore, rollback and failover of instances, with a communication plan.
5. **Rolling, zero-downtime deploys** with health checks (D51).

### NFR-5 Resilience patterns (RESILIENCY-10)
1. **Timeouts:** every outside call has an explicit timeout. This covers Supabase, Redis, Paystack, Stripe, Resend, Google and the event feeds.
2. **Circuit breakers** for:
   - payment providers
   - Resend
   - outside event feeds
3. **Separate connection pools** for:
   - web requests
   - the worker
   - long-running reports, kept away from ticket allocation
4. **Degraded behaviour is defined for each failure:**

   | Failure | Behaviour |
   |---|---|
   | Redis down | Rate limits follow their per-policy rule; queues are paused and buffered |
   | Provider down | Paid checkout is off for that provider (FR-5.8) |
   | Resend down | Emails are queued |
   | Event feeds down | Discover shows G-ventZ events only |

5. **Retries:** with backoff and jitter, only for operations that are safe to repeat. Payment calls use the providers' idempotency keys.

### NFR-6 Security (Security Baseline on, D45)
| Rule | Requirement |
|---|---|
| SECURITY-01 | Supabase Postgres and Storage are encrypted at rest (Supabase managed). Every connection uses TLS with certificate verification. Redis connections stay on Render's private network, and TLS is required wherever Render offers it (design must confirm). |
| SECURITY-02 | Access logs from Render and Vercel go to Grafana Cloud. |
| SECURITY-03 | Structured logs with timestamp, request id, level and message. No tokens, codes, card data or full email addresses. |
| SECURITY-04 | Security headers on every Next.js page (FR-18.5). The API sends `nosniff`, `no-store` and HSTS. |
| SECURITY-05 | Every API input is validated (types, lengths, formats). Request body size limits. Queries are parameterized only. Webhook payloads are checked against a schema after the signature check. |
| SECURITY-06 | The API database role can reach only the tables it uses, and it isn't the Supabase `service_role`. Provider API keys are restricted where the provider allows it (Stripe restricted keys). |
| SECURITY-07 | Render private networking between the API, worker and Redis. Supabase network restrictions limit database access to the API's outbound addresses where the plan allows it. |
| SECURITY-08 | **Deny by default:** every route needs a valid token unless marked public. Event-level permission checks return 404 for events the caller can't see, and each order and ticket is checked against its owner. CORS allows only the frontend origins. After the frontend switch, the browser's direct data access through the Supabase Data API is removed: table access for `anon` and `authenticated` is revoked, with row-level security left on. |
| SECURITY-09 | No default credentials. Swagger docs are off in production. Generic error responses. The storage bucket is private apart from published flyers. Runtimes are current. |
| SECURITY-10 | Committed lock files. Dependabot and `npm audit` in CI. A CycloneDX SBOM per release. Docker images pinned by digest. |
| SECURITY-11 | Payments isolated (NFR-1.2). Rate limits on every public endpoint. Misuse cases designed for: bulk buying by bots, hold flooding, webhook replay, refund abuse, and checking ticket codes by guessing. |
| SECURITY-12 | Supabase Auth with codes and Google, so there are no passwords to store. Brute-force limits on code checks (Supabase plus Turnstile). MFA per D54. Sessions expire on the server and are revoked on sign-out. Secrets live only in Render and Vercel settings. |
| SECURITY-13 | Webhook signatures verified (Paystack HMAC-SHA512, Stripe signature with timestamp tolerance). An audit trail for money and permission changes (FR-15.3). CI workflow changes need review. |
| SECURITY-14 | Security alerts (FR-17.6). Logs kept 90 days, in storage the app can't change. |
| SECURITY-15 | A global error handler. Fail closed on authorization and payment checks. Transactions roll back on error. No unhandled promise rejections. |

**PCI DSS:** SAQ-A scope only. No card data reaches G-ventZ systems.

### NFR-7 Testing (version 1 D29 plus Change 1)
1. **Kept from version 1:**
   - unit tests
   - integration tests against real Postgres (with the Supabase schema applied) and Redis
   - API end-to-end tests
   - 80% line coverage
   - property-based testing per the PBT rules
2. **Payments:**
   - provider sandbox end-to-end tests (Paystack test mode, Stripe test mode)
   - webhook signature, replay and out-of-order tests
   - hold expiry and late-payment tests
   - refund tests
   - ledger property tests: every order's entries sum correctly
3. **Concurrency:** no oversell on a single ticket type with parallel requests across instances.
4. **Load test (NFR-2.4)** before go-live.
5. **Recovery:** a restore drill on staging before go-live (RESILIENCY-13/14). Scenarios are written now and rehearsed in Operations.

### NFR-8 Compatibility
1. Ticket codes, ticket URLs, slugs and user ids are unchanged. It's the same database.
2. Money is integer minor units plus an ISO 4217 currency, and is never a float.
3. Database triggers that read `auth.uid()` (for example `events_guard`) do nothing for API connections. **The API enforces those rules itself** (as in the U3 design), and tests prove it.

## Milestones (proposed; replace version 1 M1–M4)

| # | Milestone | Target | Done when |
|---|---|---|---|
| M1 | Split core flows on staging | 2026-11-01 | API on Render (staging) against Supabase staging. Supabase token checks, Google sign-in on, create event, free registration, ticket, check-in all work through the API. The frontend branch uses the API for these. |
| M2 | Parity, several tickets per purchase, load test | 2026-11-08 | Every non-payment requirement is met on staging, including buying several free tickets at once (D56), with no Supabase data calls left in the frontend. Monitoring and alerts are live. The load test passes (NFR-2.4). |
| M3 | Production go-live (no payments) | 2026-11-15 | Test gates pass and the restore drill is done. The production split is live and ready for the December event (free, 20,000 guests). |
| M4 | Paystack | 2026-11-29 (proposed) | Paystack checkout, webhooks, refunds, payout accounts, the fee choice and the ledger pass sandbox tests, then go live. |
| M5 | Stripe | 2026-12-18 (proposed) | Stripe Connect, Checkout and webhooks are live for non-Paystack currencies. |
| Later | Seat reservation (D55); offline check-in (D57); frontend design upgrade (O1); moving off Supabase (U2 branch) | After M5 | Separate AI-DLC passes. |

## Out of Scope (Change 1)
- partial refunds
- taxes and VAT invoices (O13)
- team invitation UI
- sending announcements
- the approve/decline screen
- a virtual waiting room (not needed at D37 rates; the design leaves room)
- offline check-in (deferred, D57)
- multi-region disaster recovery
- seat reservation (next)

## Assumptions
| # | Assumption |
|---|---|
| A1 | ~~The December event may sell paid tickets.~~ Resolved: free only (D58). |
| A2 | Supabase is on the **Pro plan or higher**, with the point-in-time recovery add-on and a compute size chosen for D37. Render uses a paid workspace with autoscaling. |
| A3 | ~~The December event's currency is NGN through Paystack.~~ No longer relevant (free event). |

## Open Items

| # | Item | Needed by |
|---|---|---|
| O1 | Frontend design upgrade: scope and timing (proposed after M4). | Workflow Planning |
| O3 | DNS for `api.gventz.com`. | M3 |
| O5 | Resend: verify `gventz.com`, use it as Supabase Auth's SMTP, and pick a plan for up to 20,000+ emails a day. | M1 (sign-in emails), M3 (volume) |
| O7 | Render paid workspace with autoscaling; Redis plan. | M1 |
| O9 | **Supabase production region** (R2.3: owner to check). The API region follows it. | Infrastructure Design |
| O10 | **On-call person and Slack channel** for alerts (D52). | M2 |
| O11 | Resolved: D42 (fees chosen per event, host absorbs by default) and D43 (refunds come from the host's share). | — |
| O12 | Resolved: D56 (several tickets per purchase, all sent to the buyer). | — |
| O13 | Taxes and VAT on fees and tickets in each country. | Before M4 |
| O14 | Deferred (D57). Venue connectivity for the December event should be checked; staff need mobile data or Wi-Fi. | M3 |
| O15 | Paystack business account (live keys, split payments enabled) and Stripe account with Connect (Express) enabled. | M4 / M5 |
| O20 | **Email throughput for the December peak:** ask Resend to raise the limit to 50/s, and/or set up ZeptoMail (account, domain, Zoho confirming about 20,000 emails an hour). Both are supported by a setting (U4 NFR Q1a C). | 8 November |
| O18 | **Terms of service and checkout wording** stating that the organizer is legally responsible for refunds (D43). Legal review recommended. | M4 |
| O16 | Grafana Cloud and Sentry accounts. | M2 |
| O17 | Supabase Auth: Google provider client id and secret (Google Cloud OAuth client, replaces version 1's O4), MFA (TOTP) on, Turnstile keys. | M1 |

## Risks (payments)
- **R-P1 Refunds after the host is paid (Paystack).** With a split per sale, the host's share has already been settled when a refund happens. Stripe can reverse the transfer, but Paystack may take refunds out of the G-ventZ main balance. Functional Design must confirm how Paystack recovers this (for example deducting from the subaccount's next settlements, or a refund reserve). Until then, a refund could temporarily cost G-ventZ.
- **R-P2 Tickets shared by the buyer.** All tickets go to the buyer's email and are forwarded. Anyone holding a forwarded QR code can use it once, so a leaked code means a lost entry. Codes stay unguessable, and a second check-in is refused.

## Impact on Work Already Done

**U1 Platform** (gventz-api) is reused:
- **Kept:** configuration, logging, problem details, transactions and unit of work, events bus, Redis, rate limits, queues, health checks, OpenAPI, CI and the Render blueprint.
- **Changed:**
  - The database connection points at the Supabase pooler.
  - Drizzle migrations are removed, and the schema is generated from Supabase.
  - The Render blueprint loses Render Postgres.
  - The region follows O9.
  - Deploys become rolling with autoscaling.
  - OpenTelemetry is added.

**U2 Identity** (own sign-in) moves to a branch. It is replaced by a small Supabase token adapter:
- The guard and current user keep the same shape, so other modules are unaffected.

**U3 Events and Engagement:** the functional design stays valid, with these changes:
- Paid ticket types are allowed once a payout account exists.
- Cancelling starts refunds.
- Engagement is unchanged.

**New units:**
- Payments: orders, holds, providers, webhooks, refunds, ledger, payout accounts and the fee.
- The frontend switch on `feature/backend-split`.
- Monitoring.

Units are re-planned in Workflow Planning and Units Generation.

## Traceability

| Requirement | Business transaction | Decision / answer |
|---|---|---|
| FR-1 | BT1 | D32, D54, Q1, F11 |
| FR-2, FR-3 | BT2–BT4, BT11, BT12, BT14 | U3-FD, D38 |
| FR-4, FR-6, FR-7 | BT5, BT7–BT9 | D37, D38 |
| FR-5, FR-8–FR-10, FR-15 | new (paid tickets) | D38–D43, Q6–Q12, F1 |
| FR-11 | BT6 | D14 |
| FR-12 | BT3 | D31 |
| FR-13, FR-16 | BT13 | D22 |
| FR-14 | BT3, BT10, BT14 | D41 |
| FR-17 | — | D52, D53, F9, F10 |
| FR-18 | all | D3, D18, D34, D36 |
| NFR-2, NFR-3 | — | D37, Q5, F2 |
| NFR-4, NFR-5 | — | D46–D51, F3–F8 |
| NFR-6 | — | D45, Q14 |


## Change Note 2026-10-25 — Outside listings removed
Requested by the product owner during U5 code generation: "no ticketmaster or external ticketing integration, we do not need that". The Discover page lists G-ventZ events only. Ticketmaster, PredictHQ and iCal feeds are out of scope (the current app's `src/lib/external.ts` and `ElsewhereEvents` go in U6b). Places venue search stays.
