# User Stories — Clarification Questions

Thank you for the answers in `story-generation-plan.md`.

## Recorded from your answers
- **Q1–Q4 A:** new journeys get full stories; epics follow the journeys; Given/When/Then; six personas.
- **Q8 A:** guests contact the host for refunds.
- **Q9:** offline check-in is held off. Check-in stays online only for now.
- **Q10 B:** **the December event is free only.** Paystack no longer has to be live by 2026-11-15. The 15 November go-live covers the split, Google sign-in and scale. Paystack follows after. Requirements will be updated.

## What still needs answering
Your Q5, Q6 and Q7 answers change how money moves. They need a few precise answers before stories can be written:
- **Q5:** you described a "collect, then remit" model instead of the automatic split per sale agreed in requirements (D41).
- **Q6:** buying for several people.
- **Q7:** who pays the provider charges.

Put your choice after each `[Answer]:` tag, and save the file before replying.

---

## S1 — Money model (your Q5 answer)
You wrote: *"we the platform sets it up, organizers add their accounts where we remit to … after the tickets are sold out, we remit to the account they provided after taking our percentage and paying Paystack/Stripe."*

As I read it, all ticket money goes into the **G-ventZ** Paystack and Stripe accounts. G-ventZ later sends each organizer what they're owed. This replaces the automatic split per sale (D41).

A) **Yes: collect, then remit:**
   - G-ventZ is the seller of record and holds the money until payout.
   - Organizers only register the bank account they want paid into, using Paystack transfer recipients or Stripe Connect payout details.

B) No: keep the automatic split per sale (D41). The organizer's share goes to them at the provider's normal settlement, and the G-ventZ fee to G-ventZ.

X) Other (please describe after [Answer]: tag below)

[Answer]: x - disregard holding the host money till after event ticket sell, pay per sell, deduct our fee and payment service fee

**Note on A, not legal advice:** holding organizers' money before paying it out can need a licence or an escrow arrangement in some countries, Nigeria included. It can also make G-ventZ responsible for refunds and chargebacks. Worth checking with your lawyer or with Paystack before payments go live.

## S2 — When organizers are paid (only if S1 = A)
You wrote "after the tickets are sold out", but many events never sell out.

A) **After the event ends:**
   - Payout is due **2 working days after the event's end time.**
   - Refunds and cancellations before then come out of money G-ventZ still holds. (Recommended: the safest option for refunds and chargebacks.)

B) When sales close: sold out, or the ticket sales end date passes, whichever comes first.

C) The organizer can request a payout of their available balance at any time, minus a reserve kept for refunds.

D) Sold out **or** the event ends, whichever comes first.

X) Other (please describe after [Answer]: tag below)

[Answer]: X - NOT ANYMORE, BALANCE ORGANIZERS PER SELL

## S3 — How a payout is sent (only if S1 = A)
A) **Automatic, with staff approval:**
   - The system calculates each payout when it falls due.
   - G-ventZ staff approve it with two-step sign-in.
   - The money is sent through Paystack Transfers or Stripe Connect.
   - The organizer gets an email statement. (Recommended)

B) Fully automatic, with no approval step.

C) Calculated by the system, but staff send the money by hand from the bank. Staff then mark the payout as paid.

X) Other (please describe after [Answer]: tag below)

[Answer]: X - PAYOUT IS DONE AFTER TICKET SALE

## S4 — Who pays the provider charge (your Q7 answer)
You wrote: *"providers charges come from the whole fee before remitting to the organizers and taking our fee percentage."* In requirements (Q11 A), the G-ventZ fee is added **on top** for the buyer.

Worked example:
- A ₦10,000 ticket.
- An example G-ventZ rate of 5%. The real rate isn't set yet.
- Paystack's local charge of 1.5% + ₦100.

A) **The buyer pays the fee on top; the organizer carries the provider charge:**
   - Buyer pays ₦10,500 (₦10,000 + ₦500 fee).
   - Paystack takes ₦257.50.
   - G-ventZ keeps ₦500.
   - Organizer receives **₦9,742.50**.

B) **The buyer pays the fee on top; G-ventZ carries the provider charge:**
   - Buyer pays ₦10,500.
   - Paystack takes ₦257.50 out of the G-ventZ fee, so G-ventZ keeps ₦242.50.
   - Organizer receives **₦10,000**.

C) **No fee on top; the percentage is taken after the provider charge:**
   - Buyer pays ₦10,000.
   - Paystack takes ₦250, leaving ₦9,750.
   - G-ventZ takes 5% of that, ₦487.50.
   - Organizer receives **₦9,262.50**.
   - This replaces the Q11 answer.

X) Other (please give your own worked example after [Answer]: tag below)

[Answer]: X - host but configurable, host can choose to absorb the fee or guests

G-ventZ fee rate, if known now (for example "5%" or "5% + ₦100"):

## S5 — What a refunded buyer gets back
Paystack and Stripe usually **keep their charge** when a payment is refunded. The money lost has to come from someone.

A) **Buyer gets everything back.** The lost provider charge comes out of the organizer's payout. On a cancellation, G-ventZ also gives back its fee.

B) **Buyer gets everything back.** The lost provider charge comes out of G-ventZ's fee.

C) **Buyer gets the ticket price back.** The G-ventZ fee and the provider charge are kept, and the refund policy at checkout says so. On a **cancelled event**, the buyer gets everything back, and the organizer's payout carries the cost.

X) Other (please describe after [Answer]: tag below)

[Answer]: X - we have to state this hosts will be fully responsible  for refunds. the event organizer is legally responsible for issuing and managing refunds, not the platform. 

---

## S6 — Buying for several people (your Q6 answer)
You wrote: *"one person can purchase for multiple people but will need to provide their emails."*

S6.1 — What the other guests must do

A) **Nothing.**
   - Each guest's ticket is emailed to the address the buyer typed, and is valid at once.
   - If the guest signs in with that email, they also see the ticket in their account.
   - The buyer can see every ticket in the order.
   - (Recommended: no friction at the door.)

B) Each guest must sign in with that email to **claim** the ticket before it's valid. Unclaimed tickets are still shown to the buyer.

X) Other (please describe after [Answer]: tag below)

[Answer]: A - but the email should for now go to the email that purchase the ticket with barcodes he/she can share with other people tickets are purchased for

S6.2 — Limits and rules (answer each line):
- **Most tickets in one purchase.** A) 10, set per event by the host up to 10. B) Another number:
  [Answer]: yes configurable by host
- **Mixing ticket types in one purchase,** for example 2 Regular + 1 VIP. A) Allowed. B) One type per purchase.
  [Answer]: A - allowed
- **Does it apply to free tickets as well as paid ones?** A) Yes, both. B) Paid only. Free tickets stay one per account.
  [Answer]: A
- **One ticket per email per event?** If a typed email already has an active ticket for the event: A) That person is refused, and the buyer is told before paying. B) Duplicates are allowed.
  [Answer]: X - let's just keep one email to the person that purchased the ticket
- **Approval events** (host approves guests): A) The whole purchase waits for approval, and payment is taken only after approval. B) Buying for others is not allowed on approval events.
  [Answer]: A
