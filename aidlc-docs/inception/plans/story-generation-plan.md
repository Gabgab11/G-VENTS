# Story Generation Plan — Change 1

**Inputs:**
- `inception/requirements/requirements.md` (version 2)
- `reverse-engineering/business-overview.md` (BT1–BT14)
- the U3 functional design

**Outputs:**
- `inception/user-stories/personas.md`
- `inception/user-stories/stories.md`

## Part 1 — Questions

Put your choice after each `[Answer]:` tag, and save the file before replying.

## Question 1 — Which journeys get full stories
A) **New and changed journeys get full stories:**
   - Covered: Google sign-in, MFA, paid checkout, holds, payout accounts, refunds, cancellation refunds, sales and orders, the fee, check-in at scale.
   - Unchanged parity journeys get one short "works as today through the API" story each, pointing to BT1–BT14. (Recommended: keeps the stories focused on what is new before 2026-11-15.)

B) Full stories for every journey, new and existing.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2 — How stories are organized
- **User journey:** stories follow each flow, such as buy a ticket or run the door.
- **Feature:** stories grouped by system capability.
- **Persona:** stories grouped by user type.
- **Domain:** stories grouped by module (Events, Payments, …).
- **Epic:** stories grouped under larger themes, with smaller stories underneath.

A) **Epic and journey hybrid:**
   - Epics follow the requirements: Sign-in, Events, Free tickets, Paid checkout, Payouts, Refunds, Host sales, Door check-in, Operations.
   - Inside each epic, stories follow the user's journey in order.
   - Epics map to requirements and later to units, and journeys keep each story about what a person does. (Recommended)

B) Persona-based, for example "As a buyer" stories, then "As a host" stories.

C) Feature-based.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 3 — Story and acceptance-criteria format
A) **Story format:**
   - "As a [persona], I want [goal], so that [reason]."
   - Acceptance criteria in **Given / When / Then**, with at least one failure or edge case per story.
   - Each story carries its requirement ids, a priority (Must for 2026-11-15, Should, Could) and a size (S/M/L). (Recommended)

B) The same, but with acceptance criteria as plain bullet points.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4 — Personas
Proposed:
1. **Buyer / guest:** finds an event, signs in, gets a free ticket or pays for one, shows the ticket at the door.
2. **Host (event owner):** creates and runs events, connects a payout account, sees sales, issues refunds.
3. **Host team member**, one per role:
   - **admin:** almost everything the owner can do
   - **editor:** edits the event
   - **finance:** sees orders and sales, and issues refunds
   - **viewer:** read-only
4. **Door staff (check-in role):** scans tickets quickly at the entrance.
5. **G-ventZ platform staff:** sets the fee rate, watches payments and reconciliation, handles disputes and support.
6. **On-call engineer:** receives alerts and follows runbooks. Used only for Operations stories.

A) Use these six. (Recommended)

B) Use these, without the on-call engineer. Operations requirements stay as non-functional requirements only.

X) Other (please add or remove after [Answer]: tag below)

[Answer]: A

## Question 5 — Who connects the payout account and gets the money (requirements FR-9)
A) **Only the event owner** connects a payout account, on their own profile. All of their paid events pay out to it. Admins and finance members can't change it. (Recommended: simplest and safest)

B) The owner or an admin can connect an account per event, so different events can pay out to different accounts.

X) Other (please describe after [Answer]: tag below)

[Answer]: A - WE THE PLATFORM SETS IT UP, ORGANIZERS ADDS THEIR ACCOUNTS WHERE WE REMIT TO, WE CAN SWITCH IT TO AFTER THE TICKETS ARE SOLD OUT, WE REMIT TO THE ACCOUNT THEY PROVIDED AFTER TAKING OUR PERCENTAGE AND PAYING PAYSTACK/STRIPE

## Question 6 — More than one ticket per purchase (open item O12)
For a 20,000-guest event, people often buy for friends.

A) **One ticket per account per event**, as today. Each guest signs in and buys their own. Simplest, and every ticket is tied to a verified email.

B) **Several tickets per order** (up to a limit the host sets, default 10):
   - The buyer enters each guest's name.
   - All tickets go to the buyer's email, and the buyer forwards them.
   - Each ticket has its own code and is checked in separately.

C) Like B, but each extra ticket is sent to the guest's own email and claimed by signing in.
   - **Conflict:** today's rule says tickets go to the verified account email only.
   - **Effect:** that rule changes for the buyer only. Each guest still receives their ticket at their own verified email.

X) Other (please describe after [Answer]: tag below)

[Answer]: C - ONE PERSON CAN PURCHASE FOR MULTIPLE PEOPLE BUT WILL NEED TO PROVIDE THEIR EMAILS

## Question 7 — Fees on refunds and provider charges (open item O11)
Two choices are bundled here: who pays Paystack's and Stripe's own processing charges, and what the buyer gets back on a refund.

A) **Provider charges come out of the G-ventZ fee.** The host receives the full ticket price. On a refund or cancellation, the buyer gets everything back, including the fee, and G-ventZ absorbs the provider charge.

B) **Provider charges come out of the host's share.** The buyer gets everything back on refund.

C) **Provider charges come out of the G-ventZ fee.** On a host-initiated refund the buyer gets the ticket price back, but **not** the G-ventZ fee. On an event cancellation they get everything back.

X) Other (please describe after [Answer]: tag below)

[Answer]: X - PROVIDERS CHARGES COMES FROM THE WHOLE FEE BEFORE REMITTING TO THE ORGANIZERS AND TAKING OUR FEE PERCENTAGE

## Question 8 — Guests asking for refunds
A) Guests can't request refunds in the app. They contact the host, and the host refunds from the dashboard. The event's refund policy text is shown at checkout. (Recommended for 2026-11-15)

B) Guests can press "Request refund" on their ticket. The host approves or declines from the dashboard.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 9 — Check-in at the door for 20,000 guests (open item O14)
A) **Online check-in only**, with fast scanning:
   - The camera scans the QR code and shows the result in under a second.
   - It warns clearly about duplicates and refunded tickets.
   - Several devices can scan at once.
   - Venue Wi-Fi or mobile data is required.

B) As A, plus an **offline fallback**:
   - Staff download the guest list before doors open.
   - Scans are checked on the device and synced when back online.
   - Duplicates across devices are resolved on sync.
   - Larger, and it would need to fit before 2026-11-15.

X) Other (please describe after [Answer]: tag below)

[Answer]: X - WE CAN HOLD OFF ON THIS FOR NOW

## Question 10 — Will the December event sell paid tickets? (assumption A1)
A) Yes. Paystack must be live by 2026-11-15.

B) No, free only. Paystack can go live after the event.

C) Not decided yet. Keep Paystack on the 2026-11-15 path to be safe.

[Answer]: B

---

## Decisions Taken from the Answers (with `story-clarification-questions.md`)

**Story approach:**
- **Coverage:** full stories for new and changed journeys; one short parity story each for unchanged ones (Q1 A).
- **Organization:** epics, with stories in journey order inside each (Q2 A).
- **Format:** "As a … I want … so that …", Given/When/Then acceptance criteria, requirement ids, priority and size (Q3 A).
- **Personas:** buyer, host, team member roles, door staff, platform staff and on-call engineer (Q4 A).

**Money:**
- **Payout account:** the event owner has one payout account (Q5 A).
- **Payouts per sale:** fees are deducted on each sale, and the host's balance is settled per sale (S1–S3, D41).
- **Who pays the fees:** chosen per event. The host absorbs them by default, or the guest pays them on top (S4, D42). The fee rate is a setting.
- **Refunds:** the host is responsible, and the refund comes from the host's share. The G-ventZ fee and provider charge are not returned. Checkout states the host's responsibility (S5, D43). Guests contact the host (Q8 A).

**Tickets and check-in:**
- **Several tickets per purchase:** up to the host's limit (1–10, default 10). Ticket types can be mixed, and it applies to free and paid tickets. Every ticket goes to the buyer's email with its own QR code. Approval events wait for approval, then payment (Q6, S6, D56).
- **Check-in** is online only (Q9, D57).

**December event:** free only. Payment stories are prioritised **Should (M4/M5)**, not **Must (M3)** (Q10 B, D58).

## Part 2 — Generation Checklist (executed after this plan is approved)

- [x] 1. Personas: write `personas.md`, covering goals, frustrations, devices, the permissions each persona holds, and the stories each one appears in.
- [x] 2. Epics: list the epics and their requirement ids (approach chosen in Q2).
- [x] 3. **Sign-in epic:** email code (parity), Google sign-in and account linking, MFA enrolment and step-up for sensitive actions, bot protection.
- [x] 4. **Events epic:**
  - parity stories (create, edit, publish, cancel, delete, worldwide location and time)
  - paid ticket types gated on a payout account
  - cancelling an event with paid tickets
- [x] 5. **Free tickets epic:**
  - register (parity)
  - several tickets per purchase, with mixed types, the host's limit and all tickets sent to the buyer
  - approval events
  - waitlist
  - capacity under bursts (scale criteria)
- [x] 6. **Paid checkout epic:**
  - start checkout with a hold, provider page with Apple Pay and Google Pay, return page
  - confirmation by webhook
  - hold expiry, late payment, duplicate webhook
  - provider outage
  - receipt and ticket email
- [x] 7. **Payout accounts and fees epic:**
  - the owner connects Paystack or Stripe, with status updates
  - changing details with MFA and a notice
  - choosing who pays the fees, per event
- [x] 8. **Refunds epic:**
  - host refund from the host's share
  - "organizer responsible" wording at checkout
  - cancellation refunds
  - refund failure and retry
  - disputes
- [x] 9. **Host sales and orders epic:** sales per event and currency, orders list, ledger figures.
- [x] 10. **Door check-in epic:** fast scans, duplicate and refunded tickets, several devices, and tickets shared by the buyer. Online only.
- [x] 11. **Platform staff and operations epic:** fee settings with audit, reconciliation alerts, disputes view, on-call alerts (if Q4 A).
- [x] 12. INVEST check on every story: split anything larger than L, and make sure each story has at least one failure or edge case.
- [x] 13. Persona-to-story map, and story-to-requirement traceability.
- [x] 14. Write `stories.md`, and validate formatting (content-validation rules).
