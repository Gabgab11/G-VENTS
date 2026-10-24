# Code Quality Assessment

## Test Coverage
- **Overall**: Poor for the backend, fair for pure helpers.
- **Unit Tests**: 5 Vitest files covering pure helpers (dates, locations, redirect, tilt physics, validation). No tests for any Server Action, auth guard, email or Places code.
- **Integration Tests**: 1 pgTAP file (registration rules, Places quota), run in CI on a throwaway database. No tests for event creation, check-in, waiting list, delete or RLS policies.
- **End-to-end / load**: None. No measurement of how registration behaves under concurrent load.

## Code Quality Indicators
- **Linting**: Configured (ESLint with Next.js rules) and enforced in CI, plus `supabase db lint`.
- **Code Style**: Consistent. Small functions, clear names, comments explain why.
- **Documentation**: Good. README, PROGRESS.md, supabase/README.md, and most files open with a purpose comment.

## Patterns and Anti-patterns

### Good Patterns (keep these in the redesign)
- Invariants enforced in one transaction in the database: capacity, waiting list, duplicate registration, sales window, double check-in, atomic event + tickets.
- Untrusted input is capped and validated: `field()` length limits, UUID checks, image type sniffed from bytes, `safeNextPath` against open redirects, outside links limited to http(s).
- Tickets only go to the account's verified email.
- No false "Saved": updates confirm a row changed.
- Errors raised on purpose are shown, everything else is logged and replaced (`userMessage`).
- Outbound calls have timeouts; outside listings are cached; the Google key never reaches the browser; a shared per-user Places quota.
- CI proves migrations apply in order and that generated types are current.

### Anti-patterns (with locations)

#### Architecture and OOP

| # | Finding | Where | Effect |
|---|---|---|---|
| A1 | No domain or service layer. Each Server Action is a transaction script that parses FormData, validates, authorizes, persists, sends email and redirects. | `src/app/**/actions.ts` | Use cases can't be reused (API, mobile, jobs) or unit tested without Next.js. |
| A2 | Data access inside UI. Pages and the five dashboard tab components build their own Supabase client and query tables. | `src/app/dashboard/[id]/*Tab.tsx`, `dashboard/page.tsx`, `e/[slug]/page.tsx` | No single place to optimize, cache or swap a query. |
| A3 | Business rules duplicated between TypeScript and SQL: role lists, title length, category list, the delete name comparison, image limits vs bucket limits. | `lib/auth.ts` vs `has_event_role`; `lib/categories.ts` vs `events.category` check; `sameName` vs `delete_event` | Rules drift; two places to change. |
| A4 | Vendor types in helper signatures (`SupabaseServerClient` parameters). | `lib/auth.ts`, `lib/ticket.ts`, `lib/places.ts`, `lib/event-page.ts`, `dashboard/getTheme.ts`, `lib/email/send-ticket.ts` | The data client can't be replaced without touching every caller. |
| A5 | RPC results cast to hand-written types instead of being validated. | `getEventPage`, `getTicket`, `deleteEvent` (`as DeleteCheck`) | A schema change breaks at runtime, not at compile time. |
| A6 | No API boundary. The backend exists only as Server Actions bound to pages. | whole app | A mobile app, partner integration or separate frontend has nothing to call. |

#### Coupling to Supabase (what the move to plain PostgreSQL must replace)

| # | Supabase feature | Where | Replacement needed |
|---|---|---|---|
| S1 | `auth.uid()` as the current user | 22 lines across 7 migrations: every RLS policy, `register_guest`, `create_event_with_tiers`, `check_in_guest`, `has_event_role`, `take_places_quota`, `delete_event` | Pass the user id explicitly, or set a per-transaction setting the policies read. |
| S2 | `auth.users` table | FKs from `profiles` and `places_usage`; `on_auth_user_created` trigger; `register_guest` reads the email from it | Own `users` / `accounts` / `sessions` tables. Existing user ids must be kept because `profiles`, `events`, `registrations` reference them. |
| S3 | Supabase Auth (email OTP, sessions) | `sign-in/page.tsx` (browser calls), `middleware.ts`, `lib/auth.ts`, `auth/actions.ts`, Supabase email templates and SMTP | An auth library or own implementation for email code and Google OAuth; own email sending for codes. |
| S4 | `anon` / `authenticated` roles and grants | every migration's `grant` / `revoke` | One application database role; authorization moves to the app (and optionally RLS via session settings). |
| S5 | PostgREST (`.from()`, `.rpc()`) | 22 files | A query layer (driver + query builder or ORM) and connection pooling. |
| S6 | Supabase Storage | `uploadFlyer`, `removeFlyer`, `deleteEvent`; `storage.objects` policies; `can_manage_event_folder` | Object storage (S3-compatible) with signed URLs. Existing `events.cover_url` values point at Supabase and are parsed by `flyerPath`, so files and URLs need migrating. |
| S7 | Generated types from Supabase CLI; CI uses `supabase db start` and `supabase test db` | `database.types.ts`, `ci.yml`, `package.json` scripts | Types from the new query layer; CI with a plain Postgres service container; pgTAP can still run. |

#### Performance and scalability

| # | Finding | Where | Effect at scale |
|---|---|---|---|
| P1 | Several auth round trips per request. Middleware calls `auth.getUser()` (a network call to Supabase Auth), the page calls it again, `requireEventRole` calls `has_event_role` over HTTP, then every query re-runs RLS. | `middleware.ts`, `lib/auth.ts` | 3–4 network hops before the first data query on every dashboard view. |
| P2 | RLS calls a `security definer` function per row. `reg_guest_read` and `tiers_public_read` call `has_event_role` for each row; the planner can't inline it. | baseline and hardening migrations | Guest list cost grows with page size × two subqueries per row. |
| P3 | Registration serializes per event and counts every time. `register_guest` locks the event row (`for update`) and then runs `count(*)` over the event's registrations to check capacity. | `20261022000400_registration_email.sql` | Fine for hundreds of guests. For a popular release, every registration queues behind the previous one, and each does a scan that grows with the guest count. |
| P4 | Highest-traffic pages are uncached. The event page and ticket page use the cookie client, so they render per request: `getUser` + `get_event_page`, then `public_attendee_count` (another `count(*)`) runs only after those two finish. | `e/[slug]/page.tsx`, `t/[code]/page.tsx` | Every share-link click costs 3 database or Auth calls; a viral event hits the database directly. |
| P5 | No connection pooling design. PostgREST pools connections today. Direct Postgres from Vercel functions opens a connection per function instance. | n/a (future) | Without a pooler (PgBouncer, RDS Proxy, Neon, Supavisor), connections run out under load. |
| P6 | Background work is not durable. Ticket emails run in `after()` with no retry or record; announcement sending isn't built. | `lib/email/send-ticket.ts` | A crash or Resend outage silently loses tickets; bulk announcements need a queue. |
| P7 | Flyers pass through a Server Action, so every action accepts 6 MB bodies. | `next.config.ts`, `uploadFlyer` | Larger request bodies on every action; function memory spent on file bytes. |
| P8 | Host event list is unpaginated. | `dashboard/page.tsx` | Slows down for hosts with many events. |

#### Correctness

| # | Finding | Where | Failure |
|---|---|---|---|
| C1 | Editing the venue in Settings leaves the old Google details. `updateEventDetails` updates `venue_name`, `city` and `country` but not `address`, `lat`, `lng`, `place_id`, `region` or `country_code`. | `src/app/dashboard/[id]/actions.ts:158-167` | A host renames the venue from "Eko Hotel" to "Landmark Centre". The ticket page and ticket email (`ticketPlace`) show "Landmark Centre, <Eko Hotel's address>, ...", and the stored coordinates still point at Eko Hotel. |
| C2 | Settings accepts any country and city text; create-event validates them against the list. | same | Data typed in Settings doesn't match what create-event would allow. |
| C3 | `addQuestion` counts, then inserts. | `src/app/dashboard/[id]/actions.ts:85-90` | Two quick submissions can both pass the 30-question limit and get the same `position`. |
| C4 | `deleteEvent` lists at most 100 flyer files. | `src/app/dashboard/[id]/actions.ts:271` | Files past 100 are left behind (storage cost only). |
| C5 | Time zone is fixed to Africa/Lagos on create. | `src/app/events/actions.ts` | Known limitation (PROGRESS.md item 10). |

## Technical Debt
- Business logic split across two languages (TypeScript actions and PL/pgSQL), with no tests on the TypeScript side.
- `event_members`, `email_campaigns`, `email_suppressions`, `audit_log` exist in the schema with no feature using them (no team invites, no sending, no audit writes).
- `reserve_ticket` is disabled but still defined.
- No error monitoring, no structured logging, no metrics or tracing.
- No full Content-Security-Policy (PROGRESS.md item 13).
- Infrastructure is configured by hand in dashboards; nothing is reproducible from the repo.

## Readiness for the requested change

| Requested | Touches | Notes |
|---|---|---|
| Object-oriented redesign | All actions, pages that query, `src/lib` data helpers | The pure helpers (dates, locations, themes, QR, email template, Places parsing) can move into the new structure mostly unchanged. |
| Supabase → plain PostgreSQL | S1–S7 above, plus a data migration of users, sessions and flyer files | The schema itself is ordinary Postgres. The work is in auth, roles, storage, the query layer and pooling. |
| Google sign-up / sign-in | S3; `profiles` and a new accounts/identities table | Must link to an existing account with the same verified email, or users end up with two accounts and lose their tickets. |
| Scalable, optimized backend | P1–P8 | Biggest wins: one auth check per request, caching public event pages, a counter instead of `count(*)` in registration, a pooler, a durable job queue for email. |
