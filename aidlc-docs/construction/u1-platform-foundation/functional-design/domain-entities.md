# U1 Platform Foundation — Domain Entities

Answers used (u1-platform-foundation-functional-design-plan.md):
- **Q1 A:** one `users` table.
- **Q2 A:** today's table names.
- **Q3 A:** page numbers for staff lists, a cursor for public lists.
- **Q4 A:** UUID v7 for new rows.
- **Q5 B:** write audit entries now.
- **Q6 A:** error code plus English message.

## 1. Shared building blocks (`src/shared/domain`, `src/shared/kernel`)

These classes import nothing from NestJS, Drizzle or Node I/O.

| Class | Shape | Behaviour |
|---|---|---|
| `Entity<TId>` | `id: TId` | `equals(other)` by id and class |
| `AggregateRoot<TId>` | extends `Entity`; private `events: DomainEvent[]` | `protected record(e)`, `pullEvents()` returns and clears in recorded order |
| `ValueObject<TProps>` | frozen `props` | Constructor validates and throws a `DomainError` subclass; `equals(other)` by value |
| `DomainError` | `code: string` (dotted, stable), `kind: ErrorKind`, `message` (English, user-safe), `details?: Record<string, unknown>` | Never wraps infrastructure errors |
| `ValidationFailed` | `DomainError` with `kind: 'validation'` and `issues: { field, code, message }[]` | Raised by value objects and the request pipe |
| `DomainEvent` | `name: string`, `occurredAt: Date`, `aggregateId: string`, typed payload | Immutable |
| `Clock` | `now(): Date` | `SystemClock`; `FixedClock` for tests |
| `IdGenerator` | `uuid(): string` | `UuidV7Generator` |
| `PageRequest` | `page` (≥ 1), `pageSize` (1–100) | `offset = (page − 1) × pageSize` |
| `Page<T>` | `items`, `page`, `pageSize`, `total` | — |
| `CursorRequest` | `cursor?: Cursor`, `limit` (1–50) | — |
| `Cursor` | opaque string; base64url of a JSON array of the last row's sort keys | `Cursor.encode(keys)`, `Cursor.decode(str)` (throws `ValidationFailed` on any malformed input) |
| `CursorPage<T>` | `items`, `nextCursor: string \| null` | — |

`ErrorKind` = `validation` | `invalid` | `not_found` | `conflict` | `unauthenticated` | `forbidden` | `rate_limited` | `unavailable`.

## 2. Shared value objects

| Value object | Rules |
|---|---|
| `Email` | Trimmed and lowercased. 3–254 characters. Matches `^[^@\s]+@[^@\s]+\.[^@\s]+$`, the same rule as today. `toString()` returns the normalized form. `masked()` returns `a***@domain` for logs. |
| `Money` | `amountMinor`: a safe integer ≥ 0 (kobo, cents). `currency`: ISO 4217, three uppercase letters. `add` and `subtract` only within the same currency (`CurrencyMismatch`); the result is never negative. `isZero()`. No floats anywhere. |
| `IanaTimeZone` | Accepted when `Intl.DateTimeFormat` accepts it as a `timeZone`. Stored as given (for example `Africa/Lagos`). Default `Africa/Lagos` is applied by the Events module, not here. |
| `UserId` | UUID string (v4 or v7). Used across modules. |

## 3. Logical data model

Carried over from `supabase/migrations`, with the names unchanged (Q2 A). The changes are listed after the tables.

New Identity tables (`user_identities`, `sessions`, `sign_in_codes`) are designed in U2 Functional Design and added by a U2 migration. This refines unit-of-work.md, which listed them under U1. U1 creates `users` because every other table references it.

### users (replaces `auth.users` + `profiles`, Q1 A)
| Column | Type | Rules |
|---|---|---|
| id | uuid PK | Kept from Supabase for existing users; v7 for new ones |
| email | text not null | Normalized `Email`; unique on `lower(email)` |
| email_verified_at | timestamptz null | Set by a successful code sign-in or a verified Google email |
| full_name | text null | 2–120 characters when set |
| country | text null | ISO alpha-2 or a name from the app's list (as today) |
| dashboard_theme | text not null default `'minimal'` | One of the 10 themes (today's check constraint) |
| created_at, updated_at | timestamptz not null | — |

### events
The columns are unchanged:
- **Identity and content:** id, owner_id → users, title (3–140), slug (unique, `^[a-z0-9-]+$`), description, category (check list).
- **Time:** starts_at, ends_at, timezone.
- **Location:** is_online, venue_name, address, city, region, country, country_code (`^[A-Z]{2}$`), lat and lng (in range), place_id.
- **Display:** cover_url, cover_theme (check list).
- **Settings:** capacity (> 0 or null), refund_policy, status (draft, published, cancelled), visibility (public, private), show_attendee_count, require_approval, registration_open, notify_registration.
- **Timestamps:** created_at, updated_at.

**Added**:
| Column | Type | Rules |
|---|---|---|
| active_count | integer not null default 0 | Confirmed + pending registrations. ≥ 0. Written only by Registration (U4). Backfilled by U6. |
| cover_public_id | text null | Cloudinary public id of the current flyer, so it can be deleted (U5) |

### ticket_tiers
Unchanged: id, event_id → events (cascade), name, price_minor (≥ 0), currency, quantity (> 0 or null = unlimited), sold (≥ 0, ≤ quantity), sales_start, sales_end, is_active, created_at.

### registrations
Unchanged: id, event_id, tier_id, user_id → users (set null), attendee_name, attendee_email, status (pending, confirmed, waitlisted, cancelled, refunded), amount_minor, payment_ref (unique), ticket_code (unique, 24 hex), answers (jsonb), checked_in_at, checked_in_by → users, created_at. Unique index: one active registration per (event_id, user_id).

### event_questions, event_members, email_campaigns, email_suppressions
Unchanged, with foreign keys pointing to `users` instead of `profiles`.

### audit_log (written from now on, Q5 B)
| Column | Type | Rules |
|---|---|---|
| id | bigint identity PK | — |
| event_id | uuid null → events **on delete set null** (was cascade) | So an event's deletion entry and its history survive the delete |
| actor_id | uuid null → users (set null) | Null for system actions |
| action | text not null | One of the actions in business-rules.md §7 |
| meta | jsonb not null default `{}` | No tokens, codes or email addresses |
| created_at | timestamptz not null | — |

Indexes: `(event_id, created_at desc)`, `(actor_id, created_at desc)`.

### Removed
- Row-level security policies and grants.
- All PL/pgSQL functions and triggers, with their rules moved to domain classes:
  - `has_event_role`, `create_event_with_tiers`, `get_event_page`, `public_attendee_count`, `register_guest`, `promote_next_waitlisted`, `check_in_guest`, `get_ticket`, `event_delete_check`, `delete_event`, `take_places_quota`, `can_manage_event_folder`, `reserve_ticket`.
  - The `handle_new_user`, `events_guard` and `touch_updated_at` triggers.
- `places_usage` (replaced by Redis counters).
- The storage policies and the `auth` schema dependency.
- Check constraints, unique indexes and foreign keys stay as the database's last line of defence.

## 4. Platform entities

| Entity | Purpose |
|---|---|
| `AuditEntry` | `{ action, actorId?, eventId?, meta }`, written through `AuditTrail.record()` in the current transaction |
| `RateLimitPolicy` | `{ name, windows: { seconds, limit }[], onStoreFailure: 'allow' \| 'deny' }` |
| `ProblemDetails` | The HTTP error body (business-rules.md §1) |
| `JobOptions` | `{ jobId, attempts, backoff, removeOnComplete }`, standard per queue (business-rules.md §6) |
