# U2 Identity — Functional Design Plan

U2 covers who the caller is:
- **Sign-in:** email code and Google, with account linking.
- **Sessions:** access and refresh tokens, sign-out.
- **Profile:** read and update, including dashboard theme.
- **Email core** for the sign-in code: Mailer, Resend adapter, email queue processor.
- **The access-token guard** every other module uses.

FR-1 already sets most rules: 6-digit code, 10-minute expiry, 5 attempts, latest code only, 15-minute access tokens, rotating refresh tokens stored hashed, 30 days of inactivity, reuse revokes the family, Google PKCE with `state` and `nonce`, link by verified email. The questions below cover what FR-1 leaves open.

Please fill in each `[Answer]:` tag with a letter, or X plus your own text, then tell me "done".

## Plan

- [x] 1. Collect and analyze answers below
- [x] 2. `domain-entities.md`: `User` (+ `ExternalIdentity`), `SignInCode`, `Session`, value objects (`SignInCodeValue`, `RefreshToken`, `ClientType`, `DashboardTheme`), domain events, new tables (`user_identities`, `sign_in_codes`, `sessions`, `refresh_tokens`) and their constraints
- [x] 3. `business-rules.md`: code issue and verify rules, rate limits, Google flow and linking rules, token and session rules (lifetimes, rotation, reuse, revocation), profile rules, return-path rules, errors and their codes, audit entries
- [x] 4. `business-logic-model.md`: flows for request code, verify code, Google start and callback, refresh, sign-out, sign-out everywhere, profile update, sign-in email job; the guard's per-request check
- [x] 5. Testable Properties (PBT-01) for every U2 component
- [x] 6. Validate against FR-1, NFR-5 and the U1 platform contracts

## Questions

### Question 1 — Limits on requesting a sign-in code
FR-1 says code requests are rate limited per email and per IP, but not by how much.

A) Per email: one request every 60 seconds, and at most 5 an hour. Per IP: 20 an hour. A request inside the 60-second window gets 429 with `Retry-After`, so the page can show a countdown. (Recommended)

B) Per email: 3 an hour. Per IP: 10 an hour. Stricter, but a guest who mistypes twice may get stuck.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — Does asking for a code reveal whether an account exists?
A) No. `POST /auth/email/code` always answers the same way ("If that address can receive email, a code is on its way"), whether or not an account exists. The account is created when the code is verified, as today. (Recommended)

B) Tell the user whether it's a new or existing account, so the page can say "Welcome back" or "Create your account"

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — How long a signed-in session can last
FR-1: a refresh token expires after 30 days without use.

A) 30 days without use, and at most 90 days in total. After 90 days the user signs in again even if active. (Recommended)

B) 30 days without use, no total limit: an active user stays signed in indefinitely

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4 — Signing out
A) "Sign out" ends the current session only. A separate "Sign out of all devices" ends every session for the account (useful after a lost phone). (Recommended)

B) Current session only

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5 — Google sign-in when the existing account's email was never confirmed
Some existing users may have a Supabase account whose email was never confirmed.

A) Link anyway. Google has confirmed the address, so the account becomes verified and keeps all its events and tickets. (Recommended)

B) Refuse, and ask the user to sign in with an email code first

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 6 — Name on new accounts
Today the name is entered at registration and stored on the ticket. The profile name is optional.

A) Google sign-up fills the profile name from Google. Email-code sign-up leaves it empty. The frontend can ask for it later, and the registration form pre-fills from it when set. (Recommended)

B) Require a name before the account can be used (an extra step after the first email-code sign-in)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 7 — Sender of sign-in emails
A) `G-ventZ <no-reply@gventz.com>`, with the subject "Your G-ventZ sign-in code: 123456". Ticket emails (U4) use the same sender. Until `gventz.com` is verified in Resend (O5), the test sender delivers only to the Resend account owner. (Recommended)

B) Another address (write it after X)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 8 — Mobile app sign-in with Google
The mobile app is planned (D20) and its details aren't known yet.

A) Design for it now but leave it switched off. The redirect-URI allowlist (`GOOGLE_REDIRECT_URIS`) decides which callbacks are accepted. A mobile deep link such as `gventz://auth/google` is added to the list when the app exists. Mobile clients send `client: "mobile"` and get tokens in the response body. (Recommended)

B) Leave mobile sign-in out of U2 entirely and design it with the app

X) Other (please describe after [Answer]: tag below)

[Answer]: A
