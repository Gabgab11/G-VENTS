# Requirements — G-ventZ backend re-platform

## Intent Analysis

- **User request**: "review this code base, we need to redesign this to follow oop and use my aidlc approach to set rules and we need to opt from superbase to postgres db and introduce signup/login with google. i need a scalable and highly optimized backend" (full history in `aidlc-docs/audit.md`).
- **Request type**: Migration (Supabase to PostgreSQL, monolith to separate backend) + Refactoring (object-oriented redesign) + New Feature (Google sign-in).
- **Scope**: Cross-system. A new NestJS repository, this Next.js repository, the database, authentication, file storage, email.
- **Complexity**: Complex.
- **Depth**: Comprehensive.

## Decisions

| # | Decision | Source |
|---|---|---|
| D1 | Backend is a separate **NestJS 11** application (Node 22, TypeScript strict) in its own repository. | User |
| D2 | Backend hosted on **Render**. | User |
| D3 | Next.js frontend stays on **Vercel**. | User |
| D4 | **PostgreSQL** replaces Supabase. MongoDB considered and rejected. | User, Clarification 7 A |
| D5 | Sign-up and sign-in with **Google**. | User |
| D6 | **Object-oriented** design with NestJS dependency injection. | User |
| D7 | Work follows **AI-DLC**. | User |
| D8 | **Render Postgres** on Render's private network. | Q1 A |
| D9 | Region **Frankfurt** for API, database and Redis. Vercel functions pinned to `fra1`. | Q2 A |
| D10 | **Drizzle ORM**. Repositories map rows to domain entities. | Q3 A |
| D11 | Business rules in **NestJS domain and service classes**. The database keeps constraints only. Concurrency-critical writes use transactions with row locks. | Q4 A |
| D12 | **No row-level security.** Authorization in NestJS guards and policies only. One least-privilege database role. | Q5 A |
| D13 | Flyers on **Cloudinary**, behind a storage interface so S3 can replace it later. | Q6 |
| D14 | **Redis on Render with BullMQ** for jobs, caching and rate limits. | Q7 A |
| D15 | **Authentication built in NestJS**: Google OpenID Connect + email one-time code, short-lived access tokens, rotating refresh tokens, sessions in Postgres. | Q8 A |
| D16 | Sign-in methods: **Google and email 6-digit code**. | Q9 A |
| D17 | A Google sign-in **links automatically** to an existing account with the same verified email. | Q10 A |
| D18 | Web: **Next.js is a backend-for-frontend**. Tokens in httpOnly cookies on the Next.js domain; Next.js calls the API server to server. | Q11 A |
| D19 | Domain **`gventz.com`** (frontend). API at **`api.gventz.com`** (assumed). | Q11, Q12 |
| D20 | **Mobile app planned soon.** The API issues tokens to mobile clients directly. | Q13 A |
| D21 | **REST** with OpenAPI 3 generated from NestJS code. Typed clients generated for Next.js and mobile. | Q14, Clarification 3 A |
| D22 | **Tag-based caching** in Next.js. The API calls a signed revalidation endpoint when public data changes. | Q15 A |
| D23 | **Migrate all data**: users (same ids), events, registrations, tickets, flyers. Existing ticket links and QR codes keep working. | Q16 A |
| D24 | **One planned cutover** after full parity on staging, with a short read-only window. | Q17 A |
| D25 | Scope: **today's features + Google sign-in.** Payments, team invites, announcement sending and approve/decline come later; the design leaves room for them. | Q19 A |
| D26 | Design load: **small** (about 50 registrations a minute, 50,000 page views a day), with a stateless API that can scale out. | Q20 A |
| D27 | **99.5% availability**, up to 24 hours of data loss acceptable. | Q21 A |
| D28 | Observability: **structured logs** only, plus a health endpoint for Render. | Q22 C |
| D29 | Testing: unit, integration against real Postgres, API end-to-end, registration concurrency test, **80% line coverage**. The gate blocks the production cutover, not the first milestone. | Q23 A, Clarification 6 A |
| D30 | Extensions: Security **off**, Resiliency **off**, Property-Based Testing **on (full)**. | Extension questions |

## Milestones

| # | Milestone | Target | Done when |
|---|---|---|---|
| M1 | Core flows on Render | 2026-10-24 | NestJS runs on Render against a copy of staging data. These work end to end through the API: sign-in with email code and with Google, create event, register, view ticket, check in. |
| M2 | Full parity on staging | Before M3 | Every requirement below met on staging. The Next.js app runs on the API with no Supabase calls left. |
| M3 | Production cutover | By 2026-11-15 | Test gates (D29, PBT rules) pass, data migrated, frontend switched, Supabase read-only then retired. |
| M4 | Frontend design upgrade | By mid-November 2026 | Scope not defined yet (see Open Items, O1). |

The December event's date and size are not known yet. Mid-November is the readiness date.

## Target Architecture (context for the requirements)

```
+-------------+       +------------------------+       +------------------------+
| Browser     | ----> | Next.js on Vercel      | ----> | NestJS API on Render   |
| (web)       | https | gventz.com, fra1       | https | api.gventz.com         |
+-------------+       | BFF: cookies, cache    |       | Frankfurt              |
                      +------------------------+       +------------------------+
                                                          ^           |          
+-------------+                                          |           |           
| Mobile app  | -----------------------------------------+           |           
| (planned)   |   bearer tokens, direct to the API                   |           
+-------------+                                                      v           
                              +--------------+ +-------------+ +----------------+
                              | Postgres     | | Redis       | | Cloudinary     |
                              | (Render)     | | (Render)    | | (flyers)       |
                              +--------------+ +-------------+ +----------------+
```

Text alternative: browsers talk to Next.js on Vercel, which holds the session cookies and calls the NestJS API on Render. The planned mobile app calls the API directly with tokens. The API uses Render Postgres, Render Redis and Cloudinary in Frankfurt or nearby. The API also calls Google (sign-in and Places), Resend (email), and the outside event sources.

## Functional Requirements

Business transactions BT1–BT14 are defined in `reverse-engineering/business-overview.md`. Each requirement keeps today's behaviour unless it says otherwise.

### FR-1 Accounts and authentication (BT1, D15–D20)
1. **Email code sign-in and sign-up.** Request a 6-digit code by email. It expires after 10 minutes, allows 5 attempts, and only the latest code is valid. Code requests are rate limited per email address and per IP. The first successful sign-in creates the user and profile.
2. **Google sign-in and sign-up.** Authorization-code flow with PKCE, `state` and `nonce`. The ID token is validated. The email is accepted only when Google marks it verified.
3. **Account linking.** A Google sign-in whose verified email matches an existing user links to that user. Their events, registrations and tickets stay theirs. A user can have both methods.
4. **Sessions.** Access token lifetime 15 minutes. Refresh tokens rotate on every use, are stored hashed in Postgres, and expire after 30 days of inactivity. Reuse of an old refresh token revokes the whole session family.
5. **Web clients.** Next.js holds the tokens in `httpOnly`, `Secure`, `SameSite=Lax` cookies on `gventz.com`. Browser JavaScript never sees a token.
6. **Mobile clients.** The same sign-in flows return tokens to the app directly. They are revocable through the same sessions table.
7. **Sign-out** revokes the session on the server.
8. **Return path.** After sign-in the user returns to the page they came from, same-site paths only (today's `safeNextPath` rules).
9. **Existing users** keep their ids and sign in with an email code after the cutover. They need to do nothing else.

### FR-2 Events (BT2, BT3, BT11, BT12, BT14)
1. Create an event with its ticket types in one transaction. Today's validation applies: title 3–140, category from the list, start and end, up to 20 ticket types, location from Google Places or typed, visibility, approval, refund policy, cover theme, draft or published. Ticket prices stay free until payments exist.
2. Each event keeps its own IANA time zone. The API accepts any valid zone; `Africa/Lagos` is the default.
3. Hosts can change: details, visibility, attendee-count display, registration open or closed, capacity (whole number 1–1,000,000, or unlimited), cover theme, publish.
4. **Fix C1.** Editing the venue replaces all venue details together: name, address, city, region, country, country code, coordinates and place id. If the venue is typed by hand, the Google-only fields are cleared.
5. **Fix C2.** Location edits are validated with the same rules as event creation.
6. Cancel: owner or admin only. Closes registration.
7. Delete: owner only, after the typed title matches (trimmed, case-insensitive). Refused if any paid registration exists. Deletes the event's flyers.
8. Slugs: lowercase, `[a-z0-9-]`, with a random suffix so they can't be guessed. Unique.

### FR-3 Registration questions (BT4)
1. Kinds: text, options, social, company, terms, phone, website. At most 30 per event. Options questions need 2–30 distinct options. Terms questions are always required.
2. **Fix C3.** The 30-question limit and ordering hold under concurrent requests.

### FR-4 Registration (BT5)
1. Only a signed-in user can register. Name 2–120 characters. The ticket email is always the account's verified email.
2. Refused when: the event isn't published, registration is closed, the user already holds an active registration for the event, the ticket type is inactive or paid, the time is outside the sales window, a required answer is missing, or an options answer isn't one of the options.
3. Answers are stored by question id with the label copied in. Unknown keys are ignored. Each answer is capped at 1,000 characters.
4. If the event is at capacity (confirmed + pending), the new registration is **waitlisted**. Otherwise, if the ticket type has sold out, the request is refused. Otherwise it is **pending** when the event needs approval, else **confirmed**, and the ticket type's sold count goes up by one.
5. Two simultaneous requests can never exceed capacity or ticket quantity, and never create two active registrations for one user. Registration doesn't count every existing registration on each request (P3).
6. Each registration gets a unique 24-hex-character ticket code.

### FR-5 Waiting list (BT9)
1. A manager confirms the oldest waitlisted guest. That guest gets a ticket email.

### FR-6 Tickets and check-in (BT7, BT8)
1. Anyone with a ticket code can read the ticket. The response includes event, ticket type, status, check-in time, and whether the caller can check guests in.
2. Owner, admin, editor and check-in staff can check a confirmed guest in, from the guest list or from the ticket. A second check-in is refused.
3. Ticket codes and ticket links from before the migration keep working.

### FR-7 Email (BT6)
1. Ticket emails (today's HTML and text template, inline QR PNG) and sign-in code emails are sent through Resend.
2. Sending is a queued job with retries and backoff. A mail failure never undoes a registration. A job never sends the same email twice.
3. The sender domain is `gventz.com` once it is verified in Resend.

### FR-8 Flyers (BT3)
1. The API issues signed Cloudinary upload parameters to managers of the event. The browser uploads directly. The API then confirms the upload and saves it on the event.
2. JPG, PNG or WebP only, 5 MB maximum, enforced in the signed upload and checked again on confirm.
3. Replacing or removing a flyer deletes the old file. Deleting an event deletes all its files, with no 100-file limit.
4. Storage is behind a `FileStorage` interface (D13).

### FR-9 Discovery and public reads (BT13)
1. Featured upcoming public published events, optionally by category.
2. The public event page data includes event, ticket types, questions, whether the caller can manage the event, and the attendee count (only when the host shows it, or to staff). Private events are reachable by slug only. Drafts are visible to staff only.
3. Outside listings (Ticketmaster, PredictHQ, iCal) move to the API, cached in Redis for 1 hour, with a 4-second timeout per source. Links are limited to http(s).

### FR-10 Host dashboard (BT3, BT10, BT14)
1. The host's events with confirmed-registration counts, paginated.
2. Guest list for staff, paginated (50 per page), with waitlist count.
3. Draft announcements to a segment (all, paid, checked in, not checked in, waitlist). Sending stays out of scope (D25).
4. Dashboard theme saved on the profile.

### FR-11 Roles and permissions
1. Roles: owner (`events.owner_id`), admin, editor, checkin, finance, viewer (accepted `event_members`).
2. The permission matrix is the one enforced by today's database (see `reverse-engineering/api-documentation.md`). It is implemented once, as NestJS policies, and covered by tests.
3. Requests for an event the caller can't access get 404, so the API doesn't reveal that the event exists.

### FR-12 Venue search
1. Places autocomplete and details are proxied by the API for signed-in users. The Google key stays on the server.
2. Per-user limit: 60 a minute and 1,000 a day, held in Redis.

### FR-13 Cache revalidation (D22)
1. When public data changes (event created, edited, published, cancelled or deleted, ticket types, registration counts shown publicly), the API calls a revalidation endpoint on Next.js with the affected tags.
2. The call is signed (HMAC with a shared secret) and retried by the job queue.

### FR-14 Data migration (D23)
1. A migration tool copies from Supabase: `auth.users` to users (same id, email, verified flag), then profiles, events, ticket types, registrations (same ticket codes), questions, members, campaigns, suppressions and the audit log.
2. Flyers are copied from Supabase Storage to Cloudinary, and `cover_url` is rewritten.
3. The tool can be re-run safely. It reports row counts per table, source against target, and fails if they differ.
4. It is rehearsed on staging before the production cutover.

### FR-15 Frontend integration (D3, D18, D21)
1. The Next.js app replaces every Supabase call with the generated API client, called from the server only.
2. The sign-in page adds "Continue with Google" next to the email code.
3. Supabase middleware, clients and packages are removed.
4. A route receives revalidation calls (FR-13).

### FR-16 Operations
1. `GET /health/live` and `GET /health/ready` (database and Redis reachable) for Render.
2. Database migrations run as a deploy step, never by hand.

## Non-Functional Requirements

### NFR-1 Architecture and maintainability (D6, D10, D11)
- One NestJS module per bounded context: Identity (auth, users, sessions), Events, Registration (registrations, tickets, check-in, waiting list), Engagement (questions, announcements), Media (flyers), Discovery (public reads, outside listings, places), Notifications (email jobs), and a shared Platform module (database, Redis, queue, config, logging).
- Layers inside each module: thin controllers → application services (use cases) → domain entities and value objects that own the rules → repository interfaces → Drizzle repository implementations. Infrastructure (Drizzle, Cloudinary, Resend, Google) sits behind interfaces injected by NestJS.
- Request DTOs validated at the edge. Responses are typed DTOs documented in OpenAPI.
- Configuration validated at startup. The app refuses to start with missing settings.

### NFR-2 Performance (D26)
- At design load, measured on the API server: p95 under 150 ms for reads, under 300 ms for registration.
- One authentication check per request: the JWT is verified locally, with no network call.
- Public event pages are served from the Next.js cache (FR-13).
- Every list query is indexed and paginated. No N+1 queries.
- The API keeps a bounded connection pool to Postgres.

### NFR-3 Scalability
- The API is stateless (sessions in Postgres, rate limits and cache in Redis), so it can run on several Render instances.
- The registration design (FR-4.5) holds under concurrent requests on several instances.

### NFR-4 Availability and recovery (D27)
- 99.5% monthly availability.
- Daily backups at least. Point-in-time recovery if the Render plan includes it. Recovery time objective: 4 hours (assumed).
- Zero-downtime deploys using health checks.

### NFR-5 Security (functional; the Security extension is off)
- HTTPS only. Secrets only in Render and Vercel environment settings.
- Input length limits and validation on every field (today's `field()` limits).
- Same-site return paths only after sign-in.
- Rate limits on code requests, code checks, registration and Places.
- CORS allows only the frontend origins. The web app's tokens never reach browser JavaScript.
- Errors written for users are shown as they are. Anything else is logged and returned as a generic message.
- Outside links limited to http(s). Email HTML escapes every value.

### NFR-6 Observability (D28)
- Structured JSON logs with a request id that passes from Next.js to the API.
- No tokens, codes or full email addresses in logs.

### NFR-7 Testing (D29, D30)
- Unit tests for domain and services. Integration tests against real Postgres and Redis (Testcontainers). API end-to-end tests for every endpoint. A concurrency test for registration.
- 80% line coverage, enforced in CI before the production cutover.
- Property-based testing (fast-check) follows the PBT extension rules. The framework choice is confirmed in NFR Requirements (PBT-09). Candidate properties include: ticket code and slug generation, time-zone conversion round trips, capacity and quantity invariants under random registration sequences, refresh-token rotation, and the permission matrix.

### NFR-8 Compatibility
- Ticket codes, ticket URLs and event slugs from before the migration stay valid.
- Money stays integer minor units with an ISO 4217 currency.

## Out of Scope (D25)
Payments and paid tickets, team invitation UI, sending announcements, approve/decline screen, captcha, OpenTelemetry tracing, error monitoring service, full Content-Security-Policy.

## Open Items

| # | Item | Owner |
|---|---|---|
| O1 | **Frontend design upgrade** (due mid-November): scope not defined. Proposed: its own AI-DLC requirements pass in this repo once the API contract is stable. | Product owner |
| O2 | Name of the new backend repository. | Product owner |
| O3 | Confirm the API hostname `api.gventz.com` and set up DNS for both hostnames. | Product owner |
| O4 | Google Cloud: OAuth client, consent screen, redirect URIs for local, staging and production. | Product owner |
| O5 | Resend: verify `gventz.com` as a sender domain. Needed for sign-in code emails, not only tickets. | Product owner |
| O6 | Cloudinary account and an upload preset for flyers. | Product owner |
| O7 | Render plan: paid instances for the API (free instances sleep), Postgres with backups, Redis. | Product owner |
| O8 | Recovery time objective (assumed 4 hours). | Product owner |

## Risks

- **M1 in one day.** Feasible only for the core flows listed in M1, with the test gates deferred to M3 (Clarification 6 A). Anything left over moves into M2.
- **Sign-in codes depend on O5.** Without a verified sender domain, Resend only delivers to the account owner. Email-code sign-in will not work for real users until O5 is done.
- **Account linking** trusts Google's verified-email flag. Accounts on non-Google domains with a Google login are treated the same way.

## Traceability

| Requirement | Business transaction | Decision / answer |
|---|---|---|
| FR-1 | BT1 | D15–D20, Q8–Q13 |
| FR-2 | BT2, BT3, BT11, BT12, BT14 | D11, findings C1, C2 |
| FR-3 | BT4 | finding C3 |
| FR-4, FR-5 | BT5, BT9 | D11, finding P3 |
| FR-6 | BT7, BT8 | D23 |
| FR-7 | BT6 | D14, finding P6 |
| FR-8 | BT3 | D13, finding P7 |
| FR-9, FR-13 | BT13 | D22, finding P4 |
| FR-10 | BT3, BT10, BT14 | finding P8 |
| FR-11 | all | D12, finding P1/P2 |
| FR-12 | BT2 | D14 |
| FR-14 | all | D23, D24 |
| FR-15 | all | D3, D18, D21 |
