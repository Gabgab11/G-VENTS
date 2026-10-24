# Requirements Change 1 — Stay on Supabase, Add Payments, Plan for 20,000 Tickets

You changed direction on 2026-10-24:

1. Keep everything in Supabase for now, but still split the backend (NestJS) from the frontend (Next.js).
2. Build the backend to an enterprise standard, able to handle **more than 20,000 people being issued tickets**.
3. Add payments: **Paystack**, possibly **Stripe** for users elsewhere in the world, plus **Google Pay** and **Apple Pay**.

These answers replace decisions D4, D8, D12, D13, D15, D25, D26 and D27 in `requirements.md`. U3 code generation is paused until the requirements and plan are updated.

**Unchanged unless you say otherwise:**
- NestJS on Render, Next.js on Vercel.
- TypeScript object-oriented design and the AI-DLC workflow.
- Worldwide events: any country, time zone and currency.
- REST with OpenAPI, and the mobile app is still planned.

Put your choice after each `[Answer]:` tag, and save the file before replying.

---

## Part A — Staying on Supabase

## Question 1 — What "keep everything in Supabase" covers
Today Supabase provides the database, sign-in (email code) and flyer storage.

A) All three stay in Supabase:
   - Sign-in stays in Supabase Auth, and Google sign-in is turned on as a Supabase Auth provider.
   - NestJS checks the Supabase access token on each request locally, with no network call.
   - **Effect:** the sign-in code we built in U2 is parked for a later move off Supabase. (Recommended: fastest, and Google sign-in becomes mostly configuration.)

B) Database and storage stay in Supabase, but sign-in moves to NestJS:
   - Uses the U2 code already built, with Google and email codes issued by our own backend.
   - Existing users must sign in again once.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2 — How the backend reaches the database
A) NestJS connects straight to Supabase Postgres:
   - It uses the Supabase connection pooler with Drizzle and a dedicated least-privilege role.
   - Permission checks live in NestJS services and guards, reusing the U1 platform already built.
   - Row-level security stays switched on, so anything that still uses the Supabase client directly is still protected. (Recommended: the fastest path at high volume, with full transaction control for ticket allocation.)

B) NestJS calls Supabase through `supabase-js`, using each user's token so row-level security applies to every query:
   - Simpler to keep in line with today's database.
   - Slower, and it gives less control over locking under heavy load.

C) Direct connection as in A, but registration, check-in and event creation keep calling today's database functions (`register_guest`, `check_in_guest`, `create_event_with_tiers`).

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 3 — Does the frontend still talk to Supabase directly?
A) Only for sign-in (the Supabase Auth session in the browser and cookies). All data reads and writes go through the NestJS API. (Recommended)

B) Sign-in plus public reads (event pages, Discover) straight from Supabase. Writes go through the API.

C) No direct calls at all. The API handles sign-in too (pairs with Question 1 B).

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4 — What happens to the backend code already built
Already built in `/Users/payazaafrica/gventz-api` (not committed):
- **U1 platform:** configuration, logging, errors, transactions, Redis, queues, rate limits, health checks, the Render blueprint and CI.
- **U2 identity:** own sign-in with email codes, Google and sessions.

A) Keep the repository and reuse U1, pointed at Supabase Postgres:
   - Our own migration files (Drizzle) are dropped. `supabase/migrations/` in this repo stays the single source of schema changes.
   - U2 is kept on a separate branch for a later move off Supabase. (Recommended)

B) Keep U1 and U2 both active (pairs with Question 1 B).

C) Start the backend again from scratch.

X) Other (please describe after [Answer]: tag below)

[Answer]: A - IT SHOULD BE KEPT IN A BRANCH BUT WE NEED TO GO LIVE SOON BECAUSE OF THE EVENT IN DECEMBER. WE WILL CIRCLE BACK TO IT LATER

---

## Part B — Scale: "over 20,000 people issued tickets"

## Question 5 — What the 20,000 means
How fast the tickets go matters more than the total. 20,000 tickets over a month is light load. 20,000 people in the first minute of sales needs a queue in front of checkout.

A) One big event: 20,000 tickets, most taken within about **10 minutes** of sales opening (about 35 purchases a second at peak).

B) One big event: 20,000 tickets over about **an hour** at peak.

C) **A flash sale:** up to 20,000 people arriving within the **first minute**, so a virtual waiting room is needed.

D) 20,000 tickets in total across all events over weeks. No single spike.

X) Other (please give the expected peak, for example "N people within M minutes", after [Answer]: tag below)

[Answer]: X - IT IS 20K IN A DAY NOT A MONTH, IT SHOULD BE ABLE TO HANDLE THAT

## Question 6 — Holding a ticket while the buyer pays
A) When checkout starts, hold the chosen tickets for **10 minutes**:
   - Held tickets count against capacity.
   - If payment isn't confirmed in time, the hold expires and the tickets go back on sale.
   - Free tickets are issued at once, with no hold. (Recommended: prevents overselling under heavy load.)

B) No hold. Allocate only when the payment succeeds, and refund automatically if the event sold out in the meantime.

X) Other (please describe after [Answer]: tag below)

[Answer]: X - ORGANIZERS CAN ADD EVENTS THAT ARE FREE AND CAN ADD PAID ONES SO IT SHOULD BE DYNAMIC. WE INTEND TO ALSO IMPLEMENT SEAT RESERVATION AFTER THIS, SO THAT PEOPLE CAN CHECK IN AHEAD OF TIME AND RESERVE SEATS AT THE EVENT AN HOUR OR 3OMINS BEFORE THEY ARRIVE

## Question 7 — Availability and data loss (replaces D27: 99.5%, 24 hours)
A) **99.9%** availability, with point-in-time recovery so no more than **a few minutes** of data are lost. This needs the Supabase Pro plan or higher and paid Render instances. (Recommended once real money is taken.)

B) Keep 99.5% and 24 hours.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Part C — Payments

## Question 8 — Which provider takes each payment
A) **By event currency:**
   - **Paystack** for currencies it supports (NGN, GHS, KES, ZAR and USD for Paystack-supported hosts).
   - **Stripe** for every other currency.
   - The host picks the currency, and the API picks the provider. (Recommended)

B) Paystack only for now. Stripe comes later.

C) The buyer chooses the provider at checkout.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 9 — Google Pay and Apple Pay
A) Through the providers' own checkout:
   - **Stripe:** Payment Element / Checkout shows Apple Pay and Google Pay automatically.
   - **Paystack:** its checkout shows Apple Pay where Paystack supports it.
   - No separate wallet integration, so we hold no card data and stay PCI SAQ-A. (Recommended)

B) Direct Apple Pay and Google Pay integrations (much more work and compliance).

X) Other (please describe after [Answer]: tag below)

[Answer]: A 

## Question 10 — Where the money goes
A) **Marketplace:** each host connects their own payout account (Paystack subaccount or Stripe Connect Express). Each sale is split automatically: the host's share goes to them, and the G-ventZ fee to G-ventZ. (Recommended)

B) All money goes to the G-ventZ account, and G-ventZ pays hosts out separately (manually or on a schedule). Simpler to build, but G-ventZ holds other people's money, which can have licensing implications.

C) Only G-ventZ's own events take payments for now.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 11 — G-ventZ fee
A) Percentage plus a fixed amount per paid ticket, **added on top for the buyer**. Free tickets have no fee.

B) The same fee, **taken from the host's share** (the buyer sees the ticket price only).

C) The host chooses A or B per event.

D) No fee for now. The rate is a setting that can be turned on later.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

Fee rate if known (for example "5% + 100 kobo"): 

## Question 12 — Refunds
A) The host refunds a paid ticket in full from the dashboard, through the API and provider. Cancelling an event refunds every paid ticket automatically. No partial refunds for now. (Recommended)

B) Full and partial refunds from the dashboard. Cancelling an event offers automatic refunds.

C) Refunds are done by hand in the Paystack and Stripe dashboards for now. The API records them through webhooks.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Part D — Priority, plan and extensions

## Question 13 — Order of delivery
The earlier milestones were M1 core flows (2026-10-24), M2 parity, M3 cutover by 2026-11-15 and M4 frontend design mid-November.

A) **Split first, then payments:**
   1. NestJS on Supabase at parity, and the frontend switched to it.
   2. Load-tested for the Question 5 peak.
   3. Paystack.
   4. Stripe.
   Keep 2026-11-15 as the target for the first three. (Recommended)

B) **Payments first:** Paystack checkout on the current system, with the backend split afterwards.

C) Everything together by 2026-11-15.

X) Other (please describe, including the December event date and whether it is paid, after [Answer]: tag below)

[Answer]: A

## Question 14 — Security extension (currently off)
The project now takes real money and stores payout details, so the Security Baseline rules are a better fit than before. They are enforced at every stage and block completion if not met.

A) Turn Security Baseline **on** from now. (Recommended now that payments are in scope.)

B) Keep it off. Payment security is covered by the payment requirements only.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 15 — Resiliency extension (currently off)
A) Turn Resiliency Baseline **on**. It covers timeouts, retries, circuit breakers, graceful degradation and load testing, which suits the 20,000-ticket goal and payment webhooks. (Recommended)

B) Keep it off.

X) Other (please describe after [Answer]: tag below)

[Answer]: A
