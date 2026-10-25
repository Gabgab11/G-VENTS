# U2 Identity (Change 1) — Code Generation Plan

This plan is the single source of truth for U2 code generation. Each step is ticked as soon as it's done.

## Unit Context
- **Design:** `u2-identity/functional-design/change1-identity.md`.
- **Stories:** US-1.1 and US-1.2 (accept Supabase tokens), US-1.3, and the US-1.5 guard.
- **Code locations:**
  - `/Users/payazaafrica/gventz-api/src/modules/identity/`
  - G-VENTS `supabase/migrations/` and `supabase/tests/`
- **Depends on:** U1.
- **Exposes:** `AccessTokenGuard`, `@Public()`, `@CurrentUser()`, `@OptionalUser()`, `@RequireMfa()`, `PlatformStaffGuard`, `UserDirectory`.
- **Not committed.**

## Steps

### Step 1 — Migration: platform staff (G-VENTS)
- [x] `supabase/migrations/20261024000300_platform_staff.sql`:
  - `platform_staff (email text primary key check (email = lower(email)), note text, added_at timestamptz default now())`
  - RLS on; grants to `anon` and `authenticated` revoked; `SELECT` for `gventz_api`, with a read policy
  - Seed `stefaneey@gmail.com` (note: founder)
- [x] pgTAP: the table exists; the API can read it; `anon` and `authenticated` can't; uppercase emails are refused.
- [x] Add `platformStaff` to `tables.ts` and the drift test.

### Step 2 — Identity domain
- [x] `domain/authenticated-user.ts`: the value (id, email, aal, methods, sessionId) and `normalizeEmail`.
- [x] `domain/errors.ts`: `AuthRequired`, `InvalidToken`, `TokenExpired`, `AnonymousNotAllowed`, `MfaRequired`, `ProfileUnavailable`, with the codes from FD §7.

### Step 3 — Token verification
- [x] `infrastructure/supabase-token-verifier.ts`: — *changed: no separate circuit breaker; `jose`'s remote key set already caches keys (10 minutes), limits refreshes (30 s) and times out (3 s); fetch failures map to 503*
  - `jose.jwtVerify` with `createRemoteJWKSet`, algorithms limited to ES256 and RS256, issuer, audience, 30 s tolerance
  - claim checks T5–T7
  - the JWKS fetch goes through the circuit breaker `supabase-jwks` (T8)
  - an abstract `TokenVerifier` as the DI token
- [x] Unit tests and **PBT** (an oracle over single-claim changes, plus the caller invariant), with test keys from `jose.generateKeyPair`.

### Step 4 — Guards, decorators, request context
- [x] `presentation/access-token.guard.ts`: global; `@Public()` routes skip it; optional viewer on public routes; `WWW-Authenticate`; `auth_token_rejected_total{reason}`; puts the caller in the CLS `principal`.
- [x] `presentation/decorators.ts`: `@CurrentUser()`, `@OptionalUser()`, `@RequireMfa()` (guard).
- [x] `presentation/platform-staff.guard.ts`: email lookup with a 60 s cache, then `aal2`; 404 for non-staff.
- [x] Update `RequestContext` / CLS store types: `principal` = `AuthenticatedUser`.

### Step 5 — Profile and directory
- [x] `application/profile.service.ts`: `getMe` (creates the profile on demand, Q3 A), `updateProfile` (only the fields sent).
- [x] `application/user-directory.ts` (`getContact`) and `application/platform-staff-directory.ts` (`isStaff`).
- [x] `infrastructure/drizzle-profile.repository.ts`, `infrastructure/drizzle-platform-staff.reader.ts`.
- [x] `presentation/me.controller.ts`: `GET /v1/me`, `PATCH /v1/me` with DTOs and Swagger, bearer auth.
- [x] Country check: an ISO 3166-1 alpha-2 format check now; the U3 catalog replaces it in U3 pass 1.

### Step 6 — Module wiring
- [x] `identity.module.ts` and `index.ts`, registered in `AppModule`; the global guard via `APP_GUARD`. — *the module is `@Global()` so every module's controllers can use its guards*
- [x] The probe module in tests stays public.

### Step 7 — Integration tests
- [x] A local JWKS server in tests (a random port), so tokens are signed with a test key.
- [x] Covered:
  - valid token → `/v1/me` 200, profile created on demand
  - missing, expired, wrong-issuer, HS256, anonymous tokens → 401 with codes
  - `PATCH` validation
  - `aal1` on a `@RequireMfa` probe route → 403
  - staff probe route: staff and `aal2` → 200; not staff → 404; staff with `aal1` → 403
  - JWKS down with no cache → 503

### Step 8 — Verification and documentation
- [x] lint, typecheck, unit and PBT, integration, build, `openapi:check` (regenerate), Supabase CLI `test db`, `database.types.ts` regenerated.
- [x] README (sign-in section rewritten), `aidlc-docs/construction/u2-identity/code/code-summary.md` (Change 1 section).
