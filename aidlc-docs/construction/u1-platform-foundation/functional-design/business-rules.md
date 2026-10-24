# U1 Platform Foundation — Business Rules

## 1. Error model (Q6 A)

| ErrorKind | HTTP | Example codes |
|---|---|---|
| `validation` | 400 | `validation.failed` (per-field issues) |
| `invalid` | 422 | `registration.closed`, `event.invalid_location` |
| `not_found` | 404 | `event.not_found`, `ticket.not_found` |
| `conflict` | 409 | `registration.already_registered`, `checkin.already_checked_in` |
| `unauthenticated` | 401 | `auth.token_missing`, `auth.token_expired`, `auth.refresh_reused` |
| `forbidden` | 403 | Rare: used only when the caller can already see the resource (for example a viewer trying to edit). Otherwise 404 (FR-11.3). |
| `rate_limited` | 429 | `rate_limit.exceeded`, with a `Retry-After` header |
| `unavailable` | 503 | `places.unavailable`, `storage.unavailable` |
| anything not a `DomainError` | 500 | `internal_error` |

Response body (`Content-Type: application/problem+json`, RFC 9457):

```json
{
  "type": "https://api.gventz.com/problems/registration.closed",
  "title": "Registration is closed",
  "status": 422,
  "code": "registration.closed",
  "detail": "Registration for this event is closed.",
  "instance": "/v1/events/0193.../registrations",
  "requestId": "b6f0c1d2-...",
  "errors": [{ "field": "attendeeName", "code": "too_short", "message": "Enter at least 2 characters." }]
}
```

Rules:
- E1. `code` values are stable once released. Renaming one is a breaking API change.
- E2. `detail` comes from the `DomainError` message. It is written for users and is safe to show.
- E3. `errors` appears only for `validation`, with one entry per failing field. Field names use the request's camelCase path (for example `ticketTypes[2].name`).
- E4. For a 500, the body is always `code: internal_error`, `detail: "Something went wrong. Please try again."`. The real error, with its stack, is logged with the request id. No exception message reaches the client.
- E5. Errors from outside services (Google, Resend, Cloudinary) are turned into `unavailable` or `invalid` domain errors by their adapters, never passed through.
- E6. Database constraint violations that slip past domain checks are mapped by repositories:
  - A unique violation becomes `conflict`, with the module's code.
  - A check violation becomes `invalid`.
  - Anything else becomes a 500.

## 2. Identifiers (Q4 A)
- I1. New rows get UUID v7 from `IdGenerator`. Database defaults (`gen_random_uuid()`) stay only as a fallback.
- I2. Existing ids (v4) are never rewritten. Code treats any valid UUID as an id and never depends on the version.
- I3. Path ids that aren't valid UUIDs return 404, not 400, so ids can't be probed.
- I4. Ticket codes and slugs aren't UUIDs. Their rules are in U3 and U4.

## 3. Time and money
- T1. All instants are stored as `timestamptz`. The API exchanges them as ISO 8601 UTC strings with `Z` and millisecond precision.
- T2. Only the `Clock` supplies "now". Domain code never calls `new Date()` directly.
- T3. An event's local times are interpreted in the event's `IanaTimeZone`. Conversion rules belong to U3.
- M1. Money is always `amountMinor` (integer) plus `currency` (ISO 4217). JSON carries `{ "amountMinor": 500000, "currency": "NGN" }`. Floats are rejected at validation.

## 4. Pagination (Q3 A)
- P1. **Page-number lists** (guest list, host events): `?page=1&pageSize=50`. Default page 1, page size 20 (the guest list defaults to 50), maximum 100. The response is `{ items, page, pageSize, total }`. A page past the end returns empty `items`, not an error.
- P2. **Cursor lists** (featured events, other public lists): `?cursor=…&limit=20`. Default limit 20, maximum 50. The response is `{ items, nextCursor }`, and `nextCursor` is null on the last page.
- P3. Every list has a total order that includes a unique key, for example `(starts_at, id)`, so pages never repeat or skip rows.
- P4. A cursor is opaque. A malformed or tampered cursor returns `validation.failed` on `cursor`, never a 500.

## 5. Rate limiting
- R1. Fixed-window counters in Redis, keyed `rl:{policy}:{subject}:{windowStart}`. A request is allowed only if every window of the policy is under its limit.
- R2. A denied request still counts.
- R3. When limited, the response is 429 `rate_limit.exceeded` with `Retry-After` set to the seconds until every blocking window has reset (the latest one, since all windows must pass; corrected during code generation).
- R4. If Redis can't be reached, the policy's `onStoreFailure` decides:
  - **Sign-in code requests: `deny`**, so email can't be abused.
  - **Everything else: `allow`, with a warning log.**
- R5. Limit values belong to the module that uses them. For example Places is 60 a minute and 1,000 a day (FR-12); sign-in values are set in U2.

## 6. Domain events and jobs
- D1. Aggregates record events. When a repository saves an aggregate, it hands the aggregate's events to the request's event collector.
- D2. Events are dispatched **after commit**, in the order recorded. A rollback discards them.
- D3. Saving an aggregate outside a transaction is a programming error. The repository throws, and tests catch it.
- D4. Handlers run one after another for each event. A failing handler is logged with the event name and request id. It doesn't affect the HTTP response or the other handlers.
- D5. Handlers only enqueue durable work or do in-memory work. They never call outside services directly.
- J1. Every job has a deterministic `jobId` built from the fact it represents, with parts joined by `.` (BullMQ rejects `:` in custom ids; found in U2 code generation). Enqueuing the same id twice is a no-op.
- J2. Default retry: 5 attempts, exponential backoff starting at 2 seconds (2, 4, 8, 16, 32 s).
- J3. A job that fails for the last time is logged at error level with its queue, name and id, and kept 7 days for inspection.
- J4. Completed jobs are removed at once when the payload holds a secret, such as a sign-in code. Otherwise they are kept 1 hour, up to 1,000.

## 7. Audit trail (Q5 B)
- A1. `AuditTrail.record()` writes in the **same transaction** as the action. If the action rolls back, so does its entry.
- A2. Actions recorded now:

| action | actor | event_id | meta |
|---|---|---|---|
| `auth.signed_in` | user | — | `{ method: "email_code" \| "google", client: "web" \| "mobile" }` |
| `auth.account_linked` | user | — | `{ provider: "google" }` |
| `auth.session_family_revoked` | user | — | `{ reason: "refresh_reused" \| "sign_out_all" }` |
| `event.cancelled` | staff | event | `{}` |
| `event.deleted` | owner | null (set after delete) | `{ eventId, title, guestCount }` |
| `guest.checked_in` | staff | event | `{ registrationId, via: "ticket" \| "guest_list" }` |
| `member.role_changed` | admin or owner | event | `{ userId, from, to }`. Recorded when member management exists; no endpoint changes roles yet. |

- A3. `meta` never contains tokens, codes, email addresses or attendee answers.
- A4. Audit entries are only ever inserted, never updated or deleted by the application. Reading them (`audit.read`, owner and admin) is a later feature.

## 8. Requests
- Q1. Request id: an incoming `x-request-id` matching `^[A-Za-z0-9-]{8,64}$` is kept. Otherwise a new UUID is generated. It is returned in the `x-request-id` header and included in every log line and problem body.
- Q2. Request bodies are validated before the service runs.
  - Unknown properties are rejected.
  - Strings are trimmed where the field says so, and every string has a maximum length.
  - Bodies over 100 KB are refused.
- Q3. Every route requires an access token unless marked `@Public()`.
- Q4. CORS allows only the configured origins. Browser calls from the web app normally go through Next.js, so the list is short.

## 9. Configuration
- C1. All settings are validated at startup. A missing or malformed required setting stops the process with a message naming the setting, never its value.
- C2. Settings and when they are required:

| Setting | api | worker | Notes |
|---|---|---|---|
| `NODE_ENV`, `APP_ROLE`, `LOG_LEVEL` | ✓ | ✓ | `APP_ROLE` = `api`, `worker` or `all` |
| `PORT` | ✓ | | — |
| `DATABASE_URL`, `DATABASE_POOL_MAX` (default 10) | ✓ | ✓ | — |
| `REDIS_URL` | ✓ | ✓ | — |
| `CORS_ORIGINS` | ✓ | | comma-separated |
| `JWT_ACCESS_SECRET` (≥ 32 bytes), `JWT_ISSUER`, `JWT_AUDIENCE` | ✓ | | U2 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URIS` | ✓ | | U2; redirect allowlist |
| `RESEND_API_KEY`, `EMAIL_FROM` | | ✓ | U2 and U4 |
| `CLOUDINARY_URL` | ✓ | ✓ | U5 |
| `GOOGLE_PLACES_API_KEY` | ✓ | | U5 |
| `TICKETMASTER_API_KEY`, `PREDICTHQ_TOKEN`, `ICAL_FEEDS` | ✓ | | U5; each optional, and a missing source is skipped |
| `REVALIDATE_URL`, `REVALIDATE_SECRET` | | ✓ | U5 |

- C3. In `production`, every setting marked for the role is required, except the optional listing sources. In `development` and `test`, missing integrations fall back to logging stand-ins. For example, a missing `RESEND_API_KEY` uses `LoggingMailer`, which prints the email to the console.
- C4. Secrets are never logged or returned by any endpoint.

## 10. Health (FR-16)
- H1. `GET /health/live` returns 200 whenever the process is running.
- H2. `GET /health/ready` returns 200 only if `select 1` on Postgres and `PING` on Redis both succeed within 1 second each. Otherwise it returns 503, naming which check failed.
- H3. Health routes are unversioned, public and excluded from request logging at info level.
