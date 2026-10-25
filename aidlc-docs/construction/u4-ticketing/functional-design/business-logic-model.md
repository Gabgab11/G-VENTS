# U4 Ticketing — Business Logic Model

## 1. Place a free order (`OrderService.placeFreeOrder`)

```text
validate input (OR2, OR4, OR5)                         -> 400s, no database work
rate limit orders.place (user, IP; fail closed)        -> 429 / 503
questions = QuestionCatalog.getForEvent(eventId)
answers   = AnswerSet.from(input.answers, questions)   -> 422 (OR6)
[tx]
  inv = EventInventoryRepository.lockForPurchase(eventId)
        SELECT event ... FOR UPDATE                       (one row: serializes orders for this event)
        SELECT ticket_tiers WHERE id IN (...) FOR UPDATE  (fixed order by id)
  allowance = TicketRepository.heldByBuyer(eventId, buyerId)        (index: event_id, user_id, status)
  decision  = inv.admit(request, allowance, now)        -> 409s (OR3, OR7, §2)
  order     = Order.place(...decision)                  (status from the decision)
  tickets   = n Ticket rows (codes from the database default)
  OrderRepository.insert(order); TicketRepository.insertAll(tickets)
  EventInventoryRepository.save(inv)                    (sold per ticket type)
  -- events.active_count is updated by the trigger on registrations (§3)
  outbox: ticketing.order_completed | order_pending | order_waitlisted
[commit]
201 { orderId, status, tickets[] }
```

**Why one event-row lock and not a queue (AD12):**
- Each transaction is a few short indexed statements, about 5–10 ms.
- Serialising per event gives 100–200 orders a second for one event, which is above the 50/s burst target (D37). It's checked by the load test at 100/s (NFR).
- Different events never wait for each other.

## 2. Lock order (no deadlocks)
Every writer that touches inventory takes its locks in the same order:
1. the `events` row
2. the `ticket_tiers` rows, ordered by id
3. the `orders` and `registrations` rows

This applies to place, approve, decline, promote and, later, the U7 holds and refunds. The current app's `register_guest` also locks the event row first, so both apps serialize on the same row.

## 3. `events.active_count` (counter)
- **Meaning:** the number of tickets with status `confirmed` or `pending` for the event. It replaces counting every registration on each request (finding P3).
- **Maintained by a database trigger** on `registrations` (after insert, update of status, delete): it adds or subtracts 1 when a row enters or leaves {confirmed, pending}.
  - **Why a trigger:** until go-live both the current app and the API write `registrations` on the same database. A trigger keeps the count right whichever app writes, without changing the current app (AD17).
  - The trigger is data integrity (a derived count), not a business rule, so it fits D11.
- **Backfill:** set once in the migration from the existing rows.
- **Check:** a pgTAP test, and a property test in U4: after random sequences of writes, `active_count = count(confirmed, pending)`.

## 4. Approve, decline, promote

```text
[tx] lock event row -> lock tiers (by id) -> SELECT order FOR UPDATE -> its tickets
     approve:  order.approve(); tickets pending -> confirmed                (counts unchanged)
     decline:  order.decline(); tickets -> declined; tiers.sold -= n per type
     promote:  pick the oldest waitlisted order (or legacy waitlisted ticket) that fits;
               order.promote(); tickets -> confirmed; tiers.sold += n per type
     audit; outbox (order_completed | order_declined)
```

## 5. Check-in

```text
guard: guests.checkIn on :id                                 (EventPermissionGuard)
rate limit checkin.scan (fail closed)
row = SELECT ticket by code (unique index on ticket_code)
classify: not found | wrong event | status (§8 table)
UPDATE registrations SET checked_in_at = now(), checked_in_by = staff
 WHERE id = row.id AND status = 'confirmed' AND checked_in_at IS NULL
 RETURNING ...                     -> 1 row: green; 0 rows: re-read -> red already_used
```

- There's no event lock and no transaction beyond the single statement.
- That keeps it at about 2 queries per scan: the target is under 300 ms p95 at 5 scans a second, and it's far below that.

## 6. Reads
- **Guest list:** one paged query on `registrations` joined to `ticket_tiers` and `orders`, filtered by `event_id` (index `(event_id, status)` exists, `reg_event_idx`), with a count query. Search uses `ILIKE` on the name, email and email domain, within one event. With up to 20,000 rows per event, this is acceptable for staff use. Over 100 ms p95 in the load test, add a trigram index.
- **CSV:** the same query, streamed in batches of 1,000 rows from the `reports` pool (AD19).
- **My tickets:** orders of the buyer, newest first, plus tickets by order ids (two queries). Tickets from before go-live without an order are grouped one per ticket.
- **Ticket page:** one query (ticket, ticket type, event), plus the viewer's role (memoised).

## 7. Compatibility with the current app (AD17)
- The current app keeps working against the same database until go-live:
  - it creates single tickets without an order (`order_id` null)
  - the trigger keeps `active_count` right
  - `sold` is kept by both apps the same way
- **Dropping `registrations_one_active_per_user` doesn't weaken the current app:** `register_guest` checks "already registered" itself under the event lock.
- **The new `declined` status is invisible to the current app:** its screens only filter the statuses they know.

## 8. Testable Properties (PBT-01)

| Component | Property | Category |
|---|---|---|
| `EventInventory.admit` | For any inventory state (capacity, active count, per-type quantity and sold, approval flag) and any request, the decision equals the reference model in §2: waitlisted iff full; refused iff places or tickets are short; otherwise admitted or pending; `sold` changes by exactly the requested amounts only when admitted or pending | Oracle |
| Inventory sequence | For any sequence of place, approve, decline and promote: `sold ≤ quantity` per type; confirmed + pending ≤ capacity; `sold` per type = confirmed + pending tickets of that type; `active_count` = confirmed + pending (also checked against the database trigger in an integration test) | Stateful (PBT-06), Invariant |
| `BuyerAllowance` | Admitted iff `held + requested ≤ limit`; across any sequence of orders the buyer never holds more than the limit | Invariant |
| Order transitions | Only the transitions in business-rules §6 succeed; every other one fails with 409 | Oracle |
| `AnswerSet` | Unknown keys are dropped; values are at most 1,000 characters; required questions present; options from the list; normalising twice gives the same set | Invariant, Idempotence |
| CSV writer | For any cell values, parsing the written CSV gives back the same values (with the injection prefix removed); no cell starts with `= + - @` after writing | Round-trip, Invariant |
| ICS writer | For any event title, location and times, the output folds lines at 75 octets, escapes `, ; \` and new lines, and DTSTART/DTEND are the same instants in UTC | Round-trip, Invariant |
| Check-in | Concurrent scans of one ticket: exactly one green (integration test with parallel requests) | Concurrency |

**No PBT for:** controllers (end-to-end tests), Drizzle repositories (integration tests), email templates (snapshot tests of the rendered HTML and text).
