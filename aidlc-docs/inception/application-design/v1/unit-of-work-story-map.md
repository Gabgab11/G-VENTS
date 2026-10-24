# Unit of Work — Requirement Map

User Stories were skipped. This map assigns the requirements (FR, NFR) and today's business transactions (BT1–BT14) to units instead. "Owner" is the unit that delivers it; "also" units touch it.

## Business transactions

| BT | Transaction | Backend owner | Frontend | M1 |
|---|---|---|---|---|
| BT1 | Sign up / sign in (+ Google) | U2 | U7a | ✓ |
| BT2 | Create event | U3 | U7b | ✓ (create, publish) |
| BT3 | Manage event settings and flyer | U3 (settings), U5 (flyer) | U7b | |
| BT4 | Registration questions | U3 | U7b | |
| BT5 | Register for an event | U4 | U7b | ✓ |
| BT6 | Email ticket | U4 (on U2 email core) | — | |
| BT7 | View ticket | U4 | U7b | ✓ |
| BT8 | Check in guest | U4 | U7b | ✓ (by ticket) |
| BT9 | Promote from waiting list | U4 | U7b | |
| BT10 | Draft announcement | U3 | U7b | |
| BT11 | Cancel event | U3 | U7b | |
| BT12 | Delete event | U3 (also U5 flyer cleanup) | U7b | |
| BT13 | Discover events | U5 (also U3 featured query) | U7b | |
| BT14 | Choose dashboard style | U2 (`PATCH /v1/me`) | U7b | |

## Functional requirements

| FR | Owner | Also | Pass |
|---|---|---|---|
| FR-1 Accounts and authentication | U2 | U7a (cookies, Google button, callback) | M1 |
| FR-2 Events (incl. C1, C2 fixes) | U3 | U4 (`RegistrationStats`), U5 (flyer cleanup) | 2.1, 2.2, 2.8 in M1; rest M2 |
| FR-3 Registration questions (C3 fix) | U3 | | M2 |
| FR-4 Registration | U4 | | M1 |
| FR-5 Waiting list | U4 | | M2 |
| FR-6 Tickets and check-in | U4 | | 6.1, 6.3 and check-in by ticket in M1; guest-list check-in M2 |
| FR-7 Email | U2 (core, sign-in code) | U4 (ticket email) | Sign-in code M1; ticket email M2 |
| FR-8 Flyers | U5 | | M2 |
| FR-9 Discovery and public reads | U5 | U3 (public page in M1, featured query) | Public page M1; rest M2 |
| FR-10 Host dashboard | U3 | U4 (guest list), U2 (theme) | M2 |
| FR-11 Roles and permissions | U3 | | M1 (policy and guard) |
| FR-12 Venue search | U5 | | M2 |
| FR-13 Cache revalidation | U5 | U7b (receiving route) | M2 |
| FR-14 Data migration | U6 | | M2 rehearsal, M3 run |
| FR-15 Frontend integration | U7 | | U7a, U7b in M2 |
| FR-16 Operations (health, migrations on deploy) | U1 | | M1 |

## Non-functional requirements

| NFR | Owner | Also |
|---|---|---|
| NFR-1 Architecture | U1 (structure, lint boundaries) | every unit |
| NFR-2 Performance | U1 (pool, auth check), U4 (registration) | U3, U5 (read queries, pagination, cache) |
| NFR-3 Scalability | U1 (stateless, Redis) | U4 (row lock across instances) |
| NFR-4 Availability and recovery | U1 (health, zero-downtime deploy) | U6 (runbook, backups) |
| NFR-5 Security (functional) | U1 (validation, CORS, errors), U2 (tokens, rate limits) | U5 (link and upload limits), U7 (cookies) |
| NFR-6 Observability | U1 | U7 (request id passed to the API) |
| NFR-7 Testing and PBT | U1 (harness, fast-check) | every unit; gates in Build and Test |
| NFR-8 Compatibility | U6 (ids, codes, slugs kept) | U4 (ticket lookup), U3 (slugs) |

## Validation
- Every BT1–BT14 and every FR-1..FR-16 has exactly one owning unit.
- Every NFR has an owning unit.
- The M1 slice covers all fourteen M1 endpoints in application-design.md: the six `/auth/*` endpoints, `GET /me` and health in U1 and U2; `POST /events`, publish and `GET /events/by-slug/{slug}` in U3; register, `GET /tickets/{code}` and `POST /tickets/{code}/check-in` in U4.
- No circular dependencies between units (see unit-of-work-dependency.md).
