# User Stories — Change 1

**Format:**
- **Story:** "As a [persona], I want [goal], so that [reason]."
- **Acceptance criteria:** Given / When / Then. Every story has at least one failure or edge case.
- **Priority:**
  - **Must (M3)** = needed for the 2026-11-15 go-live.
  - **Should (M4)** = Paystack.
  - **Should (M5)** = Stripe.
  - **Could** = nice to have.
- **Size:** S / M / L.

Personas are in `personas.md` (P1 Buyer, P2 Host, P3 Team member, P4 Door staff, P5 Platform staff, P6 On-call). Requirement ids refer to `requirements.md` revision 2.1.

**Parity stories** say "works as today". Their full behaviour is the existing behaviour, described in `reverse-engineering/business-overview.md` (BT1–BT14) and the approved U3 functional design, now served through the API.

## Epics

| Epic | Theme | Requirements |
|---|---|---|
| E1 | Sign-in and account security | FR-1, NFR-6 |
| E2 | Events | FR-2, FR-3, FR-12, FR-13, FR-16 |
| E3 | Getting tickets (free) | FR-4, FR-6, FR-11 |
| E4 | Paid checkout | FR-5, FR-8, FR-11 |
| E5 | Payout account and fees | FR-8, FR-9 |
| E6 | Refunds and disputes | FR-10, FR-15 |
| E7 | Sales and orders | FR-14, FR-15 |
| E8 | Door check-in | FR-7 |
| E9 | Platform and operations | FR-8, FR-15, FR-17, NFR-2–NFR-5 |

---

## E1 — Sign-in and Account Security

### US-1.1 Sign in with an email code (parity)
As a **P1 Buyer**, I want to sign in with a code sent to my email, so that I can get tickets without a password.
- **Requirements:** FR-1.1, FR-1.7, FR-1.9 · **Priority:** Must (M3) · **Size:** S
- **AC1:** Given I enter my email and pass the bot check, when I ask for a code, then I receive a 6-digit code by email from `gventz.com`.
- **AC2:** Given a valid code, when I enter it, then I'm signed in, and returned to the same-site page I came from.
- **AC3:** Given I enter a wrong code too many times, when I try again, then I'm refused and told to request a new code.
- **AC4:** Given I already had an account before the split, when I sign in, then I see my existing events and tickets (same account).

### US-1.2 Sign in with Google
As a **P1 Buyer**, I want to continue with Google, so that I can sign in with one tap.
- **Requirements:** FR-1.2, FR-18.2 · **Priority:** Must (M3) · **Size:** M
- **AC1:** Given I have no G-ventZ account, when I choose "Continue with Google" and approve, then an account is created with my verified Google email and I'm signed in.
- **AC2:** Given I already have an account created with an email code under the same verified email, when I continue with Google, then I'm signed in to **that same account**, and my events and tickets are there.
- **AC3:** Given I cancel on Google's screen, when I return, then I'm back on the sign-in page with a clear message and not signed in.
- **AC4:** Given Google says my email is not verified, when I continue, then sign-in is refused.

### US-1.3 Every API request is checked
As a **P2 Host**, I want every request to my events to be checked against my sign-in, so that nobody can act as me.
- **Requirements:** FR-1.3, FR-1.4, NFR-6 (SECURITY-08) · **Priority:** Must (M3) · **Size:** M
- **AC1:** Given a valid Supabase session, when the web app calls the API, then the API accepts the token without a network call per request.
- **AC2:** Given an expired, tampered or wrong-project token, when it's used, then the API answers 401.
- **AC3:** Given I'm signed in but have no role on an event, when I request it, then I get 404, as if it didn't exist.
- **AC4:** Given I sign out, when my old session is used to refresh, then it no longer works.

### US-1.4 Turn on two-step sign-in
As a **P2 Host**, I want to add an authenticator app to my account, so that losing my email alone doesn't give someone my payouts.
- **Requirements:** FR-1.6, D54 · **Priority:** Should (M4) · **Size:** M
- **AC1:** Given I'm signed in, when I scan the QR code with an authenticator app and enter a valid code, then two-step sign-in is on.
- **AC2:** Given two-step is on, when I sign in, then I'm asked for an authenticator code after the email code or Google.
- **AC3:** Given I enter a wrong authenticator code, when I try, then I'm refused, and repeated failures raise a security alert (US-9.4).

### US-1.5 Step-up before sensitive money actions
As a **P2 Host**, I want to be asked for my authenticator code before payout or refund actions, so that a stolen session can't move money.
- **Requirements:** FR-1.6, FR-9.1, FR-10.1, D54 · **Priority:** Should (M4) · **Size:** S
- **AC1:** Given I haven't confirmed a second factor in this session, when I try to change payout details or issue a refund, then I'm asked for my authenticator code first.
- **AC2:** Given I haven't set up two-step sign-in, when I try those actions, then I'm guided to set it up first.
- **AC3:** Given a request without a second factor reaches the API directly, when it asks to refund or change payout details, then it is refused (403).

---

## E2 — Events

### US-2.1 Create and publish an event (parity, worldwide)
As a **P2 Host**, I want to create an event with ticket types and publish it, so that guests can find it.
- **Requirements:** FR-2.1, U3-FD · **Priority:** Must (M3) · **Size:** M
- **AC1:** Works as today (BT2), through the API:
  - local date and time plus time zone
  - any country and region
  - zone and currency defaults from the venue
- **AC2:** Given a country with several time zones and no zone chosen, when I save, then I'm asked to pick a zone.
- **AC3:** Given I'm an **editor**, when I try to publish, then I'm refused. Only the owner or an admin can publish.

### US-2.2 Manage an event (parity)
As a **P3 Team member** (editor or admin), I want to edit details, settings, questions and flyer, so that the event page stays right.
- **Requirements:** FR-2.3–2.5, FR-3, FR-12 · **Priority:** Must (M3) · **Size:** M
- **AC1:** Works as today (BT3, BT4), through the API, including the venue fixes C1/C2 and the 30-question limit under concurrent edits (C3).
- **AC2:** Given I upload a flyer over 5 MB or not JPG, PNG or WebP, when I confirm, then it's refused, and the old flyer stays.
- **AC3:** Given I'm a **viewer**, when I try to edit, then I'm refused.

### US-2.3 Add paid ticket types once a payout account exists
As a **P2 Host**, I want to sell paid tickets, so that I earn from my event.
- **Requirements:** FR-2.2, FR-2.3, FR-9 · **Priority:** Should (M4) · **Size:** S
- **AC1:** Given I have a verified payout account for the event's currency, when I add a paid ticket type and publish, then the event goes live with paid tickets.
- **AC2:** Given I have no verified payout account, when I try to publish an event with a paid ticket type, then I'm refused and told to connect a payout account first.
- **AC3:** Given I mix currencies across ticket types, when I save, then it's refused. One currency per event.

### US-2.4 Set the per-buyer ticket limit
As a **P2 Host**, I want to set how many tickets one person can get, so that groups can come together without bulk buying.
- **Requirements:** D56, FR-4.4 · **Priority:** Must (M3) · **Size:** S
- **AC1:** Given a new event, when I don't change it, then the limit is 10.
- **AC2:** Given I set a limit from 1 to 10, when I save, then it applies to every purchase on the event.
- **AC3:** Given I enter 0 or more than 10, when I save, then it's refused.

### US-2.5 Cancel an event
As a **P2 Host**, I want to cancel an event, so that guests know it's off, and paid guests are refunded.
- **Requirements:** FR-2.6, FR-2.4, FR-10.2 · **Priority:** Must (M3) for free events; Should (M4) for refunds · **Size:** M
- **AC1:** Given I'm the owner or an admin, when I confirm cancellation, then registration closes, the public page shows the event as unavailable, and the cancellation is audited.
- **AC2:** Given the event has paid tickets, when it's cancelled, then a refund is queued for every paid order (US-6.2).
- **AC3:** Given I'm an editor, when I try to cancel, then I'm refused.

### US-2.6 Delete an event (parity)
As a **P2 Host**, I want to delete an event I no longer need, so that it disappears completely.
- **Requirements:** FR-2.7 · **Priority:** Must (M3) · **Size:** S
- **AC1:** Works as today (BT12): owner only, typed title, flyers removed.
- **AC2:** Given any paid order exists, when I try to delete, then I'm refused, and told to cancel instead.

### US-2.7 Discover events and view the event page (parity)
As a **P1 Buyer**, I want to browse events and open an event page, so that I can decide what to attend.
- **Requirements:** FR-13, FR-16.2 · **Priority:** Must (M3) · **Size:** S
- **AC1:** Works as today (BT13): featured events, the public page with its visibility rules, and outside listings.
- **AC2:** Given an outside source is slow or down, when I open Discover, then G-ventZ events still show within normal time.
- **AC3:** Given a host edits or publishes, when I reload the page, then I see the change. Cached pages are refreshed.

### US-2.8 Draft announcements and dashboard theme (parity)
As a **P2 Host**, I want to keep drafting announcements and choosing my dashboard style, so that nothing I use today is lost.
- **Requirements:** FR-14.1 · **Priority:** Must (M3) · **Size:** S
- **AC1:** Works as today (BT10, BT14).
- **AC2:** Given a subject over 200 characters, when I save a draft, then it's refused.

---

## E3 — Getting Tickets (Free)

### US-3.1 Get several free tickets in one go
As a **P1 Buyer**, I want to pick how many tickets of each type I need, so that I can bring friends.
- **Requirements:** FR-4, D56 · **Priority:** Must (M3) · **Size:** L
- **AC1:** Given an open free event with a limit of 10, when I choose 3 Regular and 1 VIP and answer the questions, then 4 tickets are issued to me, each with its own code.
- **AC2:** Given I already hold 8 tickets for this event, when I ask for 3 more, then I'm refused, and told I can get at most 2.
- **AC3:** Given only 2 places are left and I ask for 4, when I submit, then nothing is issued (no partial fill), and I'm told how the event's capacity rule handles me: waitlist or refusal.
- **AC4:** Given I add optional guest names, when the tickets are issued, then each ticket shows its guest name.
- **AC5:** Given registration is closed or the sales window has passed, when I try, then I'm refused with a clear message.

### US-3.2 Receive all my tickets by email
As a **P1 Buyer**, I want every ticket emailed to me with its own QR code, so that I can forward them to my friends.
- **Requirements:** FR-11.1, D56 · **Priority:** Must (M3) · **Size:** M
- **AC1:** Given I got 4 tickets, when they're issued, then one email goes to my verified account email with 4 QR codes and a link to each ticket.
- **AC2:** Given the email service is down, when tickets are issued, then my tickets are still valid, and the email is sent once it recovers, never twice.
- **AC3:** Given I open any ticket link, when it loads, then it shows the event, ticket type, guest name (if given) and status.

### US-3.3 Approval events
As a **P2 Host**, I want to approve group requests, so that I control who attends.
- **Requirements:** FR-4.1, D56 · **Priority:** Must (M3) (free); Should (M4) (paid) · **Size:** M
- **AC1:** Given an approval event, when a buyer requests 3 free tickets, then the request is **pending** as a whole, and no tickets are valid yet.
- **AC2:** Given a paid approval event, when a buyer requests tickets, then **no payment is taken** until the host approves. After approval, the buyer gets a time-limited checkout link.
- **AC3:** Given the event fills up while a request is pending, when the host tries to approve, then they're told there isn't enough capacity.
- **Note:** the approve/decline **screen** stays out of scope (requirements, Out of Scope). Approval uses whatever mechanism exists today until that screen is built.

### US-3.4 Waiting list (parity, groups)
As a **P3 Team member**, I want to confirm the next waitlisted request, so that freed places get used.
- **Requirements:** FR-6 · **Priority:** Must (M3) · **Size:** M
- **AC1:** Works as today (BT9) for single tickets.
- **AC2:** Given the oldest waitlisted request is for 3 tickets, when I confirm it, then all 3 are issued and emailed together, but only if 3 places are free. Otherwise I'm told it doesn't fit.

### US-3.5 No overselling at the busiest moment
As a **P2 Host**, I want ticket limits to hold when thousands register at once, so that I never have more guests than places.
- **Requirements:** FR-4.2, NFR-2.3, NFR-2.4 · **Priority:** Must (M3) · **Size:** L
- **AC1:** Given bursts of 50 registrations a second on one ticket type across several API instances, when the load test runs at 100 a second, then confirmed tickets never exceed capacity or quantity.
- **AC2:** Under that load, registration answers in under 300 ms p95, with errors below 0.1%.
- **AC3:** Given the same buyer submits twice at the same moment, when both arrive, then the per-buyer limit still holds.

---

## E4 — Paid Checkout (Should, M4 Paystack / M5 Stripe)

### US-4.1 Start checkout with tickets held for me
As a **P1 Buyer**, I want my tickets held while I pay, so that they don't sell out mid-payment.
- **Requirements:** FR-5.1, FR-5.7, D38 · **Priority:** Should (M4) · **Size:** L
- **AC1:** Given paid tickets are available, when I choose quantities and continue, then an order is created, the tickets are held for 10 minutes, and I see the total and a countdown.
- **AC2:** Given the event's fees are set to **guest pays**, when I see the total, then the fees appear as a separate line. With **host absorbs**, I see only the ticket prices.
- **AC3:** Given there aren't enough tickets left, when I continue, then I'm told before any payment.
- **AC4:** Given I try to start many checkouts quickly, when I exceed the rate limit, then I'm refused for a short time.

### US-4.2 Pay on the provider's page, with Apple Pay and Google Pay
As a **P1 Buyer**, I want to pay with card, bank, Apple Pay or Google Pay, so that paying is quick on my phone.
- **Requirements:** FR-5.2, D39, D40 · **Priority:** Should (M4 Paystack, M5 Stripe) · **Size:** M
- **AC1:** Given an event in a Paystack currency (for example NGN), when I continue, then I'm sent to Paystack's checkout page.
- **AC2:** Given an event in another currency (for example GBP or EUR), when I continue, then I'm sent to Stripe Checkout.
- **AC3:** Given my device supports it, when the provider's page loads, then Apple Pay or Google Pay is offered.
- **AC4:** G-ventZ pages never ask for or receive card numbers.
- **AC5:** The checkout states that the organizer is responsible for refunds, with the event's refund policy (D43).

### US-4.3 Tickets only after the payment is confirmed
As a **P1 Buyer**, I want my tickets as soon as my payment really succeeds, so that I'm never charged without tickets.
- **Requirements:** FR-5.3, FR-5.4, FR-5.5 · **Priority:** Should (M4) · **Size:** L
- **AC1:** Given I paid, when the provider's verified notification arrives with the right amount and currency, then my tickets are issued and emailed, and the hold becomes a sale.
- **AC2:** Given I come back to the site before the notification, when the return page loads, then it shows "confirming payment", and updates when confirmed. Returning alone never issues tickets.
- **AC3:** Given the provider sends the same notification twice, or out of order, when both are processed, then I get my tickets once.
- **AC4:** Given a notification with a bad signature, or an amount that doesn't match, when it arrives, then it's rejected and logged, and an alert is raised.

### US-4.4 Holds expire, and late payments are handled
As a **P1 Buyer**, I want a fair result if I take too long to pay, so that I either get my tickets or my money back.
- **Requirements:** FR-5.6 · **Priority:** Should (M4) · **Size:** M
- **AC1:** Given I don't pay within 10 minutes, when the hold expires, then the tickets go back on sale, and my order shows "expired".
- **AC2:** Given my payment arrives after expiry and tickets are still available, when it's confirmed, then my tickets are issued.
- **AC3:** Given my payment arrives after expiry and the event is sold out, when it's confirmed, then I'm refunded in full automatically and emailed. This is a system refund, not a host refund.

### US-4.5 A provider outage doesn't stop free tickets
As a **P1 Buyer**, I want a clear message when payments are down, so that I'm not left guessing.
- **Requirements:** FR-5.8, NFR-5 · **Priority:** Should (M4) · **Size:** S
- **AC1:** Given the provider is failing, when I try to check out, then I see "payments are temporarily unavailable", and no order is held.
- **AC2:** Given payments are down, when someone registers for a free event, then it works normally.

### US-4.6 Order receipt
As a **P1 Buyer**, I want a receipt with my tickets, so that I have proof of what I paid.
- **Requirements:** FR-11.1, FR-11.2 · **Priority:** Should (M4) · **Size:** S
- **AC1:** Given my order is paid, when the email arrives, then it lists each ticket, the price, any fees, the total, the currency, the order reference and the refund statement.
- **AC2:** The receipt is sent once, even if notifications repeat.

---

## E5 — Payout Account and Fees (Should, M4/M5)

### US-5.1 Connect a payout account
As a **P2 Host** (owner), I want to add the account I get paid into, so that my share of every sale reaches me.
- **Requirements:** FR-9.1, FR-9.2, D41 · **Priority:** Should (M4 Paystack, M5 Stripe) · **Size:** L
- **AC1:** Given I'm in a Paystack country, when I choose my bank and enter my account number with my authenticator code, then the account name is checked and shown to me before I confirm.
- **AC2:** Given I'm elsewhere, when I choose Stripe, then I complete Stripe's own onboarding, and come back to see the status.
- **AC3:** Given my account is still being checked by the provider, when I look, then it shows **pending**. When the provider confirms, it shows **verified**.
- **AC4:** Given I'm an admin or finance member, when I open payout settings, then I can see the status but can't change anything.

### US-5.2 Change payout details safely
As a **P2 Host**, I want changes to my payout account to be protected and announced, so that nobody can redirect my money quietly.
- **Requirements:** FR-9.3, D54 · **Priority:** Should (M4) · **Size:** S
- **AC1:** Given I enter my authenticator code, when I change my bank details, then the change is saved and audited, and I get an email about it.
- **AC2:** Given I don't pass two-step sign-in, when I try, then the change is refused.

### US-5.3 Choose who pays the fees
As a **P2 Host**, I want to decide per event whether I absorb the fees or guests pay them, so that I can price my event the way I want.
- **Requirements:** FR-8.2, D42 · **Priority:** Should (M4) · **Size:** M
- **AC1:** Given a new paid event, when I don't change it, then fees are **absorbed by me**.
- **AC2:** Given I choose **guests pay**, when a buyer checks out, then the G-ventZ fee and the provider charge are added on top, and I receive the full ticket price.
- **AC3:** Given I absorb the fees, when a ₦10,000 ticket sells, then my dashboard shows the ₦10,000 sale, the provider charge and the G-ventZ fee deducted, and what I receive.
- **AC4:** Given tickets have already sold, when I change the choice, then it applies only to new orders.

### US-5.4 Get paid on every sale
As a **P2 Host**, I want my share settled after each sale, so that I'm not waiting until after the event.
- **Requirements:** FR-9.4, D41 · **Priority:** Should (M4) · **Size:** M
- **AC1:** Given a paid order is confirmed, when the provider settles, then my share (sale minus fees, per my fee choice) goes to my payout account on the provider's normal schedule.
- **AC2:** G-ventZ's fee goes to G-ventZ in the same split. G-ventZ doesn't hold my share.

---

## E6 — Refunds and Disputes

### US-6.1 Refund a ticket
As a **P3 Team member** (owner, admin or finance), I want to refund a paid ticket, so that I can resolve a guest's request.
- **Requirements:** FR-10.1, D43 · **Priority:** Should (M4) · **Size:** L
- **AC1:** Given I pass two-step sign-in, when I refund a ticket, then the ticket is voided at once, the place goes back on sale, and the buyer is refunded the ticket amount from my share.
- **AC2:** The G-ventZ fee and the provider charge are not returned by G-ventZ, and the dashboard shows exactly what was refunded.
- **AC3:** Given I'm an editor or viewer, when I try to refund, then I'm refused.
- **AC4:** Given the ticket was already checked in or refunded, when I try, then I'm told why it can't be refunded. A checked-in ticket can still be refunded if the host chooses; settled in design.
- **AC5:** Given a buyer asks G-ventZ for a refund, then support points them to the organizer (US-9.3), in line with the terms.

### US-6.2 Refunds when an event is cancelled
As a **P1 Buyer**, I want my money back automatically if the event is cancelled, so that I don't have to chase anyone.
- **Requirements:** FR-10.2, FR-2.4 · **Priority:** Should (M4) · **Size:** M
- **AC1:** Given an event with 500 paid orders is cancelled, when refunds run, then every order is refunded from the host's share, and each buyer is emailed.
- **AC2:** Given a refund fails at the provider, when it's retried with backoff and still fails, then the host and on-call are told, and the order shows "refund failed".
- **AC3:** Refunds never run twice for the same order.

### US-6.3 Refund status
As a **P2 Host**, I want to see each refund's result, so that I know who still needs attention.
- **Requirements:** FR-10.3 · **Priority:** Should (M4) · **Size:** S
- **AC1:** Given a refund is in progress, when the provider confirms, then it shows **refunded**. If the provider reports failure, it shows **failed** with the reason.
- **AC2:** The order keeps a history of every change.

### US-6.4 Disputes and chargebacks
As a **P2 Host**, I want to see when a buyer disputes a payment, so that I can respond in the provider's dashboard.
- **Requirements:** FR-10.4 · **Priority:** Should (M4) · **Size:** S
- **AC1:** Given the provider reports a dispute, when it arrives, then the order shows "disputed", and the host and platform staff are notified.
- **AC2:** Given the dispute is resolved, when the provider reports the result, then the order and ledger show it.

---

## E7 — Sales and Orders

### US-7.1 See sales per event
As a **P2 Host**, I want sales figures per event, so that I know how I'm doing.
- **Requirements:** FR-14.2, FR-15 · **Priority:** Should (M4) · **Size:** M
- **AC1:** Given paid orders exist, when I open the event's sales, then I see per currency:
  - tickets sold and the gross amount
  - provider charges and G-ventZ fees
  - refunds and the net amount
- **AC2:** The figures match the payment ledger exactly.
- **AC3:** Given I'm a viewer or editor, when I open sales, then I'm refused. Finance, admin and owner can see them.

### US-7.2 Orders list
As a **P3 Team member** (finance), I want to search orders, so that I can answer guest questions.
- **Requirements:** FR-14.3 · **Priority:** Should (M4) · **Size:** M
- **AC1:** Given an event with thousands of orders, when I open the list, then it's paginated and filterable by status (paid, expired, refunded, disputed).
- **AC2:** Each order shows the buyer, tickets, amount, fees, status and refund action (US-6.1).

### US-7.3 Guest list with groups (parity plus several tickets)
As a **P3 Team member**, I want the guest list to show each ticket and who bought it, so that I can manage groups.
- **Requirements:** FR-14.1, D56 · **Priority:** Must (M3) · **Size:** S
- **AC1:** Works as today (50 per page, waitlist count), plus each ticket's guest name and its buyer.
- **AC2:** Given a viewer opens the list, when it loads, then they can read but not change it.

---

## E8 — Door Check-in

### US-8.1 Scan tickets fast
As a **P4 Door staff**, I want to scan a QR code and see a clear result, so that the queue keeps moving.
- **Requirements:** FR-7.1, FR-7.3 · **Priority:** Must (M3) · **Size:** M
- **AC1:** Given a confirmed ticket, when I scan it, then I see a green "checked in" result with the ticket type and guest name, in under a second.
- **AC2:** With several staff scanning at about 5 scans a second in total, answers stay under 300 ms p95 at the API.
- **AC3:** Given I lose connection, when I scan, then I see a clear "no connection" message, not a false result (online only, D57).

### US-8.2 Stop used, refunded or invalid tickets
As a **P4 Door staff**, I want a clear red result for tickets that can't be used, so that I don't let anyone in by mistake.
- **Requirements:** FR-7.1, FR-7.2 · **Priority:** Must (M3) · **Size:** S
- **AC1:** Given a ticket already checked in, when I scan it, then I see "already used", with the time and which device checked it in.
- **AC2:** Given a refunded, pending or waitlisted ticket, when I scan it, then I see why it's not valid.
- **AC3:** Given the same ticket is scanned on two devices at the same moment, when both are processed, then only one succeeds.
- **AC4:** Given a code from another event, when I scan it, then I see "not for this event".

### US-8.3 Forwarded tickets work once
As a **P1 Buyer**, I want the tickets I forwarded to work for my friends, so that we can arrive separately.
- **Requirements:** D56, R-P2 · **Priority:** Must (M3) · **Size:** S
- **AC1:** Given I forwarded 3 of my 4 tickets, when my friends arrive separately, then each ticket checks in once, independently.
- **AC2:** Given a forwarded code was copied, when the second person shows it, then they get "already used".

---

## E9 — Platform and Operations

### US-9.1 Set fee rates
As a **P5 Platform staff**, I want to set the G-ventZ fee per currency, so that the platform earns on paid tickets.
- **Requirements:** FR-8.1, D42 · **Priority:** Should (M4) · **Size:** S
- **AC1:** Given I pass two-step sign-in, when I set "5% + ₦100" for NGN, then new orders in NGN use it, and the change is audited (who, before, after, when).
- **AC2:** Given no rate is set for a currency, when tickets sell, then the G-ventZ fee is 0.
- **AC3:** Given I'm not platform staff, when I try, then I'm refused.

### US-9.2 Daily reconciliation
As a **P5 Platform staff**, I want each day's money checked against the providers, so that mistakes are caught early.
- **Requirements:** FR-15.2 · **Priority:** Should (M4) · **Size:** M
- **AC1:** Given yesterday's ledger matches Paystack's and Stripe's records, when the daily check runs, then it records "matched".
- **AC2:** Given any difference in amount, count or status, when it runs, then an alert is raised with the order references.

### US-9.3 Support view for a payment
As a **P5 Platform staff**, I want to look up an order by reference, so that I can help a buyer or host.
- **Requirements:** FR-15, D43 · **Priority:** Could · **Size:** M
- **AC1:** Given an order reference, when I search, then I see its status, ledger entries and the provider's reference.
- **AC2:** Every lookup is audited.
- **AC3:** Given a buyer asks for a refund, then the view shows the organizer's contact, because the organizer is responsible (D43).

### US-9.4 Be alerted when something important breaks
As a **P6 On-call engineer**, I want specific alerts with a runbook, so that I can fix problems before users report them.
- **Requirements:** FR-17, D52 · **Priority:** Must (M3) · **Size:** M
- **AC1:** Given a monitored condition crosses its threshold, when that happens, then I get an email and Slack message with the alert name, a link to the dashboard and its runbook. Conditions include:
  - error rate
  - p95 latency
  - readiness failing
  - queue backlog
  - database connections over 80%
  - backup failure
- **AC2:** Given repeated failed sign-ins or a spike of permission denials, when it happens, then a security alert is raised.
- **AC3:** Once payments go live (M4), webhook failures, refund failures and reconciliation differences also alert.

### US-9.5 Deploy and roll back without downtime
As a **P6 On-call engineer**, I want deploys that switch only when healthy, and quick rollback, so that releases don't take the site down.
- **Requirements:** D48–D51, NFR-4.5 · **Priority:** Must (M3) · **Size:** M
- **AC1:** Given a merged and approved pull request, when it deploys, then traffic moves to the new version only after its health check passes.
- **AC2:** Given a bad release, when I roll back on Render or Vercel, then the previous version serves traffic again, without a database rollback.
- **AC3:** Given a new instance fails its health check, when deploying, then the old version keeps serving.

### US-9.6 Recover data after a mistake
As a **P6 On-call engineer**, I want to restore the database to a point in time, so that we lose at most a couple of minutes of data.
- **Requirements:** NFR-4.1, NFR-4.4, D46 · **Priority:** Must (M3) · **Size:** M
- **AC1:** Given a restore drill on staging, when I follow the runbook, then the service is back within 1 hour, and data is restored to within about 2 minutes of the chosen time.
- **AC2:** The drill's result is recorded before go-live.

### US-9.7 Handle the December rush
As a **P5 Platform staff**, I want the platform scaled up before big sales open, so that the December event's 20,000 guests get through smoothly.
- **Requirements:** NFR-2, NFR-3 · **Priority:** Must (M3) · **Size:** M
- **AC1:** Given a scheduled sales opening, when it nears, then extra API instances are running in advance.
- **AC2:** Given traffic grows, when CPU or requests cross the limit, then instances scale up to the set maximum, and alert at 80% of any capacity limit.
- **AC3:** The load test (US-3.5) passes on staging sized like production before go-live.

---

## INVEST Check
- **Independent:** each story can be built and tested on its own once its epic's foundation exists (for example E4 needs E5's payout account).
- **Negotiable:** acceptance criteria state outcomes, not implementation.
- **Valuable:** each story names a persona and a benefit.
- **Estimable and small:** largest size is L. Each L story fits in one unit of work:
  - US-3.1, US-3.5
  - US-4.1, US-4.3
  - US-5.1
  - US-6.1
- **Testable:** every story has a Given/When/Then failure or edge case.

## Story Summary

| Epic | Stories | Must (M3) | Should (M4/M5) | Could |
|---|---|---|---|---|
| E1 | 5 | 3 | 2 | 0 |
| E2 | 8 | 7 | 1 | 0 |
| E3 | 5 | 5 | 0 | 0 |
| E4 | 6 | 0 | 6 | 0 |
| E5 | 4 | 0 | 4 | 0 |
| E6 | 4 | 0 | 4 | 0 |
| E7 | 3 | 1 | 2 | 0 |
| E8 | 3 | 3 | 0 | 0 |
| E9 | 7 | 4 | 2 | 1 |
| **Total** | **45** | **23** | **21** | **1** |

Notes on split priorities:
- **US-2.5:** Must for free events; its refund part (AC2) is M4.
- **US-3.3:** Must for free events; its paid part (AC2) is M4.

## Persona-to-Story Map

| Persona | Stories |
|---|---|
| P1 Buyer | US-1.1, 1.2, 2.7, 3.1, 3.2, 4.1–4.6, 6.2, 8.3 |
| P2 Host | US-1.3–1.5, 2.1, 2.3–2.6, 2.8, 3.3, 3.5, 5.1–5.4, 6.3, 6.4, 7.1 |
| P3 Team member | US-2.2, 3.4, 6.1, 7.2, 7.3 |
| P4 Door staff | US-8.1, 8.2 |
| P5 Platform staff | US-9.1, 9.2, 9.3, 9.7 |
| P6 On-call | US-9.4, 9.5, 9.6 |

## Requirement Traceability

| Requirement | Stories |
|---|---|
| FR-1 | US-1.1–1.5 |
| FR-2, FR-3, FR-12 | US-2.1–2.6 |
| FR-4, D56 | US-2.4, 3.1, 3.3, 3.5 |
| FR-5 | US-4.1–4.5 |
| FR-6 | US-3.4 |
| FR-7 | US-8.1–8.3 |
| FR-8 | US-5.3, 9.1 |
| FR-9 | US-2.3, 5.1, 5.2, 5.4 |
| FR-10 | US-2.5, 6.1–6.4 |
| FR-11 | US-3.2, 4.6 |
| FR-13, FR-16 | US-2.7 |
| FR-14 | US-2.8, 7.1–7.3 |
| FR-15 | US-7.1, 9.2, 9.3 |
| FR-17 | US-9.4 |
| FR-18 | US-1.2, 4.2 (frontend parts of each story) |
| NFR-2, NFR-3 | US-3.5, 8.1, 9.7 |
| NFR-4 | US-9.5, 9.6 |
| NFR-5 | US-2.7 (AC2), 4.5 |
| NFR-6 | US-1.3, 1.5, 4.3 (AC4), 5.2 |
