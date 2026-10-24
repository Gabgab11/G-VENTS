# U2 Identity — Code Generation Plan

This plan is the single source of truth for U2 code generation. Steps run in order, and each is ticked as it's done.

## Unit context
- **Unit:** U2 Identity, entirely M1.
- **Code location:** `/Users/payazaafrica/gventz-api/src/modules/identity/` plus small platform additions. Nothing goes in `aidlc-docs/` except the summary.
- **Requirements:** FR-1 (all), FR-7.1 sign-in email, FR-10.4 dashboard theme, BT1, BT14; NFR-2, NFR-5 and NFR-7 for auth.
- **Design inputs:** `u2-identity/functional-design/*`, `nfr-requirements/*`, `nfr-design/*`, and the U1 platform contracts.
- **Depends on:**
  - U1 `UnitOfWork`, `@Transactional`, `AuditTrail`, `RateLimiter`, `JobQueue`, `RequestContext`, `ProblemDetailsFilter`
  - the `users` table
- **Exposes:** `UserDirectory`, `AuthenticatedUser`, `CurrentUser`, the global `AccessTokenGuard`, `Mailer`, `EmailMessage`, `EmailComposer`.
- **Tables owned:** `users` (writer), plus the new `user_identities`, `sign_in_codes`, `sessions` and `refresh_tokens`.
- **Not committed:** files are written to the working tree only.

## Steps

### Step 1 — Platform additions (U1 follow-ups needed by U2)
- [ ] Configuration: add the U2 settings to `EnvironmentVariables` with role-aware rules.
  - Settings: `JWT_*`, `JWT_ACCESS_SECRET_PREVIOUS`, `SIGN_IN_CODE_SECRET`, `GOOGLE_*`, `GOOGLE_ISSUER_URL`, `RESEND_*`, `EMAIL_FROM`.
  - Startup refuses identical secrets.
  - Add typed `AuthConfig`, `GoogleConfig` and `EmailConfig`.
- [ ] `QueueModule.processors(app, [...])`: register processors only when the role includes the worker. Add the `maintenance` queue.
- [ ] Update `.env.example` and `render.yaml` env vars.

### Step 2 — Dependencies
- [ ] Add `openid-client` (v6) to dependencies and `oauth2-mock-server` to devDependencies. Pin both in `package-lock.json`.

### Step 3 — Schema and migration
- [ ] Add Drizzle tables `user_identities`, `sign_in_codes`, `sessions` and `refresh_tokens`, with the constraints and indexes from domain-entities.md.
- [ ] Generate `drizzle/0001_identity.sql` (expand only) and review it.

### Step 4 — Domain (`identity/domain/`)
- [ ] Value objects: `SignInCodeValue`, `RefreshToken`, `ClientType`, `PersonName`, `DashboardTheme`, `PkceVerifier`, `AccessTokenClaims`.
- [ ] Aggregates: `User` with `ExternalIdentity`, `SignInCode`, `Session` (rotation state machine, expiry).
- [ ] Domain events and domain errors with the codes from business-rules.md.
- [ ] Ports: `UserRepository`, `SignInCodeRepository`, `SessionRepository`, `TokenHasher`, `AccessTokenSigner` / `AccessTokenVerifier`.

### Step 5 — Domain tests
- [ ] Example tests for every rule and error code in business-rules §2–§4, §6.
- [ ] PBT, all with arbitraries in `test/support/identity-arbitraries.ts`:
  - `SignInCodeValue` invariant and round-trip
  - `SignInCode` stateful model
  - consumed code idempotence
  - `Session` rotation stateful model
  - `Session` expiry invariant
  - `RefreshToken` invariant
  - `PkceVerifier` oracle

### Step 6 — Application (`identity/application/`)
- [ ] Services: `EmailCodeSignInService`, `GoogleSignInService`, `SessionService`, `ProfileService`, `AccountLinker`, `UserDirectory`.
- [ ] Application ports: `GoogleOidcClient`, `OidcStateStore`, `Mailer`.
- [ ] `EmailComposer` with `SignInCodeTemplate` and `escapeHtml`.
- [ ] `SignInEmailHandler`.
- [ ] DTOs (`TokenPairDto`, `MeDto`, ...) and the rate-limit policy constants.

### Step 7 — Application tests
- [ ] Example tests with in-memory repositories and fakes:
  - the request and verify flows, including the same 202 on every path and the attempt decrement surviving the error
  - Google resolution through the GS6 table
  - refresh, sign-out and sign-out-all
  - profile updates
- [ ] PBT:
  - `AccountLinker` oracle against the decision table
  - email composition escaping invariant

### Step 8 — Infrastructure (`identity/infrastructure/`)
- [ ] Repositories: Drizzle `UserRepository`, `SignInCodeRepository` and `SessionRepository`, with `FOR UPDATE` loads in the fixed order token → session, and `uow.collectFrom`.
- [ ] Crypto and tokens: `NodeTokenHasher`, `AccessTokenKeyRing` + `JoseAccessTokens`.
- [ ] Google: `OpenIdGoogleClient` (`openid-client` v6, lazy discovery, 5 s timeouts), `RedisOidcStateStore` (`GETDEL`).
- [ ] Email: `ResendMailer` (fetch, 5 s, `Idempotency-Key`, permanent vs transient errors), `LoggingMailer`.
- [ ] Processors: `EmailProcessor` (`sign-in-code`), `IdentityCleanupProcessor` (daily repeatable job).

### Step 9 — Infrastructure tests
- [ ] Example tests for `ResendMailer` with a mocked `fetch`: success, 4xx is permanent, 429 and 5xx are transient, timeout.
- [ ] Example tests for the key ring: rotation, unknown `kid`.
- [ ] PBT: `JoseAccessTokens` round-trip and tamper invariant.

### Step 10 — Presentation (`identity/presentation/`)
- [ ] `AuthController` and `MeController` with request and response DTOs (class-validator, Swagger).
- [ ] `AccessTokenGuard` (global; `@Public()` with an optional viewer), `@CurrentUser()`.
- [ ] Problem details for every auth error.

### Step 11 — Module wiring
- [ ] `identity.module.ts` and the public `index.ts`.
- [ ] Register in `AppModule`. Remove the probe's need for `@Public()` where the guard now applies.
- [ ] Regenerate `openapi.json`.

### Step 12 — Integration and e2e tests (Testcontainers + `oauth2-mock-server`)
- [ ] Full email-code flow over HTTP:
  - the request → the email job captured by a fake `Mailer` → verify
  - `isNewUser`, then the existing user, and the audit row
- [ ] Rate limits: 60 s window, `Retry-After`, IP limit; fail-closed when Redis is down.
- [ ] Refresh: rotation, reuse after 30 s revokes the session, two parallel refreshes → one superseded; sign-out and sign-out-all.
- [ ] Google against the fake issuer:
  - new user, link by email (unconfirmed becomes verified), existing identity
  - bad nonce, reused state, unverified email, redirect not allowed
- [ ] Guard:
  - every non-public route returns 401 without a token
  - expired → `auth.token_expired`
  - public route with a token sets the viewer
- [ ] Worker role registers the processors and the API role doesn't.

### Step 13 — Documentation and deployment
- [ ] README additions (auth endpoints, settings).
- [ ] `render.yaml` secret env vars.
- [ ] `aidlc-docs/construction/u2-identity/code/code-summary.md`.

### Step 14 — Verify
- [ ] lint, typecheck, unit + PBT, integration, build, `openapi:check`, `docker build`.
- [ ] A local smoke run of the email-code flow with `LoggingMailer`.
- [ ] Results recorded in code-summary.md.

## PBT coverage (PBT-01..PBT-10)
| Rule | Where |
|---|---|
| PBT-01 properties carried forward | Steps 5, 7, 9 (all 11 from business-logic-model §9) |
| PBT-02 round-trip | Code value, JWT |
| PBT-03 invariant | Code value, refresh token, session expiry, JWT tamper, email escaping |
| PBT-04 idempotence | Consumed code |
| PBT-05 oracle | PKCE, AccountLinker |
| PBT-06 stateful | SignInCode model, Session rotation model |
| PBT-07 generators | `identity-arbitraries.ts` (emails, codes, times, token sequences) |
| PBT-08 reproducibility | Shared `fcParams()` (seed, path, runs) |
| PBT-09 framework | fast-check (U1) |
| PBT-10 complementary | Example tests per error code; PBT in separate `*.pbt.spec.ts` |

## Traceability
| Requirement | Steps |
|---|---|
| FR-1.1 email code | 4–8, 10, 12 |
| FR-1.2, FR-1.3 Google + linking | 4, 6–8, 12 |
| FR-1.4–1.7 sessions, web and mobile, sign-out | 4–8, 10, 12 |
| FR-1.8 return path | U7 (noted, no API code) |
| FR-1.9 existing users | 6 (find by email, ids kept) |
| FR-7.1 sign-in email | 6, 8, 12 |
| FR-10.4 theme | 6, 10 |
| NFR-2 auth targets | 8 (indexes, local guard), 12 |
| NFR-5 auth security | 4, 8, 10 |
