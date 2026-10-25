# U2 Identity — Functional Design (Change 1, Supabase token adapter)

Supersedes the version 1 U2 design in this folder (`domain-entities.md`, `business-rules.md`, `business-logic-model.md`), which described our own sign-in. Sign-in now happens in **Supabase Auth** (D32). The API checks tokens, describes the caller, and serves the profile.

**Answers used** (`construction/plans/u2-identity-change1-functional-design-plan.md`, all A):
1. Supabase access tokens last 15 minutes (owner setting).
2. Anonymous users are refused.
3. A missing profile is created on the first call.
4. Staff are added by migration. The first is `stefaneey@gmail.com`.

## 1. Token Rules (FR-1.3, SECURITY-08, SECURITY-12)

Every request to a route without `@Public()` must carry `Authorization: Bearer <Supabase access token>`.

| # | Rule | Refused with |
|---|---|---|
| T1 | Header present and in `Bearer <token>` form | 401 `auth.required` |
| T2 | Signature verified with Supabase's public keys (JWKS at `SUPABASE_JWKS_URL`, cached 10 minutes, one refresh for an unknown `kid` at most every 30 s). **Asymmetric algorithms only** (`ES256`, `RS256`). `HS256` and `none` are refused. | 401 `auth.invalid_token` |
| T3 | `iss` equals `SUPABASE_JWT_ISSUER` (`{SUPABASE_URL}/auth/v1`) and `aud` includes `SUPABASE_JWT_AUDIENCE` (`authenticated`) | 401 `auth.invalid_token` |
| T4 | `exp` in the future and `nbf`/`iat` not in the future, each with 30 s clock tolerance | 401 `auth.token_expired` (for `exp`), otherwise `auth.invalid_token` |
| T5 | `role` is `authenticated` | 401 `auth.invalid_token` |
| T6 | `is_anonymous` is not true (Q2 A) | 401 `auth.anonymous_not_allowed` |
| T7 | `sub` is a UUID, and `email` is present and a valid address | 401 `auth.invalid_token` |
| T8 | If the JWKS can't be fetched and no keys are cached | 503 `dependency_unavailable` (through the circuit breaker `supabase-jwks`) |

Additional rules:
- Every 401 carries `WWW-Authenticate: Bearer`.
- The token itself is never logged.
- Each refusal increments `auth_token_rejected_total{reason}`; the truncated client IP goes in the log line. This feeds the U1 security alert.
- **Public routes with an optional viewer** (for example the event page, the ticket page): a valid token attaches the caller; a missing **or invalid** token means "anonymous" (logged at debug). This lets a stale browser token still see public pages.
- **Token lifetime:** 15 minutes, set in the Supabase dashboard (owner item O17). After sign-out, a token stays usable for at most 15 minutes. Accepted (Q1 A).

## 2. The Caller (`AuthenticatedUser`)

| Field | From | Notes |
|---|---|---|
| `id` | `sub` | `UserId` |
| `email` | `email` | Trimmed, lowercased. Supabase only issues tokens for verified emails (code or Google), so this is the verified account email used for tickets. |
| `aal` | `aal` | `aal1` or `aal2`. Missing means `aal1`. |
| `methods` | `amr[].method` | For example `otp`, `oauth`, `totp`. For logs and audits only. |
| `sessionId` | `session_id` | For logs and audits only. |

The caller is put in the request context (CLS `principal`). Logs carry the user id only.

## 3. Two-Step Sign-in Step-Up (FR-1.6, D54)

- `@RequireMfa()` on a route: `aal` must be `aal2`, otherwise **403 `auth.mfa_required`** "Confirm with your authenticator app to continue." The frontend then asks the user for a code.
- It's used by U7 (payout details, refunds) and on every staff route. U2 provides the guard.

## 4. Platform Staff (AD15, Q4 A)

**Table:** `public.platform_staff`, created by migration:

| Column | Notes |
|---|---|
| `email` | Primary key. Lowercase, enforced by a check constraint. |
| `note` | Who or why, for example "founder". |
| `added_at` | When the row was added. |

- Rows are added and removed **by migration only**. The first migration seeds `stefaneey@gmail.com`.
- **Matched by email, not by user id**, so a staff member can be added before they first sign in. Migrations run once, so matching by id would silently skip anyone not yet signed up. The email in the token is verified (§2), so this is safe.
- The API role can read it. `anon` and `authenticated` can't (RLS on, default grants revoked).

**`PlatformStaffGuard`** (on `/v1/staff/*`):
- The caller's email must be in the table. The result is cached per email for 60 s, so a removal takes effect within a minute.
- **And** `aal` must be `aal2` (D54).
- If not staff: **404** `route.not_found`, so staff routes aren't revealed. If staff but not `aal2`: 403 `auth.mfa_required`.

## 5. Profile (`GET /v1/me`, `PATCH /v1/me`; FR-1, FR-14.1)

`GET /v1/me` returns:

```json
{ "id": "…", "email": "…", "fullName": "…|null", "country": "…|null",
  "dashboardTheme": "minimal", "mfa": "aal1|aal2", "isStaff": false }
```

- **Missing profile (Q3 A):** insert `{ id, email }` (the database defaults the theme), with `on conflict do nothing`, then read again. A warning `identity.profile_created_on_demand` is logged.
  - If the row still can't be created (for example another profile already holds that email): **409 `profile.unavailable`** "Your profile couldn't be loaded. Please contact support." The error is logged with the user id.

`PATCH /v1/me` changes only the fields sent:

| Field | Rule |
|---|---|
| `fullName` | Trimmed, 2–120 characters, or null |
| `country` | ISO 3166-1 alpha-2 code from the U3 catalog, or null |
| `dashboardTheme` | One of the 10 themes (`THEMES`) |

- Invalid input gives 400 `validation.failed`.
- `email` can't be changed here. It's changed in Supabase Auth, and the `profiles.email` copy is kept in step by Supabase's trigger.

## 6. Public Interface for Other Modules

`AccessTokenGuard` (global), `@Public()`, `@CurrentUser()`, `@OptionalUser()`, `@RequireMfa()`, `PlatformStaffGuard`, `UserDirectory.getContact(userId)` (email, full name), `AuthenticatedUser`.

## 7. Error Codes

| Code | HTTP | Message |
|---|---|---|
| `auth.required` | 401 | Sign in to continue. |
| `auth.invalid_token` | 401 | Your session isn't valid. Sign in again. |
| `auth.token_expired` | 401 | Your session has expired. Sign in again. |
| `auth.anonymous_not_allowed` | 401 | Sign in with your email or Google to continue. |
| `auth.mfa_required` | 403 | Confirm with your authenticator app to continue. |
| `profile.unavailable` | 409 | Your profile couldn't be loaded. Please contact support. |

## 8. Testable Properties (PBT-01)

| Component | Property | Category |
|---|---|---|
| `SupabaseTokenVerifier` | For tokens signed with the test key, a token is accepted **iff** every rule T2–T7 holds. Generated tokens vary one claim at a time (issuer, audience, expiry, role, `is_anonymous`, `sub`, email, algorithm, key). | Oracle |
| `SupabaseTokenVerifier` | The accepted caller always has `email` equal to `lowercase(trim(claims.email))`, `id = sub`, and `aal` in {aal1, aal2} | Invariant |
| Staff email | `normalize(normalize(e)) = normalize(e)`; casing and surrounding spaces never change the result | Idempotence |
| Profile update | Fields not sent are never changed | Invariant |

## 9. Story and Requirement Coverage

| Story | How |
|---|---|
| US-1.1 (email code) | Supabase Auth (owner setting: custom SMTP via Resend, O5); the API accepts its tokens (T1–T7) |
| US-1.2 (Google) | Supabase Google provider (O17); same token rules; U6 adds the button |
| US-1.3 (every request checked) | T1–T8, 404 for events without a role (U3 guard) |
| US-1.4, US-1.5 (MFA) | `aal` claim and `@RequireMfa()`; enrolment UI in U7 and U6 |

**Security compliance:**
- **SECURITY-08:** deny by default; token checked on every request; staff routes hidden.
- **SECURITY-12:** passwordless sign-in; MFA for staff and money actions; sessions expire on the server (15 minutes); secrets only in settings.
- **SECURITY-03:** no tokens in logs.
- **SECURITY-11:** refusal metrics feed the abuse alert.
