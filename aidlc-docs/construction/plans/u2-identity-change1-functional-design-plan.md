# U2 Identity (Change 1, replaced) — Functional Design Plan (light)

U2 no longer signs people in. Supabase Auth does that, with email codes and Google (D32). The API only needs to:
1. check each request's Supabase access token, locally, using Supabase's public keys (AD14)
2. say who the caller is and whether they used two-step sign-in (`aal2`)
3. recognise G-ventZ platform staff (AD15)
4. serve the caller's profile (`GET /me`, `PATCH /me` in M2)

The version 1 U2 design (email codes, sessions, Google sign-in on our side) is superseded. It's kept in `u2-identity/functional-design/`, and the code is in the snapshot.

Put your choice after each `[Answer]:` tag, and save the file before replying.

## Plan

- [x] 1. Collect and analyze answers
- [x] 2. Write `u2-identity/functional-design/change1-identity.md`:
  - token rules (which claims, what's refused)
  - the caller model (`AuthenticatedUser`)
  - MFA step-up rule
  - platform staff rules and the `platform_staff` migration
  - profile rules
  - error codes
  - testable properties (PBT-01)
- [x] 3. Check against stories US-1.1 to US-1.5, FR-1, SECURITY-08 and SECURITY-12

## Questions

### Question 1 — How long a signed-out session can keep working
Supabase access tokens are checked locally, with no network call per request (NFR-2). When someone signs out, their current token keeps working until it expires. Supabase's default is **1 hour**.

A) **Shorten Supabase's access-token lifetime to 15 minutes** (Supabase dashboard → Auth → Sessions; an owner setting) and keep the local check.
   - A token stays usable for at most 15 minutes after sign-out.
   - The browser refreshes tokens in the background, so users notice nothing.
   - (Recommended)

B) Keep 1 hour.

C) Also check Supabase's session table on every request, so sign-out takes effect at once. This adds a database read to every request, which matters at 50 purchases a second.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — Anonymous Supabase users
Supabase can create "anonymous" signed-in users with no email. G-ventZ needs a verified email for tickets.

A) **Refuse anonymous tokens** with 401. Only users who signed in with an email code or Google are accepted. (Recommended)

B) Accept them for reading only.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — A signed-in user without a profile row
Today Supabase's `handle_new_user` trigger creates the `profiles` row when an account is created, so a missing profile should never happen. It could for accounts created before the trigger existed, or after a partial restore.

A) **Create the profile on first API call** if it's missing, from the token's email. Logged as a warning so we can see it. (Recommended)

B) Refuse with 409 "profile missing" and investigate by hand.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4 — Who the first platform staff are
Platform staff can change G-ventZ fee rates and see reconciliation (from M4). The `platform_staff` table is managed by SQL only.

A) **Add them through a small migration** with each person's email address. It looks up their user id when it runs, so they must have signed in once before. Adding or removing someone later is another migration, so every change is reviewed and recorded. (Recommended)

B) Insert them by hand in the Supabase SQL editor. Faster, but it breaks the "no hand edits to live databases" rule.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

Staff email address(es), if known now: stefaneey@gmail.com
