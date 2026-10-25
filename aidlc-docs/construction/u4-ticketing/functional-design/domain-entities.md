# U4 Ticketing — Domain Entities

**Answers used** (`construction/plans/u4-ticketing-functional-design-plan.md`, all A):
- Q1: groups never split; refused when places are short; waitlisted as a whole when the event is full.
- Q2: ticket 1 carries the buyer's name; others are optional, defaulting to "Guest of {buyer}".
- Q3: answers once per order.
- Q4: confirmed, pending and waitlisted tickets count towards the per-buyer limit.
- Q5: an order moves as a whole.
- Q6: scans answer green or red with a short reason; no answers at the door.
- Q7: research ideas I1 calendar invite, I2 guest search and filters, I3 CSV export, I4 declined status, I7 my tickets.

**Module:** `src/modules/ticketing/` (application design v2 §4.4, AD11, AD12). Paid orders and holds come in U7; this design leaves room for them.

## `Order` (aggregate)
One purchase by one buyer for one event. Every ticket created by the API belongs to an order.

| Field | Type | Notes |
|---|---|---|
| id | uuid v7 | |
| eventId | uuid | |
| buyerId | uuid | The signed-in user (profile) |
| kind | `free` \| `paid` | Only `free` until U7 |
| status | `OrderStatus` | See below |
| ticketCount | 1–10 | At most the event's per-buyer limit (D56) |
| answers | `AnswerSet` | Once per order (Q3). Copied to every ticket's `answers`, so the current guest list and exports keep working. |
| currency, amountMinor | | Free orders: 0 in the event currency. U7 adds fees and holds. |
| decidedAt, decidedBy | | Set on approve, decline and promote |
| createdAt, updatedAt | | |

**`OrderStatus`:**

| Status | Meaning | Tickets |
|---|---|---|
| `completed` | Tickets issued | confirmed |
| `pending_approval` | Approval event, waiting for the host | pending |
| `waitlisted` | Event full when ordered (Q1) | waitlisted |
| `declined` | The host declined the request (I4) | declined |
| `cancelled` | Reserved for later (refunds in U7, cancel by the guest) | cancelled |
| `awaiting_payment`, `expired` | Reserved for U7 | — |

**Behaviour:**
- `place(...)`
- `approve(now, by)`
- `decline(now, by)`
- `promote(now, by)`
- `cancel(...)`, used by U7 and later

Only the transitions in business-rules §6 are allowed.

## `Ticket` (entity; one row in `registrations`)

| Field | Column | Notes |
|---|---|---|
| id | `id` | |
| orderId | `order_id` (**new**, nullable) | Null only for tickets made by the current app before go-live |
| eventId, tierId | `event_id`, `tier_id` | |
| holderId | `user_id` | The buyer (all tickets are held by the buyer, D56) |
| number | `ticket_number` (**new**) | 1..n within the order |
| guestName | `guest_name` (**new**, nullable) | Q2. The display name is `guest_name`, else `attendee_name` for ticket 1, else "Guest of {buyer}". |
| attendeeName | `attendee_name` | The buyer's name, as the current app expects |
| attendeeEmail | `attendee_email` | The buyer's **verified** account email (project rule: tickets go to the verified email only) |
| status | `status` | confirmed, pending, waitlisted, cancelled, refunded, **declined** (new value) |
| code | `ticket_code` | 24 hex characters, unique, from the database default (pgcrypto) |
| amountMinor | `amount_minor` | 0 for free tickets |
| answers | `answers` | Copy of the order's answers |
| checkedInAt, checkedInBy | `checked_in_at`, `checked_in_by` | |

**Behaviour:**
- `checkIn(by, at)`: only confirmed tickets, once only.
- `void(reason)`: used by U7.

## `EventInventory` (aggregate; read with the event's ticket types locked)

| Field | Source |
|---|---|
| status, registrationOpen, requireApproval, capacity, perBuyerLimit | `events` |
| activeCount | **new** `events.active_count`: confirmed + pending tickets, kept in step by a database trigger (business-logic-model §3) |
| per ticket type: active, priceMinor, quantity, sold, salesStart, salesEnd | `ticket_tiers` (`sold` counts confirmed + pending, as today) |

**Behaviour:**
- `admit(request, allowance, now)` → `Admitted` \| `Pending` \| `Waitlisted`, or an error (business-rules §2).
- It updates `sold` per ticket type.

## `BuyerAllowance` (value)
- `held`: the buyer's tickets for the event with status confirmed, pending or waitlisted, including tickets from before go-live (`user_id` match).
- `limit`: the event's per-buyer limit.
- `remaining`: `limit − held`.

## Value objects
- `TicketCode`: `^[0-9a-f]{24}$`.
- `GuestName`: trimmed, 2–120 characters, or empty.
- `AnswerSet`: the U3 `QuestionCatalog` definitions applied to the answers given (rules as today, business-rules §3).
- `Quantity`: an integer from 1 to 10.
- `ScanResult`: `green` or `red`, plus a reason code (Q6).

## Read models (no aggregates)
- `TicketView` (ticket page)
- `GuestRow` (guest list and CSV)
- `MyOrder` (my tickets)
- `DashboardCounts` (replaces the U3 read-side default for `TicketingStats`)

## Tables (migrations in G-VENTS)
- **New `orders` table:** columns as above. RLS on with an API-only policy; `anon` and `authenticated` grants revoked.
- **`registrations`:** add `order_id` (references `orders`, `on delete cascade`), `ticket_number`, `guest_name`; add `declined` to the status check; index `(order_id)` and `(event_id, user_id, status)`.
- **`registrations_one_active_per_user`:** dropped. The current app's `register_guest` checks duplicates itself, under the event row lock, so it's unaffected (AD17).
- **`events.active_count`:** new, backfilled, maintained by a trigger on `registrations`.
- **No `order_lines` table:** each ticket's `tier_id` and `amount_minor` already describe the lines of a free order. U7 adds price snapshots when paid orders arrive.
