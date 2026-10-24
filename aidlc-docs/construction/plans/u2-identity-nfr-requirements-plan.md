# U2 Identity — NFR Requirements Plan

U2 inherits the U1 baseline: Fastify, pool limits, timeouts, logging and redaction, rate limiter, job retries, Testcontainers, fast-check. These questions cover what is specific to sign-in.

Please fill in each `[Answer]:` tag with a letter, or X plus your own text, then tell me "done".

## Plan

- [x] 1. Collect and analyze answers below
- [x] 2. `nfr-requirements.md`: latency targets per auth endpoint, token-check cost, security requirements (secrets, hashing, timing, token handling), reliability of Google and Resend calls, email volume, testing requirements for U2
- [x] 3. `tech-stack-decisions.md`: libraries for JWT, Google OIDC, email, HTML templating, with reasons and rejected alternatives; PBT framework confirmed (PBT-09)
- [x] 4. Validate against U2 functional design and requirements NFR-2, NFR-5, NFR-7

## Questions

### Question 1 — How access tokens are signed
A) HS256 with a shared secret held only by the API (as designed). It's the simplest option, and only the API verifies tokens. The `kid` header means a switch to asymmetric keys later is a configuration change, not a redesign. (Recommended)

B) ES256 (a private key signs, a public key verifies) from day one. Other services or the mobile app could verify tokens without holding a secret. It adds key management now.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — Library for Google sign-in
A) `openid-client` (v6). It's certified for OpenID Connect, handles PKCE, `state`, `nonce`, ID-token validation and Google's signing keys, and is maintained by the author of `jose`, which we already use. (Recommended)

B) `google-auth-library` (Google's own Node library). It's Google-specific and bigger.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — Resend plan (sign-in codes, and ticket emails from U4)
Resend's free plan has a small daily cap: at the time of writing about 100 emails a day and 3,000 a month (check Resend's pricing page). A single busy event day can exceed 100 sign-in codes and tickets.

A) Free plan for staging and M1. Move to the smallest paid plan before the production cutover (M3), and add that step to the cutover checklist. (Recommended)

B) Paid plan from now on

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4 — Speed targets for sign-in, measured on the API and excluding time spent at Google and Resend
A) p95 targets (Recommended, consistent with NFR-2):
- Request code: < 150 ms. The email is sent later by the worker.
- Verify code: < 200 ms.
- Refresh: < 100 ms.
- Google callback: < 300 ms of our own time; Google's token exchange adds its own.
- Access-token check on every request: < 1 ms.

B) No separate targets; NFR-2's general read and write targets apply

X) Other (please describe after [Answer]: tag below)

[Answer]: A
