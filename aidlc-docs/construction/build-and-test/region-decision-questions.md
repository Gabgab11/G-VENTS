# Decision Needed: Where the API and the Database Run

**Why this matters now:** the load test showed that one event's order rate depends on round trips between the API and Postgres inside the event lock (about 9 per order; see performance-test-instructions.md).

| Placement | Orders/s on one event |
|---|---|
| Render (Frankfurt, `render.yaml`) + Supabase **eu-west-2 London** (README) | about **7–9** |
| Same region | about **65–100** |

The December event needs bursts of 50/s.

Render has no London region. Supabase offers eu-central-1 (Frankfurt).

Put your choice after the `[Answer]:` tag, and save the file before replying.

## Question 1 — Placement for go-live
A) **Move Supabase to Frankfurt (eu-central-1):**
   - create the staging and production projects there and apply the migrations
   - copy the current production data before go-live (small today)
   - switch the website and the API to the new projects
   - Render stays in Frankfurt
   - About a day of owner work plus a short cut-over (O9).
   - (Recommended: fixes the cause; no code changes.)

B) **Keep Supabase in London and move the API to a host with a London region** (for example Fly.io `lhr`). It replaces the Render decision (AD3): new deploy config, alerts and runbooks; about 2–3 days.

C) **Keep both as they are and change ordering to batched admission:**
   - orders are queued, and one worker per event admits them in batches of up to 50 per transaction
   - the website shows "getting your tickets…" and then the result
   - about 3–4 days in U4 and U6a, and new tests

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2 — Restore drill (go-live gate)
The drill needs point-in-time recovery switched on in the production project (O19). Who runs it?

A) **You switch on PITR; I write the step-by-step drill (restore to a new project, check counts, time it), and you run it with me on staging first.** (Recommended)

B) Skip the drill for go-live and run it in the first week after.

X) Other (please describe after [Answer]: tag below)

[Answer]: A
