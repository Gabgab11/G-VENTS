# API Documentation

G-ventZ has no public REST API. The server surface is two JSON Route Handlers, a set of Next.js Server Actions (form POSTs), and the database functions the app calls through PostgREST.

## REST APIs

### Places autocomplete
- **Method**: GET
- **Path**: `/api/places/autocomplete?q=&country=&region=&session=`
- **Purpose**: Venue suggestions for the create-event form.
- **Request**: `q` (2–120 chars), `country` (ISO alpha-2 from the app's list), `region` (optional, 120 chars), `session` (8–64 chars `[A-Za-z0-9-]`, Google session token).
- **Response**: `200 { suggestions: [{ placeId, main, secondary }] }`; `400 bad_request`; `401 signed_out`; `429 rate_limited`; `502 unavailable`; `503 not_configured`. Always `Cache-Control: no-store`.

### Place details
- **Method**: GET
- **Path**: `/api/places/details?id=&session=`
- **Purpose**: Address, city, country and coordinates for a chosen suggestion.
- **Request**: `id` (Google place id, `[A-Za-z0-9_-]{10,300}`), `session`.
- **Response**: `200 { place: { placeId, name, address, city, countryCode, lat, lng } }`; same error codes as above.

## Internal APIs

### Server Actions

All take `FormData` unless noted. Dashboard actions redirect to `/dashboard/<id>?tab=<tab>&ok|err=<code>`.

| Action | File | Guard | Calls |
|---|---|---|---|
| `signOut()` | `app/auth/actions.ts` | none | `auth.signOut` |
| `createEvent(prev, fd)` | `app/events/actions.ts` | `requireUser` | `rpc create_event_with_tiers` |
| `registerGuest(prev, fd)` | `app/e/[slug]/actions.ts` | signed-in | `rpc register_guest`, `rpc get_ticket`, Resend |
| `checkInFromTicket(fd)` | `app/t/[code]/actions.ts` | `get_ticket.can_check_in` | `rpc check_in_guest` |
| `updateEventSetting(id, field, value)` | `app/dashboard/actions.ts` | signed-in + `has_event_role` | `events.update` |
| `setDashboardTheme(fd)` | `app/dashboard/actions.ts` | signed-in | `profiles.update` |
| `setRegistrationOpen`, `setCapacity`, `updateEventDetails`, `updateEventTheme` | `app/dashboard/[id]/actions.ts` | `requireEventRole` (manage) | `events.update` |
| `addQuestion`, `deleteQuestion` | same | manage | `event_questions` count/insert/delete |
| `checkInGuest` | same | owner/admin/editor/checkin | `rpc check_in_guest` |
| `promoteFromWaitlist` | same | manage | `rpc promote_next_waitlisted`, Resend |
| `createAnnouncement` | same | manage | `email_campaigns.insert` |
| `uploadFlyer`, `removeFlyer` | same | manage | `storage.upload/remove`, `events.update` |
| `cancelEvent` | same | owner/admin | `events.update` |
| `deleteEvent` | same | owner (via `event_delete_check`) | `storage.list/remove`, `rpc delete_event` |

### Database functions (called through PostgREST `rpc`)

| Function | Returns | Callable by | Purpose |
|---|---|---|---|
| `has_event_role(p_event uuid, p_roles text[])` | boolean | anon, authenticated | Owner of the event, or an accepted member with one of the roles. Used by RLS. |
| `create_event_with_tiers(p_event jsonb, p_tiers jsonb)` | events row | authenticated | Inserts event + tiers in one transaction; owner = `auth.uid()`. |
| `get_event_page(p_slug text)` | jsonb | anon, authenticated | Event, tiers, questions, `can_manage`; private events by slug; drafts for staff only. |
| `public_attendee_count(p_event uuid)` | int or null | anon, authenticated | Confirmed count when the host shows it, or to staff. |
| `register_guest(p_event, p_tier, p_name, p_email, p_answers jsonb)` | registrations row | authenticated | All registration rules (see business-overview BT5). `p_email` is ignored. |
| `promote_next_waitlisted(p_event uuid)` | registrations row | authenticated (manage) | Confirms the oldest waitlisted guest. |
| `check_in_guest(p_registration uuid)` | registrations row | authenticated (staff) | Sets `checked_in_at`/`by`; refuses a second check-in. |
| `get_ticket(p_code text)` | jsonb | anon, authenticated | Ticket by code with event, tier and `can_check_in`. |
| `event_delete_check(p_event uuid)` | jsonb | authenticated | Title, `is_owner`, guest and paid counts. |
| `delete_event(p_event uuid, p_confirm_title text)` | void | authenticated (owner) | Deletes after re-checking owner, title and no paid registrations. |
| `take_places_quota()` | boolean | authenticated | Atomic per-user counter: 60/minute, 1000/day. |
| `can_manage_event_folder(p_name text)` | boolean | storage policies | Storage path `<event_id>/...` belongs to an event the user manages. |
| `reserve_ticket(...)` | — | nobody (revoked) | Legacy anonymous reservation, disabled. |
| `handle_new_user()`, `events_guard()`, `touch_updated_at()` | trigger | triggers only | Profile on sign-up; field-level rules on event updates; `updated_at`. |

## Data Models

### profiles
- **Fields**: `id` (= `auth.users.id`), `full_name`, `email` (unique), `country`, `dashboard_theme`, `created_at`.
- **Relationships**: owns `events`; referenced by `registrations.user_id`, `event_members.user_id`.
- **Validation**: Created only by the `on_auth_user_created` trigger.

### events
- **Fields**: `id`, `owner_id`, `title` (3–140), `slug` (unique, `[a-z0-9-]`), `description`, `category` (check list), `starts_at`, `ends_at`, `timezone`, `is_online`, `venue_name`, `address`, `city`, `region`, `country`, `country_code`, `lat`, `lng`, `place_id`, `cover_url`, `cover_theme`, `capacity`, `refund_policy`, `status`, `visibility`, `show_attendee_count`, `require_approval`, `registration_open`, `notify_registration`, `created_at`, `updated_at`.
- **Relationships**: has many `ticket_tiers`, `registrations`, `event_questions`, `event_members`, `email_campaigns`.
- **Validation**: Check constraints; `events_guard` trigger limits who may change status/owner.

### ticket_tiers
- **Fields**: `id`, `event_id`, `name`, `price_minor`, `currency` (NGN), `quantity`, `sold`, `sales_start`, `sales_end`, `is_active`.
- **Validation**: `sold <= quantity`; paid tiers refused by `register_guest`.

### registrations
- **Fields**: `id`, `event_id`, `tier_id`, `user_id`, `attendee_name`, `attendee_email`, `status`, `amount_minor`, `payment_ref`, `ticket_code` (24 hex, unique), `answers` (jsonb), `checked_in_at`, `checked_in_by`, `created_at`.
- **Validation**: One active registration per user per event (partial unique index).

### event_questions
- **Fields**: `id`, `event_id`, `label`, `kind`, `options` (text[]), `required`, `position`.

### event_members
- **Fields**: `event_id`, `user_id`, `invited_email`, `role`, `invited_at`, `accepted_at`.
- **Note**: Supported by permissions but no UI creates rows yet.

### email_campaigns, email_suppressions, audit_log
- **Purpose**: Draft announcements; addresses that must not be mailed; staff-readable audit trail. Sending and audit writes are not built yet.

### places_usage
- **Fields**: `user_id`, minute and day windows with counters, for `take_places_quota`.
