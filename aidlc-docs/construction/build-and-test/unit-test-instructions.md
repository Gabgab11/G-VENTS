# Unit Test Execution

## gventz-api: unit and property tests (Vitest + fast-check)

```bash
npm test               # src/**/*.spec.ts (unit + PBT)
npm run test:pbt       # property tests only
FC_SEED=<seed> FC_PATH=<path> npm test   # replay a property failure
```

- **Expected:** all pass (unit + PBT: about 300 tests in 66 files).
- **Coverage gate (80% of lines)** is measured over unit + integration together; see integration-test-instructions.md. Unit tests alone cover about 58% of lines; repositories and controllers are exercised by integration tests.

## G-VENTS: unit tests (Vitest)

```bash
npm test                # 59 tests
```

Covered:
- the API client (problem details, headers)
- the event form → API mapping
- the order form → API mapping
- scan screen texts
- `/api/revalidate` signature and path allow-list
- CSP and security headers
- dates, locations, redirects, validation

## Property-based testing (PBT-01…09)
Properties by unit are listed in each unit's business-logic model and code summary, among them:
- the outbox relay
- UnitOfWork
- breaker state
- the keyed gate
- event schedule and slug
- inventory admit (oracle), the inventory sequence (stateful), allowance and transitions
- AnswerSet, CSV and ICS round-trips
- flyer sniffing and paths
- region ordering
- the revalidation signature and debounce ids

Seeds print on failure.
