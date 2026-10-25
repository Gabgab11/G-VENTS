# Product Research: Luma and EventPorte (2026-10-24)

The product owner asked to look at Luma and EventPorte "for inspiration and broader context". These notes list what each does that matters to G-ventZ, and the ideas worth adopting.

**Nothing here is in scope until you choose it below.** Choices that change requirements go through Requirements, so the plan and audit trail stay right.

**Sources:**
- [Luma — Managing your guest list](https://help.luma.com/p/managing-your-guest-list)
- [Luma — Event registration process](https://help.luma.com/p/event-registration-process)
- [Luma help centre](https://help.luma.com/)
- [EventPorte homepage](https://eventporte.com)
- [EventPorte on Ghost Explore](https://explore.ghost.org/p/eventporte)

## What Luma Does (Relevant Parts)

| Area | Luma | G-ventZ today / planned |
|---|---|---|
| Guest statuses | Going, Pending, Waitlist, Invited, Not going (declined), Checked in (tracked per ticket) | confirmed, pending, waitlisted, cancelled, refunded; check-in per ticket (U4). No "declined" or "invited". |
| Guest list tools | Search by name, email or **email domain**; filter by status and **ticket type**; sort by registration or check-in time; **CSV export**; **bulk status update** (paste emails or upload CSV) with optional notification | Paginated guest list with a waitlist count (FR-14.1). No search, export or bulk update. |
| Approval | Approve or decline each pending guest, with their answers shown; **declined email** | Approve (U4); no decline; the approve/decline *screen* is out of scope. |
| Registration | Name and email; custom questions; group registration on or off; sales end time; capacity | Same ideas: questions, per-buyer limit (D56), sales window, capacity. |
| Emails | Confirmation with a **calendar invite attached automatically**; pending and declined emails; **reminders 1 day and 1 hour before**; **feedback email after** | Ticket email with QR codes (U4); no calendar invite, reminders or feedback. |
| Location privacy | **Show the address only to approved guests** | The address is always public. |
| Online events | **A unique join link per guest** (who clicked is visible) | Online events have no link handling. |
| Check-in | QR scan, **Express mode** (fast scanning) | Fast scanner (U4, U6). |

## What EventPorte Does (Public Site Only)

The public site has little detail.
- **Who it's for:** creators, organisers, promoters (a **Promoter Portal**) and attendees.
- **Features:**
  - card and **mobile wallet** payments
  - **"My Tickets"** for attendees
  - **early-bird tickets**
  - a creator account
  - fraud protection
- **Not published:** fees, payouts, check-in details, countries.
- **Background:** the creator posts as "Eventporte Africa", so it's likely an African competitor.

## Ideas, by Unit

| # | Idea | Unit | Effort | Fits before 15 Nov? |
|---|---|---|---|---|
| I1 | **Calendar invite (.ics)** attached to the ticket email | U4 | S | Yes |
| I2 | **Guest list search** (name, email, email domain) and **filter by ticket type**, sort by registration or check-in time | U4 | S | Yes |
| I3 | **CSV export** of the guest list (owner, admin, finance) | U4 | S | Yes |
| I4 | **"Declined" status** and a decline action for approval events, with an email | U4 | S–M | Yes (the API only; the screen stays out of scope) |
| I5 | **Reminder emails** 1 day and 1 hour before the event (to confirmed guests) | U4 or Notifications | M | Risky. The 20,000-guest December event means 40,000 emails; needs a Resend plan (O5). |
| I6 | **Hide the address until approved** (event setting) | U3 pass 2 | S | Yes |
| I7 | **"My tickets"** page for attendees (all upcoming tickets) | U4 + U6 | S | Yes (`/v1/me/orders` is already planned) |
| I8 | **Early-bird pricing** (price changes by date) | U7 (paid) | M | After go-live |
| I9 | **Promoter or referral links** (track sales per promoter) | Later | L | After go-live |
| I10 | **Unique join link per guest** for online events | Later | M | After go-live |
| I11 | **Bulk status update** (paste emails) | U4 | M | Maybe; useful for large guest lists |
| I12 | **Feedback email after the event** | Later | S | After go-live |

## Questions

Put your choice after each `[Answer]:` tag, and save the file before replying.

### Q1 — Which ideas to add before go-live (15 November)
*Answered through U4 FD Q7 = A: I1, I2, I3, I4, I7. I6 and I11 are not adopted for now.*
A) **Small, high-value set:**
   - I1 calendar invite
   - I2 search and filters
   - I3 CSV export
   - I4 declined status
   - I6 hide address until approved
   - I7 my tickets
   - Each is small and slots into U3 pass 2, U4 or U6. (Recommended)

B) A, plus I5 reminder emails. Needs a Resend plan that can send about 40,000 emails for the December event.

C) None for now; keep the current plan.

X) Other (list the idea numbers after [Answer]: tag below)

[Answer]: 

### Q2 — Ideas for after go-live
*Answered through U4 FD plan = A: recorded as backlog.*
A) **Record I8 early-bird, I9 promoter links, I10 join links and I12 feedback email as backlog** for after M5. They'll get their own requirements pass. (Recommended)

B) Plan some of them into M4 or M5 now (list them after [Answer]: tag below).

X) Other (please describe after [Answer]: tag below)

[Answer]: 
