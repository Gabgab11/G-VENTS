# U2 Identity — NFR Design Plan

Most U2 patterns follow from decisions already made:
- **Tokens:** HS256 with `kid`; codes and refresh tokens stored as hashes.
- **Limits and Redis:** fail-closed rate limits; single-use OIDC state in Redis.
- **Concurrency and email:** row-locked refresh; job retries with idempotency keys.

One real trade-off is left.

Please fill in the `[Answer]:` tag with a letter, or X plus your own text, then tell me "done".

## Plan

- [x] 1. Collect and analyze the answer below
- [x] 2. `nfr-design-patterns.md`
  - [x] 2.1 Security patterns: key ring and rotation, hashing, constant-time compare, OIDC state store, enumeration-safe responses
  - [x] 2.2 Resilience: Google and Resend timeouts and errors, Redis-down behaviour per endpoint, refresh race handling
  - [x] 2.3 Performance: local token check, indexes, prepared statements, OIDC discovery and key caching
  - [x] 2.4 Rate-limit policies (names, windows, fail mode)
  - [x] 2.5 Housekeeping job and worker-only processor registration
- [x] 3. `logical-components.md`: Identity components, ports and adapters, with config and failure behaviour; diagram
- [x] 4. Validate against U2 NFR requirements and functional design

## Question

### Question 1 — How quickly sign-out takes effect for access tokens already issued
By design the access-token check is local (no database or Redis lookup), so an access token keeps working for up to 15 minutes after sign-out. On the web, Next.js deletes the cookies at sign-out, so in practice this only matters if a token was copied or stolen.

A) Keep it local, as designed. Sign-out is immediate for refresh, and access tokens expire within 15 minutes. It's the fastest option and has no Redis dependency on every request. (Recommended for M1; can be tightened later without API changes)

B) Also check a Redis list of revoked sessions on every request (one Redis lookup, about 1 ms). Sign-out and "sign out of all devices" then take effect at once. If Redis is down, the check is skipped (fail open), so the API stays available.

X) Other (please describe after [Answer]: tag below)

[Answer]: A
