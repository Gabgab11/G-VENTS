# Unit of Work Plan — Change 1

The version 1 plan is `unit-of-work-plan.md`, and the version 1 unit documents are in `application-design/v1/`.

**Still valid from version 1:**
- **Q3 A:** you and I build it, one unit at a time.
- **Q4 A:** the frontend switches over in two parts.
- **Q5 A:** the frontend design upgrade is a separate pass.

**No longer relevant:**
- **Q2:** the version 1 M1 split. It is replaced by Q5 below.
- **Q6:** the data migration is gone.

Put your choice after each `[Answer]:` tag, and save the file before replying.

## Plan

- [x] 1. Collect and analyze answers; ask follow-ups if needed
- [x] 2. Generate `application-design/unit-of-work.md`:
  - [x] each unit's responsibilities, modules and repositories
  - [x] the design stages each unit runs
  - [x] its milestone
  - [x] what it reuses or changes from existing code
  - [x] code organization (both repositories)
- [x] 3. Generate `application-design/unit-of-work-dependency.md`: dependency matrix, critical path, order, and the parallel work that is possible
- [x] 4. Generate `application-design/unit-of-work-story-map.md`: every one of the 45 stories assigned to a unit (with the split for stories that span milestones)
- [x] 5. Validate:
  - [x] boundaries match the application design modules
  - [x] no story is unassigned
  - [x] the M3 "Must" stories are all in units finished by M3

## Proposed Units (from the approved execution plan)

| # | Unit | Repository | Milestone |
|---|---|---|---|
| U1 | Platform (rework of existing code): Supabase pools, schema generated from Supabase, outbox, telemetry, resilience, autoscaling, rolling deploys | gventz-api | M1 |
| U2 | Identity (replaced): Supabase token check, MFA guard, staff guard, profile | gventz-api | M1 |
| U3 | Events and Engagement: approved design, plus per-buyer limit, fee choice, payout gate | gventz-api | M1 / M2 |
| U4 | Ticketing: orders for several tickets, inventory, approval, waitlist, check-in, order emails | both (migration in G-VENTS) | M1 / M2 |
| U5 | Media, Discovery, Revalidation | gventz-api | M2 |
| U6 | Frontend switch (two parts, see Q2) | G-VENTS | M1 / M2 |
| U7 | Payments: Paystack | both | M4 |
| U8 | Payments: Stripe | both | M5 |

## Questions

### Question 1 — The units
A) Use the eight units above. (Recommended)

B) Merge U5 into U3. One fewer unit, but U3 gets large.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — Splitting the frontend switch
A) **Two parts**, as in version 1:
   - **U6a (M1):**
     - "Continue with Google" on the sign-in page
     - the server-side API client that passes the Supabase token
     - the M1 flows on the API: create and publish an event, event page, getting several tickets, ticket page, check-in scanner
   - **U6b (M2):** every remaining Supabase data call replaced, the guest list, settings, questions, flyer, Discover, security headers and CSP.
   - (Recommended: staging can be tried in a browser from M1.)

B) **Frontend work inside each backend unit:** for example, U4 includes the ticket and scanner screens. Every unit ends with something usable, but each unit spans both repositories.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — Where database changes are made
A) **Each unit adds its own migration files** in `G-VENTS/supabase/migrations/`, for example U4 adds orders and ticket links. They are applied to staging when that unit's code is ready, and to production at go-live. Additive only (AD17). (Recommended)

B) One up-front migration unit with every M3 schema change, before any code.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4 — Order inside M1
U4 needs events to exist, and U3's design is already approved.

A) **In this order:**
   1. U1 rework
   2. U2
   3. **U3 pass 1:** create, publish and the public page, already designed
   4. **U4 core:** free orders with several tickets, ticket page, check-in scan
   5. U6a
   6. M2 work: U3 pass 2, U4 rest, U5, U6b
   (Recommended)

B) U4 first, with events created by hand on staging, then U3.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5 — Payments units
A) **Two units:** U7 Paystack, covering the whole Payments module (orders with holds, fees, payout accounts, refunds, ledger, reconciliation, staff screens) and its frontend screens. Then U8 Stripe adds a second provider adapter and Connect. (Recommended: U8 is small because U7 builds everything behind the provider interface.)

B) One Payments unit covering both providers.

X) Other (please describe after [Answer]: tag below)

[Answer]: A
