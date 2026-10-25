# Smoke tests (local)

End-to-end checks of the built website against gventz-api and local Supabase. They sign in through
Supabase's cookie helper, call the real Server Actions (encoded with React's `encodeReply`) and
read the rendered pages. Local only: they use the Supabase CLI's local keys.

1. `node supabase/scripts/gen-signing-key.mjs` once, then `npx supabase start`.
2. Run gventz-api on port 4000 against the local database (`DATABASE_URL=postgres://gventz_api:<local password>@127.0.0.1:54322/postgres`, `SUPABASE_URL=http://127.0.0.1:54321`, `SUPABASE_SECRET_KEY` from `npx supabase status`, `BFF_SHARED_SECRET`, `REVALIDATE_URL=http://localhost:3000/api/revalidate`, `REVALIDATE_SECRET`).
3. `npx next build && npx next start -p 3000` with `API_URL=http://localhost:4000`, the same `BFF_SHARED_SECRET` and `REVALIDATE_SECRET`, and the local Supabase URL and publishable key.
4. `node scripts/smoke/smoke-u6a.mjs` (tickets, 12 checks) and `node scripts/smoke/smoke-u6b.mjs` (dashboard, 33 checks).

`smoke-u6b.mjs` signs page-refresh calls with `local-revalidate-secret-0123456789abcdef`; use that value locally or edit the script.
