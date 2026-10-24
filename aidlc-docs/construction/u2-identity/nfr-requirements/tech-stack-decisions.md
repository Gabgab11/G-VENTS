# U2 Identity — Tech Stack Decisions

Additions to the U1 stack (u1-platform-foundation/nfr-requirements/tech-stack-decisions.md). Exact versions are pinned in `package-lock.json` at code generation.

| Concern | Choice | Reason | Rejected |
|---|---|---|---|
| Access tokens | `jose`, HS256 with `kid` (Q1 A) | Already in U1. Algorithm pinning, key rotation through `kid`, no native dependencies | `jsonwebtoken` (weaker algorithm handling); ES256 now (key management not yet needed) |
| Google OpenID Connect | `openid-client` v6 (Q2 A) | Certified OpenID Connect client. Discovery, PKCE, `state` and `nonce`, ID-token validation, cached signing keys | `google-auth-library` (Google-only, larger); hand-written flow (risky) |
| Fake OIDC issuer for tests | `oauth2-mock-server` (dev only) | Real signed ID tokens and discovery endpoints locally, so Google flows are tested without Google | Mocking `openid-client` internals |
| Hashing | Node `crypto`: HMAC-SHA256 (codes), SHA-256 (refresh tokens), `randomInt`, `randomBytes`, `timingSafeEqual` | Built in, constant-time compare available. High-entropy tokens don't need slow hashing. | bcrypt/argon2 (unnecessary for random tokens; slower) |
| Email sending | Resend HTTP API through `fetch`, behind `Mailer` (free plan until M3, Q3 A) | Same provider as today. No SDK needed. Idempotency key supported | Resend SDK (adds a dependency for one endpoint); SMTP |
| Email templates | Typed TypeScript template classes with an `escapeHtml` helper | Two templates (sign-in, ticket), fully testable, no template engine needed | Handlebars/MJML (more than needed now) |
| QR code image (for U4 tickets) | Decided in U4 | — | — |
| PBT | fast-check (PBT-09, from U1) | — | — |

## Configuration
The new settings are listed in business-rules §10 and added to `EnvironmentVariables` with role-aware required rules:
- **API in production:** `JWT_*`, `SIGN_IN_CODE_SECRET` and `GOOGLE_*`.
- **Worker in production:** `RESEND_API_KEY` and `EMAIL_FROM`.
