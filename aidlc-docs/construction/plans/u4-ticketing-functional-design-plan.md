# U4 Ticketing — Functional Design Plan

**Scope** (unit-of-work.md, U4; M3 go-live):
- free orders with several tickets per purchase (D56)
- approval events
- the waiting list (groups)
- the ticket page
- door check-in at the December event's scale
- the order tickets email
- the guest list
- "my orders"
- a design that leaves room for paid holds (U7) and seat reservation (D55)

**Inputs:**
- requirements v2.1 (FR-4, FR-6, FR-7, FR-11, D56, D57)
- stories US-2.4, US-3.1 to US-3.5, US-7.3, US-8.1 to US-8.3
- application design v2 (AD11, AD12: `Order`, `Ticket`, `EventInventory`)
- the current SQL functions (`register_guest`, `promote_next_waitlisted`, `check_in_guest`)

The research note `inception/research/luma-eventporte-notes.md` is still open. Question 7 below covers the ideas that touch U4.

Put your choice after each `[Answer]:` tag, and save the file before replying.

## Plan
- [x] 1. Collect and analyze answers
- [x] 2. `u4-ticketing/functional-design/domain-entities.md`: Order, OrderLine, Ticket (one `registrations` row), EventInventory (counters), BuyerAllowance, the statuses, and how they map to the Supabase tables
- [x] 3. `business-rules.md`: placing a free order, all-or-nothing admission, capacity and waiting list, the per-buyer limit, answers, approval, waitlist promotion, the ticket page, check-in scans, guest list, my orders, ticket email, errors
- [x] 4. `business-logic-model.md`: flows, the lock order, counters, compatibility with the current app (AD17), testable properties (PBT-01)
- [x] 5. Migration needs (orders table, ticket links, counters, replacing the one-per-user index safely)

## Questions

### Question 1 — When a group doesn't fit
Today a single guest is waitlisted when the event is full, and refused when their ticket type is sold out. With several tickets per purchase, what happens when someone asks for 4 and only 2 places are left?

A) **No partial fills, with two cases:**
   - **Some places left, but fewer than asked:** refused with "Only 2 places left". The buyer can lower the number and try again.
   - **The event is completely full:** the **whole group** joins the waiting list, as single guests do today.
   - **Ticket type sold out, event not full:** refused, as today.
   - (Recommended: groups never split, and the buyer sees the real number.)

B) The whole group joins the waiting list whenever it doesn't fit.

C) Issue the 2 that fit and waitlist the other 2.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — Names on group tickets
A) **Ticket 1 carries the buyer's name. Other tickets take an optional guest name**, falling back to "Guest of {buyer}". Names show on the ticket and at the door. (Recommended)

B) A name is required for every ticket.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — Registration answers for groups
A) **Answered once per order, by the buyer.** They're copied to every ticket in the order, so the guest list shows them on each ticket. (Recommended: one form, fast at peak.)

B) Answered separately for every ticket.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4 — Which tickets count towards the per-buyer limit
A) **Confirmed, pending (awaiting approval) and waitlisted tickets** count. Cancelled and refunded tickets don't. (Recommended: the limit can't be dodged by waiting in the queue.)

B) Only confirmed tickets.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5 — Approving and promoting groups
A) **The whole order moves together:**
   - **Approve:** all of the order's tickets become confirmed at once, if there's room for all of them. Otherwise the host is told how many places are missing.
   - **Promote from the waiting list:** "promote next" takes the oldest waiting order that fits in the free places.
   - (Recommended)

B) Ticket by ticket.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 6 — What door staff see on a scan
A) **Green or red, and a short reason:**
   - **Green:** "Checked in", with the guest name, ticket type and "ticket 2 of 4 · bought by Ada Obi".
   - **Red:** "Already used at 18:42 by Musa", "Refunded", "Not confirmed (awaiting approval)", "On the waiting list", or "Not for this event".
   - Answers are not shown at the door, for privacy.
   - (Recommended)

B) The same, plus the registration answers.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 7 — Ideas from the Luma research that touch U4 (research note Q1)
Choose any. Each is small and fits before 15 November.

- **I1:** calendar invite (.ics) attached to the tickets email
- **I2:** guest list search (name, email, email domain), filter by ticket type and status, sort by registration or check-in time
- **I3:** CSV export of the guest list (owner, admin, finance)
- **I4:** a "declined" status, so hosts can decline pending orders, with an email
- **I7:** "My tickets" for attendees (`/v1/me/orders` is already planned; this adds upcoming and past tickets with their QR codes)
- **I11:** bulk status update (paste emails)

A) **I1, I2, I3, I4, I7.** I11 is left for later. (Recommended)

B) All six.

C) None.

X) Other (list them after [Answer]: tag below)

[Answer]: A

Research note Q2 (after go-live backlog: early-bird, promoter links, join links, feedback email) — A) record as backlog (Recommended), B) other:

[Answer]: A
