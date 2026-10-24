# U3 Events and Engagement — Business Rules

Today's rules (from `src/app/events/actions.ts`, `src/app/dashboard/[id]/actions.ts`, `events_guard`, `get_event_page`, `delete_event`) are kept unless a rule says otherwise.

## 1. Create an event (FR-2.1, FR-2.2, BT2)
`POST /v1/events`, signed in. Body:

```json
{
  "title": "Lagos Tech Meetup",
  "category": "Tech",
  "description": "...",
  "startsAt": "2026-12-05T18:00",
  "endsAt": "2026-12-05T21:00",
  "timeZone": "Africa/Lagos",
  "location": {
    "kind": "venue",
    "venueName": "Landmark Centre",
    "countryCode": "NG",
    "region": "Lagos",
    "city": "Victoria Island",
    "address": "...",
    "place": { "placeId": "...", "lat": 6.42, "lng": 3.45 }
  },
  "ticketTypes": [{ "name": "General", "quantity": 200, "currency": "NGN" }],
  "visibility": "public",
  "showAttendeeCount": true,
  "requireApproval": false,
  "refundPolicy": "...",
  "coverTheme": "sunset",
  "publish": false
}
```

- **CE1. Title and category.** Title 3–140 (`event.title_length`). Category from the list (`event.category_invalid`). Description ≤ 5,000. Refund policy ≤ 2,000.
- **CE2. Times (Q1 A).** `startsAt` is required. `endsAt` is optional, and if given must be after `startsAt` (`event.end_before_start`). Both are local wall-clock times in `timeZone`.
  - **A local time that doesn't exist** in that zone (a spring-forward gap) is refused: `event.time_not_in_zone`, "That time doesn't exist in this time zone because the clocks change. Pick another time."
  - **An ambiguous time** (fall-back) resolves to the earlier instant.
  - **Past start times** are allowed, as today.
- **CE3. Time zone (5.2 A).** If `timeZone` is given, it must be a valid IANA zone. If it's omitted:

| Location | Zone used |
|---|---|
| Venue with `place` coordinates | `TimeZoneLocator.zoneAt(lat, lng)` |
| Venue in a country with exactly one zone | That zone |
| Venue in a multi-zone country, without coordinates | Refused: `event.time_zone_required`, "Choose the event's time zone." |
| Online | Refused: `event.time_zone_required` |

- **CE4. Location** (§3).
- **CE5. Ticket types.**
  - **Count:** 1–20 (`event.ticket_types_count`).
  - **Name:** 1–80 characters; empty rows are dropped, as today.
  - **Quantity:** null or 1–1,000,000 (`event.ticket_quantity_invalid`).
  - **Price:** 0 only; anything else is `event.paid_tickets_unsupported`.
  - **Currency (5.3 A):** defaults to the venue country's currency, or USD for online. Any valid ISO 4217 code is accepted.
  - **Sales window:** optional, with end after start.
- **CE6. Display options.** Visibility defaults to `public`. `showAttendeeCount` defaults to true and `requireApproval` to false. `coverTheme` defaults to `minimal` when absent or unknown, as today.
- **CE7. Status.** `publish: true` creates the event `published`, and requires the owner, which the creator always is. Otherwise it's `draft`.
- **CE8. Slug.** Generated as in domain-entities. On a unique conflict, a new suffix is tried up to 3 times; after that the result is `event.slug_unavailable` (500-level; practically unreachable).
- **CE9. Transaction.** The event and its ticket types are created in one transaction. The response is 201 `{ id, slug, status }`. Event `events.event_created`.

## 2. Edit an event (FR-2.3–FR-2.5, BT3)

| Endpoint | Fields | Permission |
|---|---|---|
| `PATCH /v1/events/{id}` | title, description, refundPolicy, visibility, notifyRegistration | `event.edit` |
| `PUT /v1/events/{id}/location` | the whole location (§3) | `event.edit` |
| `PATCH /v1/events/{id}/settings` | showAttendeeCount, registrationOpen, capacity, coverTheme, visibility | `event.edit` |
| `POST /v1/events/{id}/publish` | — | `event.publish` |
| `POST /v1/events/{id}/cancel` | `{ confirm: true }` | `event.cancel` |

- **ED1.** Dates, time zone and ticket types can't be changed (Q2 A). Requests that include them are rejected as unknown fields (400).
- **ED2.** Only fields present in the body change. A field can be cleared with `null` where it's nullable (description, refund policy, capacity = unlimited).
- **ED3. Publish.** Moves `draft` to `published`. Publishing an already published event is a no-op (200). Publishing a cancelled event is refused: `event.cancelled`, "This event was cancelled."
- **ED4. Cancel.** Sets `cancelled` and `registrationOpen = false`. It needs `confirm: true` (`event.cancel_confirm`). Cancelling again returns `event.already_cancelled` (409). Audit `event.cancelled`. Event `events.event_cancelled`.
- **ED5. A cancelled event** can still have its details edited, as today, but `registrationOpen` can't be set back to true (`event.cancelled`).
- **ED6. Capacity.** May be set below the current number of guests; new registrations are then waitlisted (U4), as today.
- **ED7. Events.** Every successful edit records `events.event_updated` with the changed field names.

## 3. Location (FR-2.4, FR-2.5, fixes C1 and C2, 5.1 A)
- **LO1. Two kinds.** `kind: "venue"` or `kind: "online"`.
- **LO2. Venue fields.**
  - `venueName`: 1–300 characters, required.
  - `countryCode`: required, a code from `CountryCatalog` (`event.country_invalid`). The country name is filled from the catalog.
  - `region`: optional.
    - For a country with subdivisions, it must match one by name or code (`event.region_invalid`, "Choose a {label} from the list.") and is stored as the canonical name.
    - Otherwise it's free text ≤ 120.
  - `city`: ≤ 120. When it's empty, the region is used, as today ("venue · city · country").
  - `address`: ≤ 300.
- **LO3. Google place.** `place`, if present, needs a valid `placeId`, `lat` and `lng`. Without `place`, the address and the Google-only fields (place id, coordinates) are cleared. A typed venue never keeps old Google data (**C1**).
- **LO4. Replaced as a whole.** `PUT /location` replaces the location. No field from the previous location survives unless it's sent again (**C1**). The same validation as creation applies (**C2**).
- **LO5. Online.** Every venue column is stored null and `is_online` is true.

## 4. Delete an event (FR-2.7, BT12)
- **DE1. Check first.** `GET /v1/events/{id}/deletion-check` (`event.delete`) returns `{ title, guestCount, paidCount, canDelete }`.
  - `guestCount` counts registrations that are confirmed, pending or waitlisted.
  - `paidCount` counts confirmed or pending registrations with an amount > 0.
- **DE2. Delete.** `DELETE /v1/events/{id}` with `{ confirmTitle }`, owner only.
  - The typed title must match after trimming, ignoring letter case (`event.delete_confirm`).
  - Paid registrations block it (`event.has_paid_registrations`).
  - Rows are deleted by cascade: ticket types, registrations, questions, members, campaigns.
  - Audit `event.deleted` `{ eventId, title, guestCount }`, kept because `audit_log.event_id` is set to null.
  - Event `events.event_deleted`, with the cover public id so U5 deletes the files.
  - Returns 204.
- **DE3. Where the counts come from.** `RegistrationStats` (port) supplies them. U3 ships a read-side implementation (a query on `registrations`), and U4 replaces it.

## 5. Visibility and reads (FR-9.1, FR-9.2, FR-10, Q4 A)
- **VR1. Public page.** `GET /v1/events/by-slug/{slug}` is public, with an optional viewer.

| Event status | Guest / signed-in non-staff | Staff (any role) |
|---|---|---|
| published (public or private) | 200 | 200 |
| draft | 404 | 200 |
| cancelled | 404 (Q4 A) | 200 |

  - Private events are reachable by slug only. They never appear in lists.
- **VR2. Page content.**
  - **Event:** the event fields.
  - **Times:** `startsAt`/`endsAt` as instants and as local times, plus `timeZone`.
  - **Location:** the location fields.
  - **`registrationOpen`:** `registration_open` and published.
  - **`canManage`:** owner, admin or editor.
  - **Ticket types:** active only, ordered by price then creation, with `quantity`, `sold` and `remaining`.
  - **Questions:** ordered by position.
  - **`attendeeCount`:** the confirmed count, only when `showAttendeeCount` or the viewer is staff; otherwise `null`.
- **VR3. Featured.** `GET /v1/events/featured?category=&cursor=&limit=` (public): published, public, `startsAt ≥ now`, optional category. Ordered by `(startsAt, id)`, cursor pagination (U1 P2).
- **VR4. My events.** `GET /v1/me/events?page=&pageSize=`: events the caller owns or is an accepted member of, newest start first, with the confirmed count and the caller's role. Page-number pagination (U1 P1).
- **VR5. Dashboard summary.** `GET /v1/events/{id}` (`event.viewDashboard`).
  - The full event, including draft or cancelled.
  - Ticket types with sold.
  - Counts: confirmed, pending, waitlisted, checked in.
  - The caller's role and permissions, so the frontend can show the right controls.
- **VR6. Read models.** Read queries may join tables owned by other modules (for example counting `registrations`). Writes never cross modules (application design AD6; data ownership in component-dependency.md).

## 6. Permissions (FR-11, Q3 A — corrected from application design)

| Permission | owner | admin | editor | checkin | finance | viewer |
|---|---|---|---|---|---|---|
| `event.viewDashboard` (incl. drafts, guest list, counts) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `ticketTypes.viewUnpublished` | ✓ | ✓ | ✓ | | ✓ | ✓ |
| `event.edit` (details, location, settings, theme) | ✓ | ✓ | ✓ | | | |
| **`event.publish`** | ✓ | ✓ | | | | |
| `questions.manage` | ✓ | ✓ | ✓ | | | |
| `flyer.manage` | ✓ | ✓ | ✓ | | | |
| `waitlist.promote` | ✓ | ✓ | ✓ | | | |
| `announcements.draft` | ✓ | ✓ | ✓ | | | |
| `guests.checkIn` | ✓ | ✓ | ✓ | ✓ | | |
| `event.cancel` | ✓ | ✓ | | | | |
| `members.manage`, `audit.read` | ✓ | ✓ | | | | |
| `event.delete` | ✓ | | | | | |

- **PM1. Resolving the role.** The owner is `events.owner_id`. Otherwise the role comes from `event_members` where `user_id` = caller and `accepted_at` is not null. If several rows exist, the strongest role wins, in the order owner > admin > editor > checkin > finance > viewer.
- **PM2. No role.** No role, or an event that doesn't exist, returns **404** `event.not_found` (FR-11.3). A role without the permission returns **403** `event.forbidden`, "You don't have permission to do that for this event." The caller can see the event, so 403 doesn't reveal anything new.
- **PM3. Checked once per request.** The `EventPermissionGuard` resolves the role once per request and caches it in the request context, so services trust it.

## 7. Questions (FR-3, BT4, fix C3)
- **QU1. Add.** `POST /v1/events/{id}/questions` (`questions.manage`) with `{ label, kind, options?, required? }`.
  - Label 1–200 (`question.label_length`). Kind from the list (`question.kind_invalid`).
  - For `options`, options are split, trimmed (≤ 100 each), de-duplicated in order and capped at 30. At least 2 are needed (`question.options_count`). Other kinds ignore `options`.
  - `terms` is always required.
  - At most 30 questions (`question.limit`, "An event can have at most 30 questions.").
  - The new question gets position max + 1. Returns 201 with the question.
- **QU2. Concurrency (C3).** Adding or removing locks the event row first. Two concurrent adds at 29 questions give exactly one success and one `question.limit`. A unique `(event_id, position)` index is the last guard.
- **QU3. Remove.** `DELETE /v1/events/{id}/questions/{questionId}`. A question not on this event is `question.not_found` (404). Remaining positions aren't renumbered, as today. Returns 204.
- **QU4. List.** `GET /v1/events/{id}/questions` (`event.viewDashboard`), ordered by position.
- **QU5.** Each change records `engagement.questions_changed`.
- **QU6. Catalog for U4.** `QuestionCatalog.getForEvent(eventId)` returns the definitions for Registration's answer validation.

## 8. Announcements (FR-10.3, BT10)
- **AN1. Draft.** `POST /v1/events/{id}/announcements` (`announcements.draft`) with `{ subject 1–200, body 1–10,000, segment }`; segment defaults to `all`. Saved as `draft` with `created_by` = caller. Returns 201.
- **AN2. List.** `GET /v1/events/{id}/announcements` (`event.viewDashboard`), newest first.
- **AN3.** Sending, editing and deleting drafts are out of scope (D25, parity).

## 9. Reference data (5.1 A)
- **RD1. Countries.** `GET /v1/reference/countries` (public) returns `[{ code, name, currency, timeZones[], subdivisionLabel, hasSubdivisions }]`, sorted by name. `Cache-Control: public, max-age=86400`.
- **RD2. Subdivisions.** `GET /v1/reference/countries/{code}/subdivisions` (public) returns `[{ code, name }]`, sorted by name. An unknown country is 404 `reference.country_not_found`.
- **RD3. Default zone.** `GET /v1/reference/time-zone?lat=&lng=` (public, rate-limited by the global limit) returns `{ timeZone }` or 404 `reference.time_zone_not_found`. The form uses it to pre-select the zone after a Places pick.

## 10. Errors
| Code | HTTP | Message |
|---|---|---|
| `event.not_found` | 404 | Event not found. |
| `event.forbidden` | 403 | You don't have permission to do that for this event. |
| `event.title_length` | 400 | Event name must be 3 to 140 characters. |
| `event.category_invalid` | 400 | Choose a category. |
| `event.end_before_start` | 422 | The end must be after the start. |
| `event.time_not_in_zone` | 422 | That time doesn't exist in this time zone because the clocks change. Pick another time. |
| `event.time_zone_required` | 422 | Choose the event's time zone. |
| `event.country_invalid` | 400 | Choose a country from the list. |
| `event.region_invalid` | 400 | Choose a {label} from the list. |
| `event.ticket_types_count` | 422 | Add between 1 and 20 ticket types. |
| `event.ticket_quantity_invalid` | 400 | The quantity for "{name}" must be a whole number above 0. |
| `event.paid_tickets_unsupported` | 422 | Paid tickets are not available yet. |
| `event.cancelled` | 409 | This event was cancelled. |
| `event.already_cancelled` | 409 | This event is already cancelled. |
| `event.cancel_confirm` | 422 | Confirm that you want to cancel this event. |
| `event.delete_confirm` | 422 | Type the event name exactly to confirm. |
| `event.has_paid_registrations` | 409 | Events with paid tickets can't be deleted. |
| `question.label_length` | 400 | Questions must be 1 to 200 characters. |
| `question.kind_invalid` | 400 | Choose a question type. |
| `question.options_count` | 422 | Add at least 2 different options. |
| `question.limit` | 409 | An event can have at most 30 questions. |
| `question.not_found` | 404 | Question not found. |
| `announcement.fields_required` | 400 | Add a subject and a message. |
| `reference.country_not_found` | 404 | Country not found. |
| `reference.time_zone_not_found` | 404 | No time zone found for that place. |

## 11. Audit
| Action | When |
|---|---|
| `event.cancelled` | Cancel |
| `event.deleted` | Delete (meta: eventId, title, guestCount) |

Member role changes have no endpoint yet. When one exists, it records `member.role_changed`.
