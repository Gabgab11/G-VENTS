# U3 Events and Engagement — Functional Design Delta (Change 1)

The approved U3 functional design (`domain-entities.md`, `business-rules.md`, `business-logic-model.md`, 2026-10-24) **still holds**. This delta records only what Change 1 adds or changes:
- Supabase stays
- several tickets per purchase
- payments later
- the U1 finding about the audit log

No new questions were needed: every point below follows from decisions already approved (D56, D42, AD17, U1 findings).

## Δ1. Purchase policy on `Event` (D56)
- New value object **`PurchasePolicy`**:
  - `perBuyerLimit`: an integer from 1 to 10, **default 10**. It's the most tickets one buyer can hold for the event, across all their orders. Enforced by U4.
  - `feeChoice`: `host_absorbs` (default) or `guest_pays` (D42). It's stored now; it's set through an endpoint in U7 (M4).
- **Create** (`POST /v1/events`) accepts an optional `perBuyerLimit`.
- **Settings** (`PATCH /v1/events/{id}/settings`, pass 2) can change it. A change applies to new orders only.
- New error: `event.buyer_limit_invalid` (400) "Choose a limit from 1 to 10 tickets per person."
- **Migration** (G-VENTS): `events.per_buyer_limit int not null default 10 check (per_buyer_limit between 1 and 10)` and `events.fee_choice text not null default 'host_absorbs' check (fee_choice in ('host_absorbs','guest_pays'))`. Additive only (AD17).

## Δ2. One currency per event (FR-2.3)
- Every ticket type on an event uses the same currency. Mixed currencies give `event.currency_mixed` (422) "All ticket types must use the same currency."
- The currency default still follows 5.3 A: the venue country's currency, or USD for online events.

## Δ3. Paid ticket types and the payout gate (FR-2.2, AD11)
- Until U7, prices must still be 0 (`event.paid_tickets_unsupported`, unchanged).
- `Event.publish()` asks the **`PayoutReadiness`** port when any ticket type is paid. U3 ships a stub that always answers "not ready", so nothing changes until U7 replaces it.
- Then the error becomes `event.payout_account_required` (422) "Connect a payout account before publishing paid tickets." This is defined now and used from U7.

## Δ4. Audit rows survive event deletion (U1 finding)
- In Supabase, `audit_log.event_id` is `on delete cascade`, so deleting an event also deletes its audit rows. Rule DE (§4, "audit survives") needs `on delete set null`.
- **Migration** (G-VENTS): drop `audit_log_event_id_fkey` and recreate it with `on delete set null`.
  - This changes behaviour for the current app too, for the better: its `delete_event` function's audit row is now kept.
  - Additive in effect: nothing that reads the audit log breaks.

## Δ5. The owner's profile must exist
- `events.owner_id` references `profiles(id)`.
- Before creating an event, the service calls Identity's new public **`ProfileProvisioner.ensure(user)`**, the same on-demand creation `GET /v1/me` uses (U2 Q3 A). This means a first-time host never hits a foreign-key error.

## Δ6. Mapping to the Supabase schema
The domain names in `domain-entities.md` map to existing columns:

| Domain | Column |
|---|---|
| time zone | `timezone` |
| venue country name / code | `country` / `country_code` |
| region | `region` |
| Google place | `place_id`, `lat`, `lng` |
| status | `status` |
| visibility | `visibility` |
| ticket types | `ticket_tiers` |
| members | `event_members` |
| questions | `event_questions` |
| announcements | `email_campaigns` |

Other mapping rules:
- Ticket types always get an explicit `currency`, so the column default `NGN` is never relied on.
- Supabase's `events_guard` trigger does nothing for API connections (`auth.uid()` is null). The API enforces those rules itself: owner and slug never change; only owner and admin can change status (permission matrix §6). NFR-8 tests prove it.
- *Added during code generation:* calling `auth.uid()` needs rights on the `auth` schema, which Supabase owns and migrations can't grant. So migration `20261024000600_events_guard_api_role.sql` makes the trigger return early for `current_user = 'gventz_api'`. It's otherwise unchanged; behaviour for every other role is the same.
- `create_event_with_tiers` and the other SQL functions are **not** used by the API. They stay for the current app until go-live (AD17).

## Δ7. Permission matrix additions (application design v2 §5)
`EventPermission` gains these permissions, which later units use. The roles holding them follow components.md §5:
- `event.fees`
- `orders.approve`
- `orders.view`
- `sales.view`
- `orders.refund`

## Δ8. Testable properties
- **Unchanged:** all 14 properties from business-logic-model §8.
- **Added:**
  - `PurchasePolicy` accepts the limit **iff** it's an integer from 1 to 10 (invariant).
  - Ticket types share one currency: any mixed set is refused (invariant).
