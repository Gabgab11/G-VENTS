# U1 Platform Foundation — Business Logic Model

## 1. Request lifecycle (API role)

```text
HTTP request
 1. RequestIdMiddleware      keep or create x-request-id; bind to log context
 2. Body size limit          > 100 KB -> 413
 3. AccessTokenGuard         @Public()? skip : verify JWT locally -> 401 problem
 4. Route guards             e.g. EventPermissionGuard (U3) -> 404 when no access
 5. ValidationPipe           DTO rules -> 400 validation.failed with errors[]
 6. Controller               maps DTO -> service call
 7. Service (@Transactional) loads aggregates, calls domain, saves
      repositories hand recorded DomainEvents to the collector
      AuditTrail.record() inside the same transaction
 8. Commit                   on success; any throw rolls back and drops events
 9. DomainEventBus           dispatch collected events in order (after commit)
      handlers enqueue jobs (deterministic jobId)
10. Response                 2xx DTO, or ProblemDetailsFilter -> problem+json
11. Access log               method, route, status, duration, requestId, userId
```

Failure paths:
- **A `DomainError` thrown at any step:** mapped by kind (business-rules §1), logged at info for 4xx.
- **Any other error:** logged at error level with the stack, and the client gets `internal_error` (500).
- **Handler failure after commit:** logged, and the response is unaffected (rule D4).

## 2. Job lifecycle (worker role)

```text
enqueue(queue, name, payload, jobId)   duplicate jobId -> no-op
  -> worker picks job
     -> processor runs (adapter call with timeout)
        success -> remove (secret payload) or keep 1 h
        failure -> retry with backoff 2,4,8,16,32 s (5 attempts)
                   last failure -> error log, keep 7 days
```

- Processors are idempotent. The jobId is passed to outside services that support idempotency keys (Resend).
- When `APP_ROLE=all` (M1), the API and the processors run in one process, connected to the same Redis.

## 3. Rate-limit check

```text
consume(policy, subject):
  for each window in policy:
    key = rl:{policy}:{subject}:{floor(now / window) * window}
    count = INCR key; on first increment EXPIRE key window
  allowed = every count <= its limit
  if Redis error: allowed = (policy.onStoreFailure == 'allow'); log warning
  if not allowed: throw RateLimitExceeded(retryAfter = seconds until the latest blocking window resets)
```

## 4. Domain event collection

```text
@Transactional service method
  repo.save(aggregate)
     -> persist rows
     -> collector.add(aggregate.pullEvents())   (collector lives in CLS for this transaction)
  on commit   -> bus.dispatch(collector.drain()) in recorded order
  on rollback -> collector.clear()
```

Nested `@Transactional()` calls join the outer transaction. Events dispatch once, when the outermost transaction commits.

## 5. Pagination

```text
Page-number:  rows = query ORDER BY <keys>, id LIMIT pageSize OFFSET (page-1)*pageSize
              total = count(*) with the same filter
Cursor:       keys = Cursor.decode(cursor) (or none)
              rows = query WHERE (<keys>) > (:keys) ORDER BY <keys> LIMIT limit+1
              nextCursor = rows.length > limit ? Cursor.encode(keysOf(rows[limit-1])) : null
```

## 6. Startup

```text
load env -> validate (business-rules §9) -> fail fast naming missing settings
connect pool + Redis (lazy; readiness reports state)
APP_ROLE api|all    -> HTTP server, OpenAPI at /openapi.json (+ /docs outside production)
APP_ROLE worker|all -> register queue processors
SIGTERM -> stop accepting requests, finish in-flight (≤ 25 s), close workers, pool and Redis
```

## 7. Testable Properties (PBT-01)

| Component | Property | Category |
|---|---|---|
| `Email` | `Email.parse(Email.parse(x).toString())` equals `Email.parse(x)` for every accepted `x` | Round-trip, Idempotence |
| `Email` | Every accepted value is lowercase, trimmed and ≤ 254 characters | Invariant |
| `Money` | `a.add(b)` equals `b.add(a)`; `(a+b)+c` equals `a+(b+c)` for the same currency | Commutativity |
| `Money` | Results are always safe non-negative integers; mixing currencies always throws `CurrencyMismatch` | Invariant |
| `Cursor` | `Cursor.decode(Cursor.encode(keys))` equals `keys` for any array of strings, numbers and ISO dates | Round-trip |
| `Cursor` | `Cursor.decode(s)` for any arbitrary string either returns keys or throws `ValidationFailed`, never anything else | Invariant |
| `PageRequest` / pager | Concatenating every page of an in-memory list (any length, any page size) gives the list exactly once, in order | Oracle |
| `PageRequest` | `offset ≥ 0`, and every page has at most `pageSize` items | Invariant |
| `ProblemDetailsFilter` | For any `DomainError` (random kind, code, message), `status` matches the kind table and `body.code === error.code` | Invariant |
| `ProblemDetailsFilter` | For any non-domain error with a random message, the body never contains that message | Invariant |
| `RateLimiter` | For any sequence of `consume` calls with random timestamps, allowed/denied matches an in-memory model of fixed windows | Oracle (model-based) |
| `DomainEventBus` + transaction | For random sequences of saves, then commit or rollback: commit dispatches exactly the recorded events in order; rollback dispatches none | Stateful (PBT-06) |
| `RequestIdMiddleware` | The output id always matches the allowed pattern, and a valid incoming id is returned unchanged | Invariant, Idempotence |
| `IanaTimeZone` | For any zone in `Intl.supportedValuesOf('timeZone')`, construction succeeds and `toString()` returns the input | Round-trip |

No PBT properties identified for:
- **Config validation:** a fixed set of required keys, so example tests per role cover it.
- **Health checks:** binary I/O checks, covered by integration tests.
- **Audit trail:** behaviour is "written if and only if the transaction commits", covered by integration tests on real Postgres.
- **Logging redaction:** checked with example tests over the known sensitive fields.
