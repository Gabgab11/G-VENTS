# U2 Identity — Code Summary

- **Repository:** `/Users/payazaafrica/gventz-api`, **not committed**
- **Plan:** `aidlc-docs/construction/plans/u2-identity-code-generation-plan.md`, all steps ticked
- **Generated:** 2026-10-23

## Files

### Created — `src/modules/identity/`
| Layer | Files |
|---|---|
| Domain | `domain/identity.errors.ts`, `identity.events.ts`, `user.ts` (+ `ExternalIdentity`), `sign-in-code.ts`, `session.ts`; `value-objects/{sign-in-code-value,refresh-token,client-type,person-name,dashboard-theme,pkce-verifier}.ts`; `ports/{repositories,security}.ts` |
| Application | `application/{ports,rate-limits,dto,escape-html,email-composer,session.service,email-code-sign-in.service,account-linker,google-sign-in.service,profile.service,user-directory,sign-in-email.handler}.ts` |
| Infrastructure | `infrastructure/{drizzle-user.repository,drizzle-sign-in-code.repository,drizzle-session.repository,drizzle-email-suppression.list,node-token-hasher,jose-access-tokens,openid-google-client,redis-oidc-state.store,resend-mailer,email.processor,identity-cleanup.processor}.ts` |
| Presentation | `presentation/{auth.controller,me.controller,access-token.guard,current-user.decorator}.ts`, `dto/{auth-requests,auth-responses,update-me}.dto.ts` |
| Module | `identity.module.ts`, `index.ts` (public interface: `IdentityModule`, `UserDirectory`, `Mailer`, `EmailMessage`, `EmailComposer`, `CurrentUser`, `AuthenticatedUser`) |
| Tests | 10 spec files: domain, application, infrastructure; 5 of them `*.pbt.spec.ts` |

### Created — elsewhere
- `src/platform/database/schema/identity.ts`, `drizzle/0001_identity.sql` (expand only: 4 tables, constraints, indexes)
- `src/platform/queue/worker-processors.ts`
- `test/support/{identity-arbitraries,identity-fakes,capturing-mailer}.ts`
- `test/integration/identity.integration.spec.ts`

### Modified
- `src/platform/config/{environment,app-config,config.module}.ts`:
  - U2 settings with role-aware rules.
  - Typed `AuthConfig`, `GoogleConfig` and `EmailConfig`.
  - Refuses identical secrets.
  - Development fallbacks for secrets.
  - `ConfigModule.load()`.
- `src/app.module.ts`: `AppModule.forRoot(config)` now takes the validated config and registers `IdentityModule.forRoot(config)`.
- `src/main.ts`, `src/platform/openapi/export-openapi.ts`, `test/support/test-app.ts`: use `ConfigModule.load()`. The test app accepts provider overrides.
- `src/platform/queue/{queues,job-queue}.ts`: `maintenance` queue; job ids may not contain `:`.
- `src/platform/database/schema/index.ts`, `.env.example`, `render.yaml` (U2 secrets), `README.md` (sign-in section), `package.json` (+ `openid-client`, + dev `oauth2-mock-server`), `openapi.json` (8 paths, 11 schemas).
- Tests updated: `environment.spec.ts`, `job-queue.spec.ts`, `schema.integration.spec.ts` (13 tables), `redis-down.integration.spec.ts` (sign-in fails closed).

## Design → code
| Rule | Code |
|---|---|
| IC1–IC6 request code | `EmailCodeSignInService.requestCode`; `SIGN_IN_CODE_EMAIL`/`IP` (deny on Redis failure); `supersedeOpen`; `SignInEmailHandler` (suppression check, secret job `sign-in-code.<id>`) |
| VC1–VC7 verify | `EmailCodeSignInService.verifyCode`; `SignInCode.verify`; HMAC bound to the email (`NodeTokenHasher`) |
| GS1–GS8 Google | `GoogleSignInService`, `OpenIdGoogleClient` (openid-client v6, PKCE S256, state and nonce), `RedisOidcStateStore` (`GETDEL`), `AccountLinker` / `decideGoogleAccount` |
| TS1–TS9 tokens and sessions | `JoseAccessTokens` + `AccessTokenKeyRing` (HS256, `kid`, previous key); `Session.rotate` (rotated, superseded < 30 s, reused → revoked); `DrizzleSessionRepository` (lock token then session; rotate before insert) |
| AG1–AG4 guard | `AccessTokenGuard` (global `APP_GUARD`; optional viewer on `@Public()`), `@CurrentUser()` |
| PR1–PR3 profile | `ProfileService`, `MeController` |
| EM1–EM4 email core | `EmailComposer` + `escapeHtml`, `ResendMailer` (idempotency key, permanent vs transient), `LoggingMailer` (development), `EmailProcessor` |
| Housekeeping | `IdentityCleanupProcessor` (job scheduler `15 3 * * *` UTC) |
| Worker-only processors (U1 gap) | `workerProviders(config, [...])` in `IdentityModule.forRoot` |

## PBT → tests
| Property | File |
|---|---|
| Code value invariant and round-trip; `SignInCode` stateful model; consumed-code idempotence | `domain/sign-in-code.pbt.spec.ts` |
| `Session` rotation state machine (model-based); expiry invariant | `domain/session.pbt.spec.ts` |
| PKCE oracle; refresh-token invariant | `domain/value-objects/value-objects.pbt.spec.ts` |
| `AccountLinker` decision-table oracle; email escaping invariant | `application/identity.application.pbt.spec.ts` |
| JWT round-trip; tamper invariant | `infrastructure/jose-access-tokens.pbt.spec.ts` |

Each has example-based tests beside it (PBT-10): every error code in business-rules §2–§5 has an explicit example in the unit or integration tests.

## Verification (2026-10-23, local)
| Check | Result |
|---|---|
| lint, typecheck | pass |
| Unit + PBT | **40 files, 182 tests, all pass** |
| Integration (Postgres 18, Redis 7, fake Google issuer) | **4 files, 30 tests, all pass** |
| build, `openapi:export` / `openapi:check` | pass |
| `docker build` | pass |
| Local smoke run (`node dist/main.js`, console mailer) | request code 202 → code printed → verify 201 → `/me` 200 → refresh 200 → sign-out 204. The JSON logs contain no token or code values. |
| Coverage (report only) | unit 62.6% lines (up from 53.2%); integration covers repositories, controllers and processors |

Integration tests cover:
- the full code flow over HTTP, with the email delivered through the real queue and worker
- the 60 s limit with `Retry-After`; attempts persisted across requests; fail-closed when Redis is down
- two parallel refreshes (one 200, one `auth.refresh_superseded`); reuse after 30 s revokes the session, with an audit row
- sign-out and sign-out-all
- Google against `oauth2-mock-server`: new user with name, link by email, sign-in by subject after the email changes, unverified email, wrong nonce, reused state, unlisted redirect
- the guard: missing, invalid and expired tokens; a public route ignoring a bad token
- processors registered only when the role runs workers

## Issues found and fixed during generation
1. **BullMQ rejects `:` in custom job ids.** Every sign-in email failed to enqueue (logged as `job.enqueue_failed`). The id convention is now `.`, and `JobQueue.add` throws `InvalidJobIdError` on `:`, so the mistake can't fail quietly again. Design docs corrected: U1 business-rules J1, services.md, U2 business-rules IC5, business-logic-model §1.
2. **Production secrets.** The development default secrets would have satisfied the length check in production. Secrets now default to empty, so production requires them, and the development fallbacks are applied only outside production.
3. **Wrong-code attempts.** The functional design planned a nested `RequiresNew` transaction to save the decremented attempt, which the platform `UnitOfWork` doesn't support. Instead the service saves the attempt and *returns* the error from inside the transaction; it commits, and the error is thrown afterwards. Refresh-token reuse uses the same pattern so the revocation commits. The behaviour is unchanged.
4. **Test harness only:** `oauth2-mock-server` signs the access token before the ID token, so a `once` hook missed the ID token. The test now uses a persistent hook.

## Known gaps
- **Google `iss` without the scheme.** Google can also issue `iss = "accounts.google.com"`. openid-client checks the discovered issuer (`https://accounts.google.com`) strictly, so such tokens would fail with `auth.google_token_invalid`. Google's authorization-code flow normally returns the `https://` form. To be confirmed with a real Google client (O4).
- **Mobile Google sign-in:** designed but not tried; it needs the app's deep link added to `GOOGLE_REDIRECT_URIS` (Q8 A).
- **Real email:** not run against Resend yet (needs O5 and a key). The adapter is covered with a mocked `fetch`.
- **Not committed.**

---

# Change 1: Supabase token adapter (2026-10-24)

The version 1 own-auth code described above was removed from the tree (snapshot `/Users/payazaafrica/gventz-api-own-auth-snapshot.tar.gz`). This section describes what replaces it.

- **Plan:** `aidlc-docs/construction/plans/u2-identity-change1-code-generation-plan.md`, all steps ticked.
- **Design:** `u2-identity/functional-design/change1-identity.md`.
- **Not committed.**

## Files

| Area | Files |
|---|---|
| Migration (G-VENTS) | `supabase/migrations/20261024000300_platform_staff.sql` (seeds `stefaneey@gmail.com`), `supabase/tests/platform_staff.test.sql`, regenerated `src/lib/supabase/database.types.ts` |
| Domain | `src/modules/identity/domain/{authenticated-user,errors,index}.ts` |
| Application | `application/{ports,dto,profile.service,user-directory,platform-staff-directory}.ts` |
| Infrastructure | `infrastructure/{supabase-token-verifier,drizzle-profile.repository,drizzle-platform-staff.reader}.ts` |
| Presentation | `presentation/{access-token.guard,decorators,platform-staff.guard,me.controller,request-user}.ts` |
| Module | `identity.module.ts` (global, `APP_GUARD`), `index.ts`; wired in `src/app.module.ts` |
| Platform | `WWW-Authenticate: Bearer` on 401s (`problem-details.filter.ts`); `platformStaff` in `schema/tables.ts`; lint module list updated |
| Tests | `infrastructure/supabase-token-verifier.spec.ts` (PBT oracle and invariant), `domain/authenticated-user.pbt.spec.ts`, `application/profile.service.spec.ts` (PBT: unsent fields unchanged), `test/integration/identity.integration.spec.ts`, `test/support/supabase-tokens.ts`, probe secure routes |

## Verification (2026-10-24)

| Check | Result |
|---|---|
| Lint, typecheck | Clean |
| Unit and property-based tests | 161 passed |
| Integration tests (local test key server) | 42 passed. U2 cases: profile, profile created on demand, six refusal codes, public route with a bad token, PATCH rules, MFA guard, staff 404/403/200, keys unreachable → 503 |
| Build, OpenAPI | Pass; snapshot now has `/v1/me` |
| Supabase CLI | `db lint` clean, `test db` 3 files pass, types regenerated |

## Changes from the design
- No separate circuit breaker around the key fetch: `jose`'s remote key set caches keys for 10 minutes, refreshes at most every 30 s and times out at 3 s. Fetch failures become 503.
- `IdentityModule` is global, so every module's controllers can use its guards.
- The country check is a two-letter format check for now; the U3 country catalog replaces it.

## Owner items
Supabase settings (O17): access-token lifetime 15 minutes, asymmetric signing keys, Google provider, custom SMTP via Resend (O5), MFA (TOTP), Turnstile.
