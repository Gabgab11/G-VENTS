# U2 Identity — Business Rules

## 1. Requesting a sign-in code (FR-1.1, Q1 A, Q2 A)
- **IC1. Input.** `{ email }`, normalized by `Email`. An invalid address returns 400 `validation.failed`.
- **IC2. Rate limits.** These fail closed when Redis is down (U1 R4).
  - `signInCode.email`, per normalized email: 1 per 60 s and 5 per hour.
  - `signInCode.ip`, per client IP: 20 per hour.
  - If either is exceeded the response is 429 `rate_limit.exceeded` with `Retry-After`.
- **IC3.** Issuing a code supersedes every unconsumed code for that email (only the latest is valid).
- **IC4. Same answer always.** The response is always **202** `{ "message": "If that address can receive email, a code is on its way.", "expiresInSeconds": 600 }`, whether or not an account exists (Q2 A).
- **IC5. Email job.** The plain code leaves the transaction only in the `identity.sign_in_code_issued` event.
  - The event's handler enqueues `email` / `sign-in-code` with `jobId = sign-in-code.{codeId}` and `secret: true`.
  - The job is removed on completion, and the code is never logged.
- **IC6. Suppressed addresses.** If the address is on `email_suppressions` with no event (a global bounce or complaint), the code is still issued but no email is queued. The answer is the same.

## 2. Verifying a code (FR-1.1, FR-1.9)
- **VC1. Input.** `{ email, code, client: "web" | "mobile" }`. The code must be 6 digits; anything else returns 400.
- **VC2. Rate limits.** `signInVerify.email`: 10 per hour per email. `signInVerify.ip`: 60 per hour per IP. Both fail closed.
- **VC3. Which code is checked.** The latest code for the email. If there is none, the result is `auth.code_invalid`, so the API never reveals whether a code was sent.
- **VC4. Comparison.** Constant-time, of HMAC hashes.

| Situation | Error | HTTP |
|---|---|---|
| Wrong code, attempts remain | `auth.code_invalid` "That code is not right. Check the latest email and try again." | 422 |
| Wrong code, last attempt | `auth.code_attempts_exceeded` "Too many tries. Request a new code." | 422 |
| Expired | `auth.code_expired` "This code has expired. Request a new one." | 422 |
| Already used or superseded | `auth.code_invalid` | 422 |

- **VC5. On success**, in one transaction:
  1. Consume the code.
  2. Find the user by email. If there is none, register one (verified, no name). If the user exists but isn't verified, mark them verified.
  3. Start a session.
  4. Write the audit entry `auth.signed_in` `{ method: "email_code", client }`.
- **VC6. Response** (201):

```json
{
  "accessToken": "...",
  "accessTokenExpiresAt": "...",
  "refreshToken": "...",
  "refreshTokenExpiresAt": "...",
  "user": { ... },
  "isNewUser": true
}
```

  `refreshTokenExpiresAt` is the session's `expiresAt`.
- **VC7. Existing Supabase users** sign in with a code as before. Their ids are unchanged (FR-1.9).

## 3. Google sign-in (FR-1.2, FR-1.3, Q5 A, Q6 A, Q8 A)
- **GS1. Start.** `POST /auth/google/start { redirectUri, client }`.
  - `redirectUri` must exactly match an entry in `GOOGLE_REDIRECT_URIS`. Otherwise the result is 400 `auth.redirect_uri_not_allowed`.
  - Mobile deep links are added to the list when the app exists (Q8 A).
- **GS2. Login attempt state.** Create a `state` (32 random bytes), a `nonce` (32 random bytes) and a PKCE verifier.
  - Store `{ verifier, nonce, redirectUri, client }` in Redis at `oidc:{state}` for 10 minutes.
  - Return the Google authorization URL with `response_type=code`, `scope=openid email profile`, `code_challenge_method=S256`, `prompt=select_account`, and the state and nonce.
- **GS3. Callback.** `POST /auth/google/callback { code, state }`. The state is read and deleted in one step (`GETDEL`), so it can be used only once. A missing or reused state returns 400 `auth.google_state_invalid`.
- **GS4. Exchange.** Exchange the code with the verifier and the same `redirectUri`. Then validate the ID token:
  - signature (Google's JWKS)
  - `iss` ∈ {`https://accounts.google.com`, `accounts.google.com`}
  - `aud` = client id
  - `exp`, with 60 s of tolerance
  - `nonce` matches

  Any failure returns 401 `auth.google_token_invalid`. If Google can't be reached, the result is 503 `auth.google_unavailable`.
- **GS5.** `email_verified` must be true. Otherwise the result is 422 `auth.google_email_unverified` "Your Google account's email is not verified."
- **GS6. Account resolution**, in order:

| Found | Action | Audit |
|---|---|---|
| An identity with this Google `sub` | That user. Update identity `last_used_at` and Google email. | `auth.signed_in {method: google}` |
| A user with the same email (case-insensitive) | Link the identity. Mark the email verified if it wasn't (Q5 A). | `auth.account_linked`, then `auth.signed_in` |
| Neither | Register a verified user, with `fullName` from Google `name` if 2–120 characters (Q6 A). Link the identity. | `auth.signed_in` |

- **GS7.** A Google account whose email later changes keeps signing in to the same user (matched by `sub`). The user's email isn't changed automatically.
- **GS8.** The response has the same shape as VC6.

## 4. Tokens and sessions (FR-1.4–FR-1.7, Q3 A, Q4 A)
- **TS1. Access token.** A JWT, HS256, signed with `JWT_ACCESS_SECRET` (≥ 32 bytes).
  - Claims: `iss` (`JWT_ISSUER`), `aud` (`JWT_AUDIENCE`), `sub`, `sid`, `iat`, and `exp` = iat + 15 min. It carries a `kid` header so keys can be rotated later.
- **TS2. Checking it.** Verification is local: signature, algorithm pinned to HS256, `iss`, `aud`, `exp` with 30 s tolerance. There's no database lookup (NFR-2).
  - A revoked session's access token stays usable until it expires, at most 15 minutes. This is accepted, and web sign-out also clears the cookies.
- **TS3. Refresh token.** An opaque 32-byte random value. Only its SHA-256 is stored.
- **TS4. Refresh.** `POST /auth/refresh { refreshToken }`. Rate limit `refresh.ip`: 120 per hour per IP (fails open). The cases are in order:

| Case | Result |
|---|---|
| Unknown hash | 401 `auth.refresh_invalid` |
| Session revoked | 401 `auth.session_revoked` |
| `now ≥ expiresAt` (idle 30 days, or absolute 90 days) | 401 `auth.session_expired` |
| Current token | Rotate: new refresh token; old one marked rotated; `last_used_at = now`; new access token. 200 with the VC6 shape, without `isNewUser`. |
| Previous token, rotated < 30 s ago | 401 `auth.refresh_superseded` (no revocation; the client uses the newer pair it already received) |
| Previous token, rotated ≥ 30 s ago | Revoke the session (`refresh_reused`). Audit `auth.session_family_revoked {reason: refresh_reused}`. 401 `auth.refresh_reused` |

- **TS5. Expiry is capped.** A refresh never moves `expiresAt` past `absoluteExpiresAt`.
- **TS6. Sign out.** `POST /auth/sign-out` (signed in). Revokes the caller's session (`sid`), reason `sign_out`. Returns 204. Idempotent.
- **TS7. Sign out of all devices.** `POST /auth/sign-out-all` (signed in). Revokes every active session of the user, reason `sign_out_all`. Audit `auth.session_family_revoked {reason: sign_out_all}`. Returns 204.
- **TS8. No session limit.** A user may have any number of sessions.
- **TS9. Client type.** `client` is recorded on the session. Web and mobile get the same response body. The Next.js backend-for-frontend puts the tokens in httpOnly cookies (U7). Mobile keeps them in secure storage.

## 5. Access-token guard (all modules)
- **AG1. Global guard.** Every route needs `Authorization: Bearer <access token>` unless it's marked `@Public()`.
- **AG2. Failures.**
  - No header: 401 `auth.token_missing`.
  - Bad token: 401 `auth.token_invalid`.
  - Expired token: 401 `auth.token_expired`, so the BFF knows to refresh.
- **AG3. Who is calling.** On success the principal `{ userId, sessionId }` is stored in the request context.
- **AG4. Public routes with an optional viewer.** On `@Public()` routes, a valid token still sets the principal, for example to show "manage" on an event page. An invalid or expired token is ignored there.

## 6. Profile (FR-10.4, BT14)
- **PR1. Read.** `GET /me` → `{ id, email, emailVerified, fullName, country, dashboardTheme, createdAt }`.
- **PR2. Update.** `PATCH /me` with optional `fullName` (2–120 characters, or `null` to clear), `country` (2–56, or `null`) and `dashboardTheme` (one of the 10). Unknown fields → 400.
- **PR3. Email.** Changing the email isn't supported (out of scope, as today).

## 7. Return path (FR-1.8)
The API never redirects browsers. The same-site return-path rule (today's `safeNextPath`) stays in the Next.js app (U7). For Google, the frontend puts the return path in its own cookie before calling `start`.

## 8. Email core (shared with U4)
- **EM1. Sender.** `EMAIL_FROM` = `G-ventZ <no-reply@gventz.com>` (Q7 A).
- **EM2. Sign-in email.**
  - Subject: `Your G-ventZ sign-in code: 123456`.
  - Body, in HTML and text: the code, "expires in 10 minutes", and "If you didn't ask for this, you can ignore this email."
  - Every value inserted is HTML-escaped.
- **EM3. Sending.** Through Resend's HTTP API with `Idempotency-Key = jobId`.
  - A 4xx response other than 429 is a permanent failure: logged, no retry.
  - A 429 or 5xx response, or a network error, is retried (5 attempts, backoff).
- **EM4. Development.** In `development`, without `RESEND_API_KEY`, `LoggingMailer` prints the sign-in email, code included, to the console. This happens only in development (U1 C3).

## 9. Audit (U1 A2)
| Action | When |
|---|---|
| `auth.signed_in` | Every successful code or Google sign-in |
| `auth.account_linked` | A Google identity is linked to an existing account |
| `auth.session_family_revoked` | Refresh-token reuse, or sign-out-all |

## 10. Configuration added
| Setting | Role | Notes |
|---|---|---|
| `JWT_ACCESS_SECRET` | api | ≥ 32 bytes |
| `JWT_ISSUER`, `JWT_AUDIENCE` | api | For example `https://api.gventz.com` and `gventz` |
| `SIGN_IN_CODE_SECRET` | api | ≥ 32 bytes; HMAC key for code hashes |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | api | O4. Optional in development: Google endpoints return 503 `auth.google_unavailable` when unset. |
| `GOOGLE_REDIRECT_URIS` | api | Comma-separated exact allowlist |
| `RESEND_API_KEY` | worker | O5. Development without it uses `LoggingMailer`. |
| `EMAIL_FROM` | worker | Default `G-ventZ <no-reply@gventz.com>` |

In production, the API secrets and Google settings are required for `api`/`all`, and the Resend settings for `worker`/`all`.
