# U4 Ticketing — Business Rules

## 1. Placing a free order (FR-4, D56, US-3.1)
`POST /v1/events/{id}/orders`, signed in:

```json
{ "lines": [{ "ticketTypeId": "…", "quantity": 3 }, { "ticketTypeId": "…", "quantity": 1 }],
  "guestNames": ["", "Tolu", "Kemi", ""],
  "answers": { "<questionId>": "value" },
  "buyerName": "Ada Obi" }
```

- **OR1. Who:** signed in only (FR-4.1). Limited by `orders.place`: 10 per minute per user and 30 per minute per IP, **fail closed** (U1).
- **OR2. Lines:**
  - 1 to 20 lines, each with a ticket type of this event and a quantity of 1 to 10.
  - Ticket types may repeat; quantities are added together.
  - The total is 1 to 10 (`order.quantity_invalid`).
- **OR3. Event state:**
  - Published, and registration open (`order.not_open`, "This event is not open for registration").
  - Every ticket type active (`order.ticket_type_unavailable`).
  - Price 0 (`order.paid_not_supported` until U7).
  - Inside its sales window (`order.sales_not_started` / `order.sales_ended`).
- **OR4. Buyer name:**
  - `buyerName`, 2–120 characters, defaults to the profile's full name; required when the profile has none (`order.buyer_name_required`).
  - It becomes `attendee_name` on every ticket.
  - The ticket email always goes to the account's **verified email** (from the token), never an address that was typed.
- **OR5. Guest names (Q2):** `guestNames[i]` names ticket i+1. Each is optional, 2–120 characters when given; extra entries are refused. Ticket 1 shows the buyer's name unless a different name is given.
- **OR6. Answers (Q3):** validated once against the event's questions, as today:
  - required questions answered
  - options questions answered with one of the options
  - terms questions stored as "Accepted"
  - values cut to 1,000 characters
  - unknown keys ignored
  - labels copied in

  Error codes: `order.answer_required` "Please answer: {label}", `order.answer_invalid` "Choose one of the options for: {label}".
- **OR7. Per-buyer limit (Q4):** `held + requested ≤ perBuyerLimit`, otherwise `order.buyer_limit` "You can get {remaining} more ticket(s) for this event" (remaining may be 0).

## 2. Admission: all or nothing (Q1, FR-4.4, FR-4.5)
In one transaction, holding the event row and ticket type locks (business-logic-model §2):

| Situation | Result |
|---|---|
| `capacity` set and `activeCount ≥ capacity` (event full) | **Whole order `waitlisted`.** Tickets waitlisted; no `sold` change. |
| `capacity` set and `requested > capacity − activeCount` | Refused: `order.not_enough_places` "Only {n} place(s) left" (`details.remaining`) |
| A ticket type with `quantity` set and `sold ≥ quantity` | Refused: `order.sold_out` "{name} is sold out" |
| A ticket type with `sold + n > quantity` | Refused: `order.not_enough_tickets` "Only {n} {name} ticket(s) left" |
| Otherwise, the event needs approval | Order `pending_approval`; tickets pending; `sold += n` per type |
| Otherwise | Order `completed`; tickets confirmed; `sold += n` per type |

- The response is 201 `{ orderId, status, tickets: [{ id, code, number, ticketType, guestName, status }] }`.
- Events: `ticketing.order_completed`, `ticketing.order_pending`, `ticketing.order_waitlisted`, through the outbox.

## 3. Answers
These are the same rules as the current `register_guest`, applied once per order and copied to every ticket.

## 4. Approval (Q5, I4)
- **AP1. Approve:**
  - `POST /v1/events/{id}/orders/{orderId}/approve` (`orders.approve`).
  - `pending_approval` → `completed`; tickets pending → confirmed.
  - Pending tickets already count towards capacity and `sold`, so approval always fits.
  - Event: `ticketing.order_completed`, which sends the tickets email.
- **AP2. Decline (I4):**
  - `POST /v1/events/{id}/orders/{orderId}/decline` (`orders.approve`), with an optional `message` of up to 500 characters.
  - `pending_approval` → `declined`; tickets → declined; `sold −= n` per type.
  - Event: `ticketing.order_declined`, which sends the declined email, with the host's message if given.
- **AP3. Wrong state:** anything other than `pending_approval` → 409 `order.not_pending`. An unknown order, or one on another event → 404 `order.not_found`.

## 5. Waiting list (FR-6, Q5)
- **WL1. Promote next:**
  - `POST /v1/events/{id}/waitlist/promote` (`waitlist.promote`).
  - Takes the **oldest waitlisted order that fits**: its ticket count is within the free places, and every ticket type has room.
  - That order becomes `completed`, its tickets confirmed, and `sold += n`.
  - Event: `ticketing.order_completed`.
  - Tickets from before go-live that have no order are each treated as one-ticket orders.
- **WL2.** No waiting order → 404 `waitlist.empty`. Orders waiting, but none fits → 409 `waitlist.none_fits` "The next waiting group needs {n} places; {free} are free".
- **WL3. Counts:** the waitlist count is shown on the guest list.

## 6. Order status transitions

| From → To | By |
|---|---|
| (new) → completed, pending_approval, waitlisted | Admission (§2) |
| pending_approval → completed | Approve |
| pending_approval → declined | Decline |
| waitlisted → completed | Promote |
| completed, pending_approval, waitlisted → cancelled | U7 or later (not exposed now) |

Every other transition is refused (409).

## 7. Ticket page (FR-7.1, BT7)
`GET /v1/tickets/{code}` is public, with an optional viewer. It returns:
- the event summary (title, local start, where, time zone)
- the ticket type
- the display name
- the ticket number and total ("2 of 4")
- the status, check-in time, and QR payload (the ticket URL)
- `canCheckIn` for the viewer (`guests.checkIn` on the event)

The code must be 24 hex characters; anything else, or an unknown code, gives 404 `ticket.not_found`. Codes and links from before the split keep working.

## 8. Check-in (FR-7, Q6, US-8.1 to US-8.3)
- **CI1. Scan:** `POST /v1/events/{id}/check-in` `{ code }` (`guests.checkIn`). Limited by `checkin.scan`: 600 per minute per user, fail closed. The answer is always 200 with a `ScanResult`:

| Situation | Result |
|---|---|
| Confirmed and not yet checked in | `green` / `checked_in`, with display name, ticket type, "n of m", buyer name |
| Already checked in | `red` / `already_used`, with the time and the staff name who checked it in |
| Pending | `red` / `not_confirmed` |
| Waitlisted | `red` / `waitlisted` |
| Refunded | `red` / `refunded` |
| Cancelled or declined | `red` / `cancelled` |
| A code for another event | `red` / `wrong_event` |
| An unknown or malformed code | `red` / `not_found` |

- **CI2. Only one wins.** The check-in is a single conditional update (`… where checked_in_at is null and status = 'confirmed'`). Two devices scanning the same ticket at once: one green, one `already_used`.
- **CI3. From the guest list:** `POST /v1/events/{id}/guests/{ticketId}/check-in` (`guests.checkIn`) returns the same `ScanResult`.
- **CI4. Privacy:** answers are never shown at the door (Q6).
- Event: `ticketing.guest_checked_in`, in process only (metrics). It is not durable.

## 9. Guest list (FR-14.1, US-7.3, I2)
`GET /v1/events/{id}/guests` (`event.viewDashboard`), one row per ticket:
- **Filters:**
  - `status` (confirmed, pending, waitlisted, declined, cancelled, refunded, checked_in, not_checked_in)
  - `ticketTypeId`
  - `q`: name, email, email domain (`@company.com`), or ticket code prefix
- **Sort:** `sort` = `registered` (newest first, the default) or `checked_in` (newest first).
- **Pages:** `page`, `pageSize` (50 by default, at most 100).
- **Each row:**
  - ticket id, code, number of total
  - display name, buyer name and email
  - ticket type, status, registered at, checked-in at
  - answers, order id
- **Totals:** `total`, `waitlistCount` and counts per status.

## 10. CSV export (I3)
`GET /v1/events/{id}/guests.csv` (`guests.export`: owner, admin, finance). It takes the same filters as §9, with no paging.
- **Columns:** ticket code, ticket number, guest name, buyer name, buyer email, ticket type, status, registered at (event local time), checked in at, then one column per question.
- RFC 4180 quoting, UTF-8 with a BOM (opens in Excel).
- Cells starting with `=`, `+`, `-`, `@`, tab or CR are prefixed with `'` (CSV injection, SECURITY-05).
- At most 50,000 rows, streamed.
- The file name is `{slug}-guests-{yyyy-mm-dd}.csv`.
- The export is audited (`guests.exported`, with the row count).

## 11. My tickets (I7)
`GET /v1/me/orders?when=upcoming|past&cursor=` (signed in) returns the caller's orders, newest first. Each has:
- the event summary
- the order status
- the tickets (code, number, display name, ticket type, status, checked-in at)

`GET /v1/me/orders/{orderId}` returns one order. Another user's order → 404.

## 12. Tickets email (FR-11, D56, I1)
- **Trigger:** on `ticketing.order_completed`, **one email to the buyer's verified email** with every ticket:
  - each ticket's QR code (PNG, inline) and link
  - the display names
  - the event details and local time
- **Calendar (I1):** an `.ics` attachment (`METHOD:PUBLISH`, UID `{orderId}@gventz.com`, start and end in UTC, plus `X-WR-TIMEZONE`, location text, the event URL). With no end, the event is assumed to last 2 hours.
- **Pending (`ticketing.order_pending`):** a "Request received" email, with no QR.
- **Waitlisted:** a "You're on the waiting list" email.
- **Declined:** the declined email, with the host's message.
- **Delivery:** queued jobs with retries (U1). The job id is `order-tickets.{orderId}` (and `order-pending.…`, `order-waitlisted.…`, `order-declined.…`). The Resend idempotency key is the same value. A failed email never undoes an order.
- **Suppressions:** addresses on `email_suppressions` (global or for this event) aren't emailed. The tickets stay visible in "My tickets" and on the ticket page.

## 13. Dashboard counts (replaces the U3 read-side default)
`TicketingStats` is implemented by Ticketing:
- `confirmedCount`, `confirmedCounts`
- `deletionCounts`: guest count (confirmed, pending, waitlisted); paid count (confirmed or pending with an amount > 0)
- `dashboardCounts`: confirmed, pending, waitlisted, declined, checked in

## 14. Errors

| Code | HTTP | Message |
|---|---|---|
| `order.quantity_invalid` | 400 | Choose between 1 and 10 tickets. |
| `order.not_open` | 409 | This event is not open for registration. |
| `order.ticket_type_unavailable` | 409 | That ticket type isn't available. |
| `order.paid_not_supported` | 422 | Paid tickets are not available yet. |
| `order.sales_not_started` | 409 | Ticket sales have not started yet. |
| `order.sales_ended` | 409 | Ticket sales have ended. |
| `order.buyer_name_required` | 400 | Enter your full name. |
| `order.guest_name_invalid` | 400 | Guest names must be 2 to 120 characters. |
| `order.answer_required` | 422 | Please answer: {label} |
| `order.answer_invalid` | 422 | Choose one of the options for: {label} |
| `order.buyer_limit` | 409 | You can get {remaining} more ticket(s) for this event. |
| `order.not_enough_places` | 409 | Only {n} place(s) left. |
| `order.sold_out` | 409 | {name} is sold out. |
| `order.not_enough_tickets` | 409 | Only {n} {name} ticket(s) left. |
| `order.busy` | 503 | Lots of people are getting tickets right now. Please try again. (`Retry-After: 2`; NFR design Q2 A) |
| `export.busy` | 429 | An export is already running. Please try again in a minute. |
| `order.not_found` | 404 | Order not found. |
| `order.not_pending` | 409 | This request has already been decided. |
| `waitlist.empty` | 404 | Nobody is on the waiting list. |
| `waitlist.none_fits` | 409 | The next waiting group needs {n} places; {free} are free. |
| `ticket.not_found` | 404 | Ticket not found. |

## 15. Permissions added (application design v2 §5)
- `guests.export`: owner, admin, finance.
- `orders.approve`: owner, admin, editor. It already exists in U3's policy.

## 16. Audit
- `orders.approved`, `orders.declined` (order id, ticket count)
- `waitlist.promoted`
- `guests.exported`

Check-ins are recorded on the ticket (`checked_in_by`); they aren't audited separately, as today.
