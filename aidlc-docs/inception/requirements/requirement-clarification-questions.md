# Requirements Follow-up Questions

Thank you for the answers in `requirement-verification-questions.md`. A few points need one more answer before the requirements can be written. Items already answered are listed under "Resolved". Fill in each `[Answer]:` tag.

## Resolved (answered in requirement-verification-questions.md)

- **Clarification 1, row-level security:** Q5 = A. No RLS; authorization lives in NestJS only.
- **Clarification 2, domain:** `gventz.com` (Q11). Assumed: the frontend at `gventz.com`, the API at `api.gventz.com`. Correct this in the notes below if it's wrong.
- **Clarification 4, scope:** Q19 = A. Today's features plus Google sign-in.

## Clarification 3 — REST or GraphQL (Question 14: "A OR C")
You asked for my view. I recommend **REST**:

- Next.js caches public event pages by URL and tag (your Question 15 answer). REST GETs fit that directly. GraphQL POSTs bypass HTTP and CDN caching unless persisted queries are added.
- Your mobile app (Question 13) can use the same OpenAPI document to generate its client.
- The data is a small set of resources (events, tickets, registrations, questions). That's where REST is simplest. GraphQL pays off when many clients need very different shapes of deeply connected data.
- NestJS guards, rate limits and per-endpoint caching are simpler on REST.

A) REST with OpenAPI 3 generated from the NestJS code, and typed clients generated for Next.js and mobile (Recommended)

B) GraphQL (code-first with NestJS), with REST only for auth callbacks and webhooks

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Clarification 5 — What "tomorrow" means (Question 18)
You wrote that the backend can be complete by tomorrow, 2026-10-24. Full parity, own auth with Google, the data and flyer migration, Redis queues, and the test gates you chose would normally take several days. Your Question 23 answer was 80% coverage plus integration and end-to-end tests, and the property-based testing extension is now blocking. AI-DLC also keeps a design approval gate before each unit's code. Which of these do you need by tomorrow?

A) The NestJS backend is running on Render against a copy of staging, with the core flows working end to end: sign-in with email code and Google, create event, register, ticket, check-in. Production cutover happens later, after the full test gates pass. (Recommended)

B) Every feature at parity, code-complete tomorrow. Tests and cutover follow.

C) Production cutover tomorrow

X) Other (please describe after [Answer]: tag below)

[Answer]: A

Also: what is the date of the December event, and roughly how many guests are expected? (Write it here.)

[Answer]: I DON'T KNOW, BUT WE SHOULD BE READY BY MID-NOVEMBER BOTH BACKEND AND FRONTEND DESIGN UPGRADE

## Clarification 6 — Test gates against the timeline
How should the test requirements (Question 23 A, plus property-based testing enforced) apply to the deadline?

A) Tests are written with each unit, but the 80% coverage gate and the full property-based suite only block the production cutover, not tomorrow's milestone (Recommended)

B) Keep every gate blocking from the start, even if tomorrow's milestone slips

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Clarification 7 — PostgreSQL or MongoDB (your question)
Should the database be MongoDB instead of PostgreSQL?

My recommendation is to stay on **PostgreSQL**:

- **The data is relational, and the rules depend on that.** Events have tiers, registrations, questions and members. Registration must, in one atomic step, check capacity, increment the tier's `sold` count, enforce one active registration per user per event, and issue a unique ticket code. Postgres does this with a single transaction, row locks and unique constraints. MongoDB can do it only with multi-document transactions, which are slower, have more limits, and are easier to get wrong.
- **Dashboards are joins and counts.** Events with registration counts, guest lists with tier names, attendee counts. In Postgres these are single indexed queries. In MongoDB they are `$lookup` pipelines, or data copied into several documents that must be kept in sync.
- **The data you're migrating is already in Postgres** (Q16). Moving to Postgres on Render is a dump and restore of the same schema. Moving to MongoDB means redesigning every table as documents and writing and testing a transform, which adds days to a tight timeline.
- **Hosting.** Render has managed Postgres on the same private network as the API (Q1). It has no managed MongoDB, so you'd add MongoDB Atlas as another provider, reached over the public internet with higher latency.
- **The flexible parts already fit.** Registration answers and question options are stored as `jsonb` columns, which give document-style flexibility inside Postgres.

MongoDB would make sense later for a separate, high-volume store with no strict rules, such as an activity feed or analytics events. It can be added next to Postgres then, behind the same repository interfaces.

A) PostgreSQL on Render, as already answered in Q1 (Recommended)

B) MongoDB (Atlas) for everything

C) PostgreSQL for the core data, plus MongoDB for a specific purpose (name it after the letter)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Requirements derived from your answers (no answer needed, correct them if wrong)

- **Web and mobile auth together.** The web app uses Next.js as a backend-for-frontend with httpOnly cookies (Q11). The mobile app (Q13) needs the API to also issue access and refresh tokens directly to mobile clients. Both flows use the same sessions table, so either can be revoked.
- **Flyer storage.** Flyers move to Cloudinary (Q6). Browsers upload directly with signed upload parameters from the API, so files never pass through Next.js or NestJS. Existing flyers are copied from Supabase Storage during the data migration (Q16), and `cover_url` values are rewritten. Storage sits behind an interface, so a later move to S3 is a new adapter, not a rewrite.
- **Scale.** Design target is the small load (Q20 A), but the API is stateless so it can scale out on Render, and registration avoids the current lock-and-count hot spot.
- **Monitoring.** Structured logs only (Q22 C). A health endpoint is still provided because Render needs one for zero-downtime deploys.
- **Existing protections kept.** The Security extension is off (answer B), but today's protections stay as functional requirements: input limits, safe redirects, tickets only to verified emails, owner-only delete, rate limits on Places and sign-in codes, and secrets kept on the server.
- **Availability.** The target is 99.5% with daily backups (Q21 A). Render Postgres paid plans include point-in-time recovery, which exceeds that target at no extra effort.

## Notes or corrections

[Answer]: 
