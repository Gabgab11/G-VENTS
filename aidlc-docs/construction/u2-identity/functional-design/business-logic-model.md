# U2 Identity — Business Logic Model

All write flows run in `@Transactional()` service methods (U1 UnitOfWork). Events are dispatched after commit.

## 1. Request a code — `EmailCodeSignInService.requestCode(email, client)`
```text
email = Email.parse(input)
rateLimiter.consume(signInCode.email, email)      fail closed
rateLimiter.consume(signInCode.ip, clientIp)      fail closed
[tx]
  for each unconsumed code of email: supersede(now)
  code = SignInCodeValue.generate()
  signInCode = SignInCode.issue(id, email, hmac(code), now)   records SignInCodeIssued(code)
  repo.save(...)                                             events collected
[commit] -> SignInEmailHandler: if not globally suppressed -> email queue
            job 'sign-in-code' {email, signInCode, expiresAt}, jobId sign-in-code.{id}, secret
return 202 generic message
```

## 2. Verify a code — `EmailCodeSignInService.verifyCode(email, code, client)`
```text
rate limits (verify.email, verify.ip)
[tx]
  latest = codes.findLatestForUpdate(email)        none -> auth.code_invalid
  latest.verify(hmac(code), now)                   throws (wrong code still saves attempts--)
  user = users.findByEmail(email)
       ?? User.register(newId, email, now, {verified: true})
  user.markEmailVerified(now)
  session, refresh = SessionService.start(user, client, now)
  audit auth.signed_in {method: email_code, client}
return TokenPair + user + isNewUser
```
A wrong code must still persist the decremented attempts. So `verify` failures are caught inside the service, the code is saved in its own transaction (`Propagation.RequiresNew`), and then the error is rethrown.

## 3. Google — `GoogleSignInService`
```text
start(redirectUri, client):
  assert redirectUri in allowlist
  state, nonce, verifier = random; challenge = S256(verifier)
  redis SET oidc:{state} {verifier, nonce, redirectUri, client} EX 600
  return { authorizationUrl, state }

complete(code, state, client):
  attempt = redis GETDEL oidc:{state}                  none -> auth.google_state_invalid
  tokens = google.exchange(code, attempt.verifier, attempt.redirectUri)   5 s timeout
  claims = google.verifyIdToken(tokens.idToken, nonce = attempt.nonce)
  require claims.email_verified
  [tx]
    user = AccountLinker.resolve(claims, now)    (table GS6; records link/registration)
    session = SessionService.start(user, client, now)
    audits
  return TokenPair + user + isNewUser
```

## 4. Refresh — `SessionService.refresh(token)`
```text
rate limit refresh.ip (fail open)
hash = sha256(token)
[tx]
  record = refreshTokens.findByHashForUpdate(hash)     none -> auth.refresh_invalid
  session = sessions.findForUpdate(record.sessionId)
  outcome = session.rotate(hash, sha256(newToken), now)     (table TS4)
  on reuse: session.revoke(refresh_reused); audit; save; commit; then throw auth.refresh_reused
  save session (marks old rotated, inserts new current)
return TokenPair
```
The row locks on the token and its session serialize two refreshes racing with the same token. The second one sees `rotated_at` already set and takes the "superseded" path.

## 5. Sign-out / sign-out-all
```text
signOut(principal):     [tx] session.revoke(sign_out)       -> 204
signOutAll(principal):  [tx] for each active session: revoke(sign_out_all); audit once -> 204
```

## 6. Guard (every request) — `AccessTokenGuard`
```text
public = @Public() on handler or class
header = Authorization: Bearer x
if !header: public ? allow : 401 auth.token_missing
claims = jwt.verify(x)    (local; HS256; iss; aud; exp ±30 s)
  expired -> public ? allow : 401 auth.token_expired
  invalid -> public ? allow : 401 auth.token_invalid
requestContext.setPrincipal({ userId: claims.sub, sessionId: claims.sid })
```
`@CurrentUser()` reads the principal. Using it on a route without a principal is a programming error, caught by an e2e test.

## 7. Sign-in email job — `EmailProcessor` (worker role only)
```text
job 'sign-in-code' {email, signInCode, expiresAt}
message = EmailComposer.signInCode(email, signInCode)
mailer.send(message, idempotencyKey = job.id)
  4xx (not 429) -> UnrecoverableError (no retry), log job.failed_permanently
  429/5xx/network -> throw (BullMQ retries 5x with backoff)
```
Processors are registered only when `APP_ROLE` is `worker` or `all` (closes the U1 known gap).

## 8. Housekeeping — daily repeatable job `identity.cleanup` (worker)
- Delete sign-in codes created more than 1 day ago.
- Delete sessions (with their tokens, by cascade) revoked or expired more than 30 days ago.

## 9. Testable Properties (PBT-01)

| Component | Property | Category |
|---|---|---|
| `SignInCodeValue` | Generated codes are always exactly 6 ASCII digits; parse(format(c)) = c | Invariant, Round-trip |
| `SignInCode` | Against a model, for any sequence of verify attempts (right or wrong code, random times): success happens at most once; only before expiry and only while attempts remain; after 5 wrong attempts even the right code fails; `attemptsLeft` never goes below 0 | Stateful (PBT-06) |
| `SignInCode` | Verifying a consumed code always fails, whatever the input | Idempotence |
| `Session` rotation | For any sequence of refresh calls using the current token, an old token (inside or outside 30 s) or after revoke, the outcome matches a reference state machine: rotate, superseded, reused → revoked, revoked, expired | Stateful (PBT-06) |
| `Session` expiry | `expiresAt = min(lastUsedAt + 30 d, createdAt + 90 d)` after any sequence of refreshes, and it never exceeds `createdAt + 90 d` | Invariant |
| `JwtAccessTokenSigner` | verify(sign(claims)) = claims for random user and session ids and times | Round-trip |
| `JwtAccessTokenSigner` | Changing any byte of a signed token makes verification fail | Invariant |
| `PkceVerifier` | The challenge equals a reference base64url(SHA-256(verifier)) computation; verifiers are 43 characters from the allowed set | Oracle, Invariant |
| `AccountLinker` | For every combination of (identity exists, user with email exists, email verified), the action matches the GS6 decision table | Oracle |
| `Email` composition | For any email and code, the HTML contains the code, and no `<`, `>`, `"` taken from inputs appears unescaped | Invariant |
| `RefreshToken` | Generated tokens are 43 base64url characters, and the stored hash is never equal to the token | Invariant |

No PBT properties identified for:
- **`ResendMailer`:** an HTTP adapter, covered by example tests with a mocked `fetch`.
- **The Google client adapter:** wraps `openid-client`, covered by example tests with a fake issuer.
- **Controllers:** covered by e2e tests.
