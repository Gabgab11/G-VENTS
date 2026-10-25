# Security Test Instructions

## Dependency audit (production dependencies)

```bash
npm audit --omit=dev     # in both repositories
```

**Result (2026-10-25):** 0 vulnerabilities in both, after these fixes from this stage:

| Repository | Advisory | Fix |
|---|---|---|
| G-VENTS | **Next.js critical:** RCE in image optimisation with SVG; Server Actions DoS | `next` 15.5.27 → 15.5.28 |
| G-VENTS | PostCSS (high, build-time) | override 8.5.29 inside `next` |
| gventz-api | **Fastify high:** schema validation bypass; X-Forwarded spoofing with hop counts | 5.11.3 → 5.12.7, forced inside `@nestjs/platform-fastify`; `trustProxy` is now a one-hop function |
| gventz-api | js-yaml (moderate, in `@nestjs/swagger`) | override 5.4.3 |

CI runs Dependabot (gventz-api `.github/dependabot.yml`). Keep `npm audit --omit=dev` at zero before each release.

## Checks built into the tests
- **Tokens:** ES256/RS256 only, issuer and audience, anonymous refused (identity integration tests).
- **Permissions:** 404 for outsiders, 403 without the permission, on every event route (integration tests); the website's dashboard shows "Page not found" to non-members (smoke).
- **Fail-closed limits** without Redis (redis-down tests).
- **Validation:**
  - problem details never leak internals; 5xx are generic
  - API error codes reach the website's URL only as codes shown from a fixed table
- **CSV injection** protection (PBT).
- **Ticket codes:** 96-bit, strict format check before any query.
- **Flyers:** type checked from the bytes, size checked, paths built by the API, deletes only inside the event's folder.
- **`/api/revalidate`:** HMAC with a 5-minute window, constant-time compare, public paths only (unit tests and smoke).
- **Headers:**
  - CSP: no external script sources, `object-src 'none'`, `frame-ancestors 'none'`, connections only to the site and Supabase
  - HSTS on the API
  - COOP; `camera=(self)` only
- **Secrets:** server-side only (the website has no Supabase secret, Google, Resend or Storage keys any more).

## To do before go-live
- **ZAP baseline scan** of the staging website and API (`zap-baseline.py -t https://<staging>`); review the findings.
- **Supabase advisors** (Security and Performance) on staging and production.
