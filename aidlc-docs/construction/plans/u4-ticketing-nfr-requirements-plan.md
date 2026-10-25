# U4 Ticketing — NFR Requirements Plan

**Already set, so not asked again:**
- **Load (D37, F2):** 20,000 tickets a day, 10,000 in the busiest hour, bursts of 50 orders a second, proven at 100 a second.
- **Door check-in:** 5 scans a second, under 300 ms p95.
- **Response times:** p95 under 300 ms for ordering and under 150 ms for reads (NFR-2).
- **Availability:** 99.9% (D46).
- **Inherited from U1:** the Security and Resiliency rules, rate-limit fail-closed rules, the outbox and circuit breakers.

Two decisions are specific to U4. Put your choice after each `[Answer]:` tag, and save the file before replying.

## Plan
- [x] 1. Collect and analyze answers
- [x] 2. `u4-ticketing/nfr-requirements/nfr-requirements.md`:
  - ordering throughput and latency, the no-oversell proof
  - check-in latency
  - email delivery time, guest list and CSV limits
  - abuse protection, privacy, availability of ticketing when dependencies fail
  - load-test scenarios
- [x] 3. `tech-stack-decisions.md`: QR rendering, ICS and CSV writers, k6 scenarios, Resend usage
- [x] 4. Check against the Security and Resiliency rules that apply

## Questions

### Question 1 — Getting 20,000 ticket emails out fast
Resend allows **10 requests a second** by default ([rate limits](https://www.resend.com/docs/api-reference/rate-limit)).
- Its batch endpoint sends 100 emails per request, but it **doesn't support attachments** ([batch emails](https://resend.com/docs/api-reference/emails/send-batch-emails)).
- Our design attaches a QR image per ticket and a calendar file to each email.
- **With attachments:** one email per request means at most about 10 emails a second. In a 50-orders-a-second rush, emails would arrive up to 30–40 minutes late. The tickets are still on the ticket page and in "My tickets" immediately.

A) **Make emails attachment-free so they can be batched:**
   - The QR code is an image link (`https://api.gventz.com/v1/tickets/{code}/qr.png`, served and cached by the API).
   - The calendar entry is an "Add to calendar" link (`…/calendar.ics`) plus a Google Calendar link.
   - The worker batches up to 100 emails per request, so about 1,000 emails a second fits in the default limit.
   - Target: **tickets email within 2 minutes (p95)**, even at peak.
   - (Recommended: fastest, and nothing to ask Resend for.)

B) Keep attachments (inline QR, `.ics` file), and **ask Resend for a higher limit** (for example 50 a second) before the December event. Target within 10 minutes at peak.

C) Keep attachments at the default limit, and accept that emails may be about 30 minutes late at the very peak.

X) Other (please describe after [Answer]: tag below)

[Answer]: B - WHAT IF WE SWITCH TO ZEPTOMAIL 

### Question 2 — Stopping bots from grabbing free tickets
For a free 20,000-ticket event, someone with many accounts could try to take a large share. These protections are already planned:
- Turnstile bot check at sign-in (Supabase)
- 10 tickets per person
- 10 orders a minute per user and 30 per IP
- one email per account

A) **Keep those for go-live,** and watch an "orders per minute per IP" metric with an alert. Add a check at checkout later if needed. (Recommended for 15 November.)

B) Also require a **Turnstile check when placing an order**. It adds a Cloudflare widget to the order form and a server check, about a day of work in U4 and U6.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Follow-up to Question 1 (your answer: "B - what if we switch to ZeptoMail")

What I found about **ZeptoMail** (Zoho):
- **Price:** credits of 10,000 emails for about $2.50, valid 6 months, counted per recipient ([pricing](https://www.zoho.com/zeptomail/pricing.html)). 20,000 ticket emails cost about $5.
- **Batch:** up to 500 recipients per request, with merge fields for personal text ([batch API](https://www.zoho.com/zeptomail/help/api/batch-email-sending.html)).
- **Attachments in a batch:** shared by every recipient, so each guest's own QR code can't be attached. Batching still needs QR links, the same as option A.
- **Speed:** no per-second limit is published. Accounts have a daily limit, reviewed by Zoho before you can buy credits ([subscriptions](https://zoho.com/zeptomail/help/subscription.html)). Throughput for single emails with attachments must be confirmed with Zoho.
- **SMTP:** supported, so it could also send Supabase's sign-in emails.

The backend already sends email through a `Mailer` interface, so the provider can be swapped by adding an adapter, without touching ticketing.

### Q1a — Which way?
A) **Keep Resend, keep attachments, ask Resend for a higher limit** (option B as you chose):
   - Build the Resend adapter now.
   - Add a ZeptoMail adapter later only if Resend won't raise the limit.
   - Owner item: email Resend support before mid-November.

B) **Switch to ZeptoMail now, keep attachments, single sends:**
   - Build a ZeptoMail adapter instead of Resend.
   - Owner items: a Zoho account, domain verification, and **Zoho confirming the sending rate** for about 20,000 emails in an hour.
   - Supabase's sign-in emails move to ZeptoMail SMTP as well.

C) **Both adapters, chosen by a setting** (`EMAIL_PROVIDER=resend|zeptomail`):
   - Start with whichever you set up first.
   - The other is a fallback if one is slow or down.
   - About half a day more work. (Recommended: removes the dependency on one vendor's limit for the December event.)

X) Other (please describe after [Answer]: tag below)

[Answer]: C
