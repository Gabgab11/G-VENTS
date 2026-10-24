# U2 Identity — NFR Requirements

Answers used (u2-identity-nfr-requirements-plan.md, all A): HS256, `openid-client`, Resend free plan until the cutover, the latency targets below. U2 inherits every U1 requirement. This file lists only what is specific to sign-in.

## 1. Performance (Q4 A)
Measured on the API instance, p95, at design load. The time spent at Google and Resend is excluded.

| ID | Endpoint / operation | Target | How checked |
|---|---|---|---|
| U2-P1 | `POST /auth/email/code` | < 150 ms | Integration timing + autocannon on demand |
| U2-P2 | `POST /auth/email/verify` | < 200 ms | Same |
| U2-P3 | `POST /auth/refresh` | < 100 ms | Same |
| U2-P4 | `POST /auth/google/callback` (own time) | < 300 ms | Timing log field `ownMs`, which excludes the Google exchange |
| U2-P5 | Access-token check per request | < 1 ms, no I/O | Unit benchmark; test asserts no repository or Redis call |
| U2-P6 | Lookups | Indexed: `sign_in_codes(email, created_at desc)`, `refresh_tokens(token_hash)` unique, `user_identities(provider, subject)` unique, `users(lower(email))` unique | Migration review; `EXPLAIN` in an integration test |

## 2. Security (functional; the Security extension is off)
- **U2-S1. Secrets.** `JWT_ACCESS_SECRET` and `SIGN_IN_CODE_SECRET` are each ≥ 32 bytes and different from each other (startup check). The Google client secret is server-only.
- **U2-S2. Nothing secret stored in plain form.** Sign-in codes are stored only as HMAC-SHA256 with `SIGN_IN_CODE_SECRET`, and refresh tokens only as SHA-256. A database leak exposes neither.
- **U2-S3. Constant-time comparison.** Code hashes are compared in constant time. Refresh tokens are looked up by hash, so no comparison is needed.
- **U2-S4. Token verification.** The algorithm is pinned to HS256 (`alg: none` and other algorithms are rejected), and issuer and audience are checked. Lifetime is 15 minutes. `kid` allows key rotation: the current key signs, and the previous key is still accepted for 15 minutes after a rotation.
- **U2-S5. Account enumeration.** Code requests always return the same 202. Verify errors don't reveal whether an account exists (rules IC4, VC3).
- **U2-S6. Brute force.**
  - A 6-digit code is guessed with probability 5/10⁶ per code (5 attempts).
  - With at most 5 codes an hour per email, an attacker has at most 25 guesses an hour per email.
  - Per-IP limits also apply.
- **U2-S7. OIDC.**
  - PKCE S256; `state` single-use (`GETDEL`); `nonce` checked.
  - The redirect URI must match the allowlist exactly.
  - The ID-token signature is checked against Google's published signing keys, which are cached.
- **U2-S8. Logging.**
  - Codes are only ever logged under `signInCode`, which is redacted, and in practice never.
  - Tokens are never logged, and emails are masked.
  - The sign-in email job payload is deleted when it completes.
- **U2-S9. Least data.** Access tokens carry only `sub` and `sid`. Profile fields aren't in the token.

## 3. Reliability
- **U2-R1. Google.** Token exchange and key fetch time out after 5 s. Errors become 503 `auth.google_unavailable`. The request isn't retried: the user can try again, and authorization codes are single-use.
- **U2-R2. Resend.** Calls time out after 5 s. Retries follow U1 J2 (5 attempts, from 2 s). A 4xx other than 429 is permanent. The `Idempotency-Key` prevents duplicates across retries.
- **U2-R3. Redis.** If Redis is down, code requests and verification are refused (fail closed, 429/503), and Google start can't store state (503). Refresh and the token check keep working (Postgres and local only).
- **U2-R4. Concurrent refresh.** Row locks serialize two refreshes racing with the same token. The second gets `auth.refresh_superseded` within 30 s (rule TS4).

## 4. Capacity and cost (Q3 A)
- **U2-C1. Design load** (D26): about 50 sign-ins a minute at peak.
- **U2-C2. Resend.** The free plan is used for staging and M1. Moving to the smallest paid Resend plan is a **cutover checklist item (M3)**, together with verifying the `gventz.com` domain (O5). Free-plan limits (about 100 a day at the time of writing) mean the code email may be refused on busy days until then. This is logged as `job.failed_permanently` with Resend's reason.

## 5. Testing (NFR-7, PBT)
- **U2-T1.** The 11 properties in the business-logic model use fast-check (PBT-09, from U1).
- **U2-T2. Example tests for every error code in business-rules §2–§5.** This is PBT-10: critical paths have explicit examples.
- **U2-T3. Integration tests (Testcontainers)** cover:
  - the full code flow, end to end through HTTP
  - refresh rotation and reuse, including two parallel refreshes
  - sign-out and sign-out-all
  - Google callback against a local fake OIDC issuer (see the tech stack), including bad nonce, reused state and unverified email
  - the email job reaching a fake `Mailer`
- **U2-T4.** An e2e check that every non-`@Public()` route returns 401 without a token.

## 6. Maintainability
- **U2-M1.** Identity exports only `UserDirectory`, `AccessTokenGuard`, `CurrentUser`, `AuthenticatedUser` and the `Mailer` / `EmailComposer` contracts through `index.ts`.
- **U2-M2.** Google and Resend sit behind interfaces (`GoogleOidcClient`, `Mailer`), with fakes for tests and development.
