# U2 Identity — Domain Entities

Answers used (u2-identity-functional-design-plan.md, all A):
- **Q1, Q2:** code request limits; same answer whether or not the account exists.
- **Q3, Q4:** sessions last 30 days idle, 90 days at most; sign-out plus "sign out of all devices".
- **Q5, Q6:** Google links to an unconfirmed account; Google fills the name.
- **Q7:** sender `no-reply@gventz.com`.
- **Q8:** mobile ready but off.

Module: `src/modules/identity/`. It uses the U1 building blocks (`AggregateRoot`, `ValueObject`, `DomainError`, `Email`, `Clock`, `IdGenerator`).

## Aggregates

### `User`
| Field | Type | Notes |
|---|---|---|
| id | `UserId` | Kept from Supabase for existing users; UUID v7 for new ones |
| email | `Email` | Unique (case-insensitive) |
| emailVerifiedAt | `Date \| null` | Set by a successful code sign-in or Google sign-in |
| fullName | `PersonName \| null` | 2–120 characters, trimmed |
| country | `string \| null` | 2–56 characters (today's free list) |
| dashboardTheme | `DashboardTheme` | One of the 10 themes |
| identities | `ExternalIdentity[]` | Loaded with the user |
| createdAt, updatedAt | `Date` | — |

Behaviour:
- `User.register(id, email, now, { verified, fullName? })` records `UserRegistered`.
- `markEmailVerified(now)` is a no-op if already verified.
- `linkGoogle(subject, email, now)` records `GoogleAccountLinked`. It throws `IdentityAlreadyLinked` if the subject is already on another user (checked by the service).
- `touchGoogle(subject, email, now)` updates `lastUsedAt` and the email seen at Google.
- `updateProfile({ fullName?, country? })` and `setDashboardTheme(theme)`.

### `ExternalIdentity` (entity inside `User`)
Fields: id, provider (`google`), subject (Google `sub`), email at Google, createdAt, lastUsedAt.

### `SignInCode`
| Field | Type | Notes |
|---|---|---|
| id | uuid | — |
| email | `Email` | — |
| codeHash | string | HMAC-SHA256 of the 6 digits with `SIGN_IN_CODE_SECRET` |
| attemptsLeft | 0..5 | Starts at 5 |
| expiresAt | Date | Issued + 10 minutes |
| consumedAt | Date \| null | Set on success, when superseded, or when attempts run out |
| createdAt | Date | — |

Behaviour:
- `SignInCode.issue(id, email, codeHash, now)` records `SignInCodeIssued`. The event carries the plain code, for the email job only.
- `verify(candidateHash, now)`. On success it sets `consumedAt` and returns. Otherwise it throws:
  - `SignInCodeExpired` when `now ≥ expiresAt`
  - `SignInCodeUsed` when already consumed
  - `SignInCodeInvalid` when the hash doesn't match; it decrements `attemptsLeft`, and at 0 sets `consumedAt` and throws `SignInCodeAttemptsExceeded`
- `supersede(now)` sets `consumedAt` when a newer code is issued for the same email.

### `Session`
| Field | Type | Notes |
|---|---|---|
| id | uuid | Carried in the access token as `sid` |
| userId | `UserId` | — |
| clientType | `ClientType` | `web` \| `mobile` |
| createdAt | Date | — |
| lastUsedAt | Date | Updated on every refresh |
| absoluteExpiresAt | Date | createdAt + 90 days (Q3 A) |
| revokedAt, revokedReason | Date \| null, `sign_out` \| `sign_out_all` \| `refresh_reused` \| null | — |
| userAgent, ipForLogs | string \| null | Truncated IP only |
| currentToken | `RefreshTokenRecord` | Hash, issuedAt |
| previousTokens | `RefreshTokenRecord[]` | Rotated tokens, kept to detect reuse |

Derived: `idleExpiresAt = lastUsedAt + 30 days`; `expiresAt = min(idleExpiresAt, absoluteExpiresAt)`.

Behaviour:
- `Session.start(id, userId, client, tokenHash, now, meta)`
- `rotate(presentedHash, nextHash, now)` returns the outcome:
  - **current token, active:** rotate.
  - **previous token rotated less than 30 s ago:** throw `RefreshTokenSuperseded`, no revocation (parallel refresh by the same client).
  - **previous token older than that:** `revoke('refresh_reused')`, record `RefreshTokenReuseDetected`, throw `RefreshTokenReused`.
  - **revoked:** throw `SessionRevoked`.
  - **expired:** throw `SessionExpired`.
- `revoke(reason, now)` is idempotent.

## Value objects
| Value object | Rules |
|---|---|
| `SignInCodeValue` | Exactly 6 ASCII digits. Generated with `crypto.randomInt(0, 1_000_000)`, zero-padded. |
| `RefreshToken` | 32 random bytes, base64url (43 characters). Only its SHA-256 is stored. |
| `ClientType` | `web` \| `mobile` |
| `PersonName` | Trimmed, 2–120 characters, no control characters |
| `DashboardTheme` | One of `minimal, sunset, ocean, forest, night, ember, blush, mint, lavender, christmas` |
| `PkceVerifier` | 32 random bytes, base64url (43 characters). Challenge = base64url(SHA-256(verifier)), method `S256`. |
| `AccessTokenClaims` | `iss`, `aud`, `sub` (userId), `sid` (sessionId), `iat`, `exp` (iat + 900 s). No email, no roles. |

## Domain events
| Event | Payload | Handled by |
|---|---|---|
| `identity.sign_in_code_issued` | codeId, email, signInCode, expiresAt | `SignInEmailHandler` → email job (secret) |
| `identity.user_registered` | userId, method | (none yet; later analytics) |
| `identity.google_account_linked` | userId | (none yet; audit is written in the transaction) |
| `identity.refresh_token_reuse_detected` | userId, sessionId | (none yet; audit is written in the transaction) |

## Tables (added by the U2 migration)

### user_identities
| Column | Type | Rules |
|---|---|---|
| id | uuid PK | — |
| user_id | uuid → users on delete cascade | Indexed |
| provider | text | check `provider in ('google')` |
| subject | text | — |
| email | text | As seen at the provider |
| created_at, last_used_at | timestamptz | — |
| | | unique `(provider, subject)` |

### sign_in_codes
| Column | Type | Rules |
|---|---|---|
| id | uuid PK | — |
| email | text not null | Normalized |
| code_hash | text not null | — |
| attempts_left | smallint not null default 5 | check 0..5 |
| expires_at, created_at | timestamptz not null | — |
| consumed_at | timestamptz null | — |
| | | index `(email, created_at desc)`; partial index on `expires_at` where `consumed_at is null` (cleanup) |

### sessions
| Column | Type | Rules |
|---|---|---|
| id | uuid PK | — |
| user_id | uuid → users on delete cascade | Indexed |
| client_type | text | check `in ('web','mobile')` |
| created_at, last_used_at, absolute_expires_at | timestamptz not null | — |
| revoked_at | timestamptz null | — |
| revoked_reason | text null | check `in ('sign_out','sign_out_all','refresh_reused')` |
| user_agent | text null | ≤ 255 |
| ip_for_logs | text null | Truncated IP |

### refresh_tokens
| Column | Type | Rules |
|---|---|---|
| id | uuid PK | — |
| session_id | uuid → sessions on delete cascade | Indexed |
| token_hash | text not null unique | SHA-256 hex |
| issued_at | timestamptz not null | — |
| rotated_at | timestamptz null | null = the current token |
| | | partial unique index on `session_id` where `rotated_at is null`: only one current token per session |

Cleanup (U2 code generation, a daily worker job):
- Delete `sign_in_codes` older than 1 day.
- Delete `refresh_tokens` and `sessions` 30 days after expiry or revocation.
