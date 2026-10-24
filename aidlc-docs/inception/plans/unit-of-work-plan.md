# Unit of Work Plan

The backend `gventz-api` is **one deployable service** (one build, API and worker roles, AD8), organized as modules. Units of work are therefore development slices of that service, plus the data migration and the frontend integration in this repository. User Stories were skipped, so the "story map" maps requirements (FR-x) and business transactions (BT1–BT14) to units.

Please fill in each `[Answer]:` tag with a letter, or X plus your own text, then tell me "done".

## Plan

- [x] 1. Collect and analyze answers below; ask follow-ups if needed
- [x] 2. Generate `aidlc-docs/inception/application-design/unit-of-work.md`
  - [x] 2.1 Unit definitions: purpose, modules and components, endpoints, tables, milestone
  - [x] 2.2 Code organization strategy for the new repository (directories, scripts, CI) and for this repository
  - [x] 2.3 Per-unit Construction stages to run (Functional Design, NFR, Infrastructure), as set in the execution plan
- [x] 3. Generate `unit-of-work-dependency.md`: dependency matrix, build order, what can run in parallel, M1 critical path
- [x] 4. Generate `unit-of-work-story-map.md`: every FR and BT1–BT14 assigned to a unit; M1 slice marked
- [x] 5. Validate: every requirement assigned exactly once as owner, no circular unit dependencies, M1 endpoints covered

## Questions

### Question 1 — How to split the backend into units
A) Seven units as proposed in the execution plan (Recommended):
- U1 Platform foundation
- U2 Identity
- U3 Events and Engagement (events, ticket types, members, permissions, questions, announcements)
- U4 Registration and Notifications (registration, waiting list, tickets, check-in, ticket and sign-in emails)
- U5 Discovery, Media and revalidation (featured list, outside listings, venue search, flyers, cache refresh)
- U6 Data migration
- U7 Frontend integration (this repo)

B) Fewer, bigger units: U1+U2 as "Foundation and Identity", U3+U4 as "Events and Registration", then U5, U6, U7

C) One unit per module (Platform, Identity, Events, Engagement, Registration, Media, Discovery, Notifications), then migration and frontend (10 units)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — Getting M1 (tomorrow) out of units that are bigger than M1
M1 needs only part of U3 and U4: create, publish and view an event; register; ticket; check in. Ticket emails can wait.

A) Design each unit in full once, but generate its code in two passes. The M1 slice goes first through U1 → U2 → U3 → U4. The rest of U3 and U4 follows in M2 under the same approved designs, so there's no second design round. (Recommended)

B) Finish each unit completely (all endpoints and tests) before starting the next. Simpler to track, but M1 will very likely slip.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — Who builds it
A) You with me (AI), one unit at a time in order (Recommended unless others are joining)

B) Several developers. Once U1 and U2 are done, U5, U6 and U7 run in parallel with separate owners (please name them after the letter)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4 — When the frontend switches over (U7)
A) In two parts. U7a, the sign-in pages with Google and email code plus the backend-for-frontend cookie layer, starts right after U2, so staging can be tried in a browser early. U7b replaces the remaining Supabase calls after U5. (Recommended)

B) All of U7 after every backend unit is done

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5 — Frontend design upgrade (M4, mid-November)
A) Keep it separate. U7 changes only how pages get data and sign people in, not how they look. The design upgrade gets its own AI-DLC pass in this repository once U7 is merged (open item O1). (Recommended, keeps the cutover small)

B) Combine it with U7, so pages are redesigned while they are switched to the API

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 6 — Where the data migration (U6) runs
A) A standalone TypeScript command in the backend repository (`scripts/migrate-from-supabase`). It reads Supabase with a read-only connection string and writes to Render Postgres. You run it from a machine or a Render one-off job: on staging first, then production during the cutover window. (Recommended)

B) Built into the API as an admin-only endpoint

X) Other (please describe after [Answer]: tag below)

[Answer]: A
