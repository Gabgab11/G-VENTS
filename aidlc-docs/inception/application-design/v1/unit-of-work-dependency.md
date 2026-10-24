# Unit of Work Dependencies

## Dependency matrix

Rows depend on columns. "Build" means it can't be coded until that unit exists. "Contract" means it needs only that unit's published API (OpenAPI) or interfaces.

| Unit ↓ depends on → | U1 | U2 | U3 | U4 | U5 | U6 | U7 |
|---|---|---|---|---|---|---|---|
| **U1** Platform | — | | | | | | |
| **U2** Identity | Build | — | | | | | |
| **U3** Events and Engagement | Build | Build (guard, `CurrentUser`) | — | Contract (`RegistrationStats` interface; pass 2 delete check) | | | |
| **U4** Registration and Notifications | Build | Build (`UserDirectory`, email core) | Build (`EventAccessService`, `QuestionCatalog`) | — | | | |
| **U5** Discovery, Media, revalidation | Build | Build | Build (`EventQueryService`, `EventCoverPort`) | Contract (`PublicCountChanged` event) | — | | |
| **U6** Data migration | Build (schema) | Build (users, identities) | Build (events, questions) | Build (registrations, counters) | Build (flyers to Cloudinary) | — | |
| **U7a** Frontend auth | | Contract (`/v1/auth/*`, `/v1/me`) | | | | | — |
| **U7b** Frontend rest | | Contract | Contract | Contract | Contract (+ revalidation webhook) | | — |

No circular dependency. U3 → U4 is an interface only: Events declares `RegistrationStats`, and Registration implements it in U4. Until then a stub returns "no paid registrations", which is true because there are no paid tickets (D25).

## Build order

```text
M1 (2026-10-24)
  U1 Platform (full)
    -> U2 Identity (full, incl. email core)
      -> U3 pass 1 (create, publish, public page)
        -> U4 pass 1 (register, ticket, check in)
          => M1 smoke test on Render against staging copy

M2 (target 2026-10-31)
  U7a Frontend auth          (needs U2 contract)
  U3 pass 2                  (rest of Events, questions, announcements, fixes C1-C3)
  U4 pass 2                  (guest list, waitlist, ticket email)
  U5 Discovery/Media/revalidation
  U7b Frontend rest          (needs U3, U4, U5 contracts)
  U6 Data migration          (needs final schema) -> staging rehearsal

M3 (by 2026-11-15)
  Build and Test gates -> U6 production run -> cutover

M4 (mid-November)
  Frontend design upgrade (separate AI-DLC pass, after U7)
```

## Critical path
U1 → U2 → U3 pass 1 → U4 pass 1 (M1), then U5 → U7b → U6 rehearsal → Build and Test → cutover (M3).

## Parallel work
Units run one at a time with one developer (Question 3 A). U7a, U5 and U6 have no dependencies on each other. If more people join, they can run side by side once U3 pass 2 is done.

## Integration checkpoints
| Checkpoint | When | What is verified |
|---|---|---|
| C-M1 | After U4 pass 1 | Email-code and Google sign-in, create and publish an event, register, view ticket, check in. Done through the API on Render against a staging copy. |
| C-U7a | After U7a | Browser sign-in on Vercel preview against the staging API; cookies httpOnly; refresh works |
| C-M2 | After U7b and U6 rehearsal | Every BT1–BT14 flow through the web app on staging; no Supabase calls; migration row counts match |
| C-M3 | Build and Test | 80% coverage, PBT suites, registration concurrency test, p95 targets |

## Shared resources and coordination
- **Database schema**: owned by U1. Later units add tables and columns through new Drizzle migrations only.
- **OpenAPI contract**: published by the API build and regenerated into this repository by U7 (`npm run api:generate`).
- **Secrets**: Render environment groups (`gventz-api-staging`, `gventz-api-prod`) and Vercel environment variables. The revalidation HMAC secret is shared by both sides.
