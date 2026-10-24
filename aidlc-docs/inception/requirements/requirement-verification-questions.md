# Requirements Clarification Questions

Fill in the letter after each `[Answer]:` tag. Add a note after the letter if you want to explain. Options marked **(Recommended)** are what I would choose. Picking them is fine if you have no strong view.

## Decisions already made (not questions)

| # | Decision | Source |
|---|---|---|
| D1 | The backend becomes a separate **NestJS** application in its own repository, to be provisioned by the team. | User, 2026-10-23 |
| D2 | The NestJS backend is hosted on **Render** for now. | User, 2026-10-23 |
| D3 | The Next.js frontend stays on **Vercel**. | User, 2026-10-23 |
| D4 | Supabase is replaced by **plain PostgreSQL**: data, auth and storage. | User, 2026-10-23 |
| D5 | Users can **sign up and sign in with Google**. | User, 2026-10-23 |
| D6 | The backend is designed **object-oriented**: domain entities, services and repositories behind interfaces, using NestJS dependency injection. | User, 2026-10-23 |
| D7 | The work follows **AI-DLC** (this workflow). | User, 2026-10-23 |

## Assumptions (correct any that are wrong in the note at the end)

- Node.js 22 LTS, NestJS 11, TypeScript strict mode.
- The API is versioned under `/api/v1`.
- Money stays as integer minor units plus ISO 4217 currency. Each event keeps its own time zone.
- Every rule the database enforces today keeps holding: capacity, waiting list, one active registration per user, no double check-in, tickets only to the verified email, owner-only delete. See `reverse-engineering/business-overview.md`, BT1–BT14.
- The correctness bug C1 (stale venue details after an edit) is fixed as part of the rewrite.

---

## Part A — Platform and data

## Question 1
Where should the PostgreSQL database run?

A) Render Postgres, in the same region as the API, on Render's private network (Recommended: lowest latency, one provider, point-in-time recovery on paid plans) 

B) Neon (serverless Postgres, database branching for previews), in AWS Frankfurt

C) AWS RDS / Aurora

D) Keep the Supabase projects but use them only as plain Postgres for now, and move later

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2
Which region should the backend and database run in? Users are mainly in Nigeria. Render offers Oregon, Ohio, Virginia, Frankfurt and Singapore. Today's data is in London (eu-west-2).

A) Frankfurt, with Vercel functions pinned to `fra1` as well (Recommended: closest Render region to Lagos and to the current data)

B) A US region

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 3
Which database access layer should the NestJS repositories use?

A) Drizzle ORM: typed SQL, no runtime engine, SQL-first migrations (Recommended: full control over queries, and repositories map rows to domain entities)

B) Prisma: schema file, generated client, most widely used

C) MikroORM: class-based entities, unit of work and identity map (the most "classic OOP" option)

D) TypeORM: class-based entities with decorators

E) Kysely: a typed query builder only, with hand-written migrations

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4
Where should the business rules live after the move? Today they are mostly PL/pgSQL functions (`register_guest`, `create_event_with_tiers`, `check_in_guest`, ...).

A) In NestJS domain and service classes. The database keeps constraints only: foreign keys, checks, unique indexes. Concurrency-critical writes use transactions with row locks in the repository. (Recommended: one place for rules, unit-testable, matches D6)

B) Keep the PL/pgSQL functions and call them from NestJS repositories

C) A mix: rules in NestJS, but keep a few hot paths (such as registration) as database functions for speed

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 5
Should row-level security stay as a second line of defence?

A) No. The API is the only database client, using one least-privilege role, and all authorization is in NestJS guards and policies. (Recommended: simpler and faster. The public PostgREST endpoint that made RLS essential goes away.)

B) Yes. Keep RLS and have the API set the current user per transaction (`set_config('app.user_id', ...)`)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 6
Where should flyer images be stored?

A) Cloudflare R2 (S3-compatible, no egress fees), with browsers uploading directly through short-lived signed URLs (Recommended)

B) AWS S3, with signed URL uploads

C) A Render persistent disk (not recommended: it ties files to one instance)

X) Other (please describe after [Answer]: tag below)

[Answer]: Cloudinary for now, we can move to s3 when we move fully to aws

## Question 7
What should handle background jobs (ticket emails with retries, announcement sending, cleanup) and caching?

A) Redis on Render (Key Value) with BullMQ for queues, and the same Redis for caching and rate limits (Recommended: durable retries, scales out across API instances)

B) pg-boss: queues inside Postgres, no Redis (fewer moving parts, lower throughput)

C) No queue yet. Send emails in the request as today.

X) Other (please describe after [Answer]: tag below)

[Answer]: A 

---

## Part B — Authentication

## Question 8
How should authentication be built?

A) In the NestJS backend: Google OAuth 2.0 / OpenID Connect plus email one-time codes, short-lived access tokens with rotating refresh tokens, and sessions stored in Postgres so they can be revoked (Recommended: no extra vendor, full control, fits D4)

B) Keycloak, self-hosted (as in kore78-tmi), with NestJS validating its tokens

C) A hosted identity provider (Auth0, Clerk, Firebase Auth)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 9
Which sign-in methods should exist after the change?

A) Google and the existing email 6-digit code (Recommended: nobody loses access)

B) Google only

C) Google, email code, and email plus password

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 10
Someone signs in with Google using an email that already has a G-ventZ account (made with an email code). What should happen?

A) Link automatically to the existing account, because Google has verified the email (Recommended: they keep their events and tickets)

B) Link only after they also confirm with an email code

C) Create a separate account

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 11
The frontend (Vercel) and the API (Render) are on different hosts. How should the browser stay signed in?

A) Next.js acts as a backend-for-frontend. Session tokens live in httpOnly cookies on the Next.js domain. Browser requests go to Next.js, and Next.js calls the API server to server. (Recommended: no tokens in JavaScript, no cross-site cookies, server rendering keeps working)

B) The browser calls the API directly, with httpOnly cookies on a shared parent domain (needs both on custom domains, for example `gventz.com` and `api.gventz.com`)

C) The browser calls the API directly with bearer tokens it stores itself (not recommended: tokens readable by scripts)

X) Other (please describe after [Answer]: tag below)

[Answer]: A - https://gventz.com

## Question 12
Is there a custom domain? The email code mentions `gventz.com`. The live site is `g-vents.vercel.app`.

A) Yes. We own a domain and will point the frontend and the API at it (write the domain after the letter).

B) Not yet. Use the `vercel.app` and `onrender.com` addresses for now.

X) Other (please describe after [Answer]: tag below)

[Answer]: A 

## Question 13
Is a mobile app planned? It changes how tokens are issued.

A) Yes, soon. Design the API and auth for mobile clients from the start.

B) Maybe later. Keep the API client-neutral but optimize for the web now. (Recommended)

C) No

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Part C — API and integration

## Question 14
What style of API should NestJS expose?

A) REST with an OpenAPI 3 document generated from the NestJS code, and a typed TypeScript client generated from that for the Next.js app (Recommended)

B) REST with OpenAPI kept in a separate contracts repository as the source of truth (like the Kore78 projects)

C) GraphQL

X) Other (please describe after [Answer]: tag below)

[Answer]: A OR C - WE CAN EXPLORE GRAPHQL IF YOU THINK IT'S BETTER

## Question 15
How should Next.js learn that public data changed, so cached event pages stay fresh?

A) Next.js caches public pages and API reads with tags. The API calls a signed revalidation endpoint on Next.js when an event changes. (Recommended: public event pages served from cache)

B) Short time-based caching only (for example 60 seconds)

C) No caching. Every page view calls the API.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Part D — Migration and scope

## Question 16
What happens to the existing data in `gvents-prod` and `gvents-staging`?

A) Migrate everything: users (keeping their ids), events, registrations, tickets and flyers. Existing ticket links and QR codes keep working. (Recommended if real events or users are on production)

B) Migrate production only. Start staging fresh.

C) Start fresh. Nothing in production needs keeping.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 17
How should we switch over?

A) Build the NestJS backend to full parity, test it on staging, then switch the frontend over in one planned cutover with a short read-only window (Recommended: simpler, one source of truth at a time)

B) Gradually: move one feature at a time to NestJS while the rest stays on Supabase

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 18
Is there a deadline? PROGRESS.md mentions a December event.

A) Yes. The new backend must be live before a fixed date (write the date and the expected event size after the letter).

B) No fixed date. Quality first.

X) Other (please describe after [Answer]: tag below)

[Answer]: A - WE CAN COMPLETE THE BACKEND BY TOMORROW

## Question 19
What is in scope for this rewrite beyond today's features and Google sign-in?

A) Parity plus Google sign-in only. Pending features (payments, team invites, announcement sending, approve/decline) come later, but the design leaves room for them. (Recommended)

B) Parity, Google sign-in, plus some pending features (list them after the letter)

C) Everything on the PROGRESS.md "Not done yet" list

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Part E — Non-functional requirements

## Question 20
What peak load should the backend be designed and load tested for?

A) Small: about 50 registrations a minute and 50,000 page views a day

B) Medium: a ticket release with about 5,000 registrations in 10 minutes for one event, and 500,000 page views a day (Recommended as the design target, with headroom to scale out)

C) Large: 50,000 or more registrations in 10 minutes for one event

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 21
What availability and recovery targets?

A) 99.5% uptime. Up to 24 hours of data loss is acceptable (daily backups).

B) 99.9% uptime, at least 2 API instances, at most 5 minutes of data loss (point-in-time recovery), restore within 1 hour (Recommended)

C) Higher than that (write your targets after the letter)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 22
What should observability cover?

A) Structured JSON logs with request ids, Sentry for errors in both apps, health and readiness endpoints, and basic metrics (latency, error rate, queue depth) (Recommended)

B) Add OpenTelemetry tracing across Next.js, the API and the database on top of A

C) Logs only for now

X) Other (please describe after [Answer]: tag below)

[Answer]: C

## Question 23
What level of automated testing is required for the backend?

A) Unit tests for domain and services, integration tests against a real Postgres (Testcontainers), API end-to-end tests for every endpoint, a concurrency test for registration, and an 80% line coverage gate in CI (Recommended)

B) Unit and integration tests, no coverage gate

C) Minimal tests for now

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Part F — AI-DLC extensions

## Question: Security Extensions
Should security extension rules be enforced for this project?

A) Yes — enforce all SECURITY rules as blocking constraints (recommended for production-grade applications)

B) No — skip all SECURITY rules (suitable for PoCs, prototypes, and experimental projects)

X) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question: Resiliency Extensions
Should the resiliency baseline be applied to this project?

**What this extension is.** Enabling it applies a set of **directional, design-time best practices** for building resilient systems, derived from the **AWS Well-Architected Framework (Reliability Pillar)** and resilience-review guidance. It steers requirements, design, and code toward fault tolerance, high availability, observability, and recoverability — covering 15 practice areas across business goals, change management, observability, high availability, disaster recovery, and continuous improvement.

**What this extension is NOT.** Enabling it does **not** make your workload production-ready, nor does it certify or guarantee any availability, RTO, or RPO target. It is a **starting point** that scaffolds good resiliency decisions early — it is not a substitute for a formal **AWS Well-Architected Review** of the built system.

Treat the output as a well-grounded **first draft of your resiliency posture** to build on and validate — not a finished, production-certified result.

A) Yes — apply the resiliency baseline as directional best practices and design-time guidance (recommended for business-critical workloads, as an informed starting point that you can validate and harden before go-live)

B) No — skip the resiliency baseline (suitable for PoCs, prototypes, and experimental projects where rapid iteration matters more than reliability)

X) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question: Property-Based Testing Extension
Should property-based testing (PBT) rules be enforced for this project?

A) Yes — enforce all PBT rules as blocking constraints (recommended for projects with business logic, data transformations, serialization, or stateful components)

B) Partial — enforce PBT rules only for pure functions and serialization round-trips (suitable for projects with limited algorithmic complexity)

C) No — skip all PBT rules (suitable for simple CRUD applications, UI-only projects, or thin integration layers with no significant business logic)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Notes or corrections to the assumptions

[Answer]: 
