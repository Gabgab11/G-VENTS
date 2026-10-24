# U1 Platform Foundation — Functional Design Plan

U1 has little business logic of its own. Its functional design fixes the conventions every other unit follows: the shared domain building blocks, the error model, the data model carried over from Supabase, identifiers, time, pagination and rate limiting. Infrastructure choices (Render, Docker, CI) come later in NFR and Infrastructure Design.

Please fill in each `[Answer]:` tag with a letter, or X plus your own text, then tell me "done".

## Plan

- [x] 1. Collect and analyze answers below
- [x] 2. `domain-entities.md`
  - [x] 2.1 Shared building blocks: `Entity`, `AggregateRoot`, `ValueObject`, `DomainError`, `DomainEvent`, `Clock`, `IdGenerator`, `Paginated`
  - [x] 2.2 Shared value objects used by several modules: `Email`, `Money`, `IanaTimeZone`, `Cursor` or `PageRequest`
  - [x] 2.3 Logical data model for every table, carried over from `supabase/migrations` with the changes agreed below (users, identities, sessions, sign-in codes, `events.active_count`; RLS, functions and `places_usage` removed)
- [x] 3. `business-rules.md`
  - [x] 3.1 Error model: error kinds → HTTP status, problem-details body, validation error shape, the generic 500 message
  - [x] 3.2 Identifier, time and money rules
  - [x] 3.3 Pagination rules
  - [x] 3.4 Rate-limit semantics (windows, keys, response when limited)
  - [x] 3.5 Domain event dispatch rules (after commit, ordering, handler failure)
  - [x] 3.6 Configuration rules (required settings per role; refuse to start when missing)
- [x] 4. `business-logic-model.md`: request lifecycle (request id → auth → validation → service → transaction → events → response or problem), worker job lifecycle (attempts, backoff, final failure logging)
- [x] 5. Testable Properties section (PBT-01) for every U1 component
- [x] 6. Validate against requirements (NFR-1, NFR-5, NFR-6, FR-16) and application design

## Questions

### Question 1 — Users and profiles
Today `auth.users` (Supabase) holds sign-in data and `public.profiles` holds name, email, country and dashboard theme, with the same id.

A) Merge them into one `users` table: id, email, email verified at, full name, country, dashboard theme, created at. Google links go in `user_identities`. One source of truth for the email; no join on every request. The migration (U6) combines both tables. (Recommended)

B) Keep `profiles` as today and add a separate `users` table for sign-in data

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — Table and column names
A) Keep today's names (`ticket_tiers`, `event_questions`, `email_campaigns`, `price_minor`, and so on), so the data migration is a straight copy. Code uses domain names (`TicketType`, `Question`, `Announcement`), and repositories map between the two. (Recommended)

B) Rename tables and columns to match the domain names (`ticket_types`, `questions`, `announcements`), with the migration mapping old to new

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — Pagination
Today the guest list uses page numbers (`?page=2`, 50 per page). The host's events list and the featured list are not paginated.

A) Page numbers (`page`, `pageSize`) for staff lists (guest list, host events), so the current dashboard keeps working as is. Cursor (`cursor`, `limit`) for public and infinite lists (featured events). Responses include `total` only for page-number lists. (Recommended)

B) Cursor everywhere (faster at large sizes, but the dashboard loses "jump to page N")

C) Page numbers everywhere

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4 — Ids for new rows
A) UUID version 7 for new rows. These are time-ordered, so indexes stay compact and inserts are faster. Existing UUID v4 ids are kept unchanged, and both live in the same `uuid` columns. (Recommended)

B) UUID version 4, as today

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5 — Audit log
The `audit_log` table exists today, but nothing writes to it.

A) Keep parity. Carry the table and its data over but don't write to it yet. Writing audit entries is added with team invites or payments later. (Recommended for the timeline)

B) Start writing audit entries now for sensitive actions: sign-in, event delete, cancel, check-in, role changes

X) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question 6 — Error messages shown to users
A) Every domain error has a stable machine `code` (for example `registration.closed`) and an English message. The frontend shows the API's message, or maps the code to its own wording. Validation errors list each field with its own message. Anything unexpected returns `internal_error` with "Something went wrong. Please try again." (Recommended)

B) The API returns codes only; all wording lives in the frontend

X) Other (please describe after [Answer]: tag below)

[Answer]: A
