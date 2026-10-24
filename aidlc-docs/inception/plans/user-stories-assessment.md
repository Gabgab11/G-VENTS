# User Stories Assessment

## Request Analysis
- **Original request:** Change 1 (2026-10-24):
  - stay on Supabase and split the backend
  - plan for 20,000 tickets a day
  - add Paystack and Stripe payments, with Apple Pay and Google Pay
  - Google sign-in, carried over from version 1
- **User impact:** direct. New checkout, payout, refund, sales and two-step sign-in journeys. Existing journeys (create, register, check in) move to the API and must behave the same.
- **Complexity:** complex. Real money is involved, along with several personas and many edge cases: holds, late payments, refunds, disputes.
- **Stakeholders:**
  - the product owner
  - hosts (event organizers)
  - guests and buyers
  - door staff
  - host finance members
  - G-ventZ platform staff

## Assessment Criteria Met
- [x] **High priority:**
  - new user features (checkout, payout accounts, refunds, sales, MFA, Google sign-in)
  - multi-persona system
  - complex business logic (holds, expiry, late payment, refunds, fee)
  - customer-facing API (web and the planned mobile app)
- [x] **Medium priority:**
  - existing workflows move to a new backend and need acceptance criteria to prove parity
  - security changes affect sign-in (MFA)
- [x] **Benefits:**
  - acceptance criteria that can be tested for every payment scenario
  - a shared picture of buyer and host journeys before the 2026-11-15 deadline
  - user acceptance testing material for the December event

## Decision
**Execute User Stories:** Yes.

**Reasoning:** In version 1, User Stories were skipped because the work was a parity move. Change 1 adds new money-handling journeys for several personas, which are high-priority indicators that always call for execution. Parity flows are covered briefly, by acceptance criteria that point to the existing behaviour (BT1–BT14).

## Expected Outcomes
- Personas for buyer, host, team members, door staff and platform staff.
- Stories with Given/When/Then acceptance criteria covering success, failure and edge cases (for example a payment arriving after the hold expired, or a refund failing).
- A story map that later units and tests trace to.
