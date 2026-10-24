# U2 Identity — NFR Design Patterns

Answer used (u2-identity-nfr-design-plan.md): **Q1 A**. The access-token check stays local, so an access token remains valid for up to 15 minutes after sign-out. Refresh stops at once. Next.js deletes the web cookies at sign-out. This can be tightened later with a revoked-session check, without changing the API.

## 1. Security patterns

| Pattern | Design |
|---|---|
| Key ring with `kid` | `AccessTokenKeyRing` loads `JWT_ACCESS_SECRET` (kid = first 8 hex of SHA-256 of the secret) and an optional `JWT_ACCESS_SECRET_PREVIOUS`. It signs with the current key and verifies with whichever key the `kid` names. Rotation: set PREVIOUS = old, CURRENT = new, deploy, and remove PREVIOUS after 15 minutes (U2-S4). |
| Pinned verification | `jwtVerify(token, key, { algorithms: ['HS256'], issuer, audience, clockTolerance: 30 })`. An unknown `kid` is invalid. |
| Keyed code hashes | `hmacSha256(SIGN_IN_CODE_SECRET, email + ':' + code)`. Binding the email to the code means a hash can't be reused across addresses. Compared with `timingSafeEqual` on equal-length buffers. |
| Token hashes | `sha256(refreshToken)` hex, unique-indexed. Lookup by hash means no timing channel. |
| OIDC state store | `RedisOidcStateStore.put(state, payload, 600 s)` and `take(state)` using `GETDEL`, so state is single-use and expires. The payload holds the verifier, nonce, redirectUri and client. It never leaves Redis. |
| Enumeration-safe responses | The request-code service returns one fixed DTO on every path after validation and rate limits. Verify returns `auth.code_invalid` for both "no code" and "wrong code". |
| Startup secret checks | The config refuses to start if `JWT_ACCESS_SECRET === SIGN_IN_CODE_SECRET`, or either is shorter than 32 bytes. |
| Redaction | The email job payload uses the field name `signInCode` (U1 convention). The OIDC `code`, the tokens and `state` are never logged. |

## 2. Resilience patterns

| Dependency | Pattern | On failure |
|---|---|---|
| Google discovery and signing keys | Lazy discovery on first use, cached in memory for the process life. `openid-client` caches the signing keys and refetches on an unknown `kid`. 5 s timeout. | 503 `auth.google_unavailable`. The next request tries again. |
| Google token exchange | Single attempt, 5 s timeout (codes are single-use) | 503 `auth.google_unavailable`. The user restarts sign-in. |
| Resend | 5 s timeout. BullMQ retries (5 attempts, backoff from 2 s). `Idempotency-Key` = jobId. A 4xx other than 429 is turned into BullMQ `UnrecoverableError`. | The job fails permanently and logs `job.failed_permanently` with Resend's error name. The user can request a new code. |
| Redis (rate limits, OIDC state) | Sign-in policies fail closed. | Code request and verify: 429 `rate_limit.exceeded` with `Retry-After: 60`. Google start: 503 `auth.google_unavailable`. Refresh, sign-out and the guard keep working. |
| Concurrent refresh | `SELECT … FOR UPDATE` on the `refresh_tokens` row, then the `sessions` row, in the same transaction (fixed lock order: token, then session). | The second request sees `rotated_at` set and gets `auth.refresh_superseded` (< 30 s). |
| Wrong-code attempts | The decrement is saved in its own `RequiresNew` transaction, so it survives the error. | — |

## 3. Performance patterns
- **Guard:** the JWT is verified with keys already in memory. There's no I/O; the U2-P5 test asserts it with spies.
- **Refresh:** one indexed lookup by hash, two row locks, one update, one insert, all in one round-trip transaction. Prepared statements are used for the token lookup and the session load.
- **Verify:** an indexed query, `sign_in_codes(email, created_at desc) limit 1 for update`. The user is found by `lower(email)` through the unique index.
- **Request code:** two rate-limit `INCR`s, then one transaction that supersedes older codes (an `UPDATE` on the same index) and inserts the new one. The email is sent by the worker, outside the request.
- **Google callback timing:** our own time is logged separately as `ownMs`, which excludes the exchange (U2-P4).

## 4. Rate-limit policies

| Policy | Subject | Windows | On Redis failure |
|---|---|---|---|
| `signInCode.email` | normalized email | 1 / 60 s; 5 / 3600 s | deny |
| `signInCode.ip` | client IP | 20 / 3600 s | deny |
| `signInVerify.email` | normalized email | 10 / 3600 s | deny |
| `signInVerify.ip` | client IP | 60 / 3600 s | deny |
| `refresh.ip` | client IP | 120 / 3600 s | allow |
| `global.ip` (U1) | client IP | 300 / 60 s | allow |

Client IP is the BFF-forwarded IP when the key matches (U1 NFR design §4).

## 5. Worker-only processors and housekeeping
- **Registering processors by role:** `QueueModule.processors(...)` (added to U1's QueueModule in U2) returns the processor providers only when `AppConfig.runsWorkers`. In the `api` role, `@Processor` classes aren't registered, so no BullMQ Worker starts.
- **`EmailProcessor`:** on the `email` queue, it handles the job name `sign-in-code`. U4 adds `ticket`.
- **`IdentityCleanupProcessor`:** on a new `maintenance` queue, a repeatable job `identity.cleanup` runs daily at 03:15 UTC (`repeat: { pattern: '15 3 * * *', tz: 'UTC' }`, fixed `jobId`, so it's scheduled once). It deletes in batches of 1,000.

## 6. Configuration additions (beyond functional design §10)
| Setting | Role | Notes |
|---|---|---|
| `JWT_ACCESS_SECRET_PREVIOUS` | api | Optional; only during a key rotation |
| `RESEND_API_URL` | worker | Default `https://api.resend.com`; overridden in tests |
| `GOOGLE_ISSUER_URL` | api | Default `https://accounts.google.com`; points to the fake issuer in tests |
