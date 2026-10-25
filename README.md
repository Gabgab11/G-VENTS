# G-vents

Events for everyone. Next.js on Vercel; the backend is gventz-api (NestJS on Render). Supabase holds the data and storage, and handles sign-in.

## Local setup
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the staging values (project `gvents-staging`), or use a local stack (below).
3. `npm run dev`, then open http://localhost:3000

The website reaches the backend only from the server (`src/lib/api/server.ts`): set `API_URL` and `BFF_SHARED_SECRET` (the same value as on the API).

**Fully local** (website + gventz-api + local Supabase):
1. `node supabase/scripts/gen-signing-key.mjs` once (local ES256 signing key; the API accepts only asymmetric tokens), then `npx supabase start`.
2. Run gventz-api on port 4000 against the local database (see its README), with `SUPABASE_URL=http://127.0.0.1:54321`.
3. In `.env.local`: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, the local publishable key from `npx supabase status`, `API_URL=http://localhost:4000`.
4. Sign-in codes arrive in Mailpit: http://127.0.0.1:54324.

## Checks
CI runs these on every pull request. Run them locally before pushing:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Environments
- **Staging:** Supabase project `gvents-staging` (eu-west-2). Used for every test.
- **Production:** Supabase project `gvents-prod` (eu-west-2). Only changed after staging passes the checklist.

## Database
Schema changes are migrations in `supabase/migrations/`. See `supabase/README.md` for how to apply them. Apply to staging first, then production.

## Working on the code
- Work on a branch and open a pull request. `main` deploys to production, so nothing is pushed to it directly.
- Every screen reads and writes through gventz-api. Supabase is used for sign-in only (`src/lib/supabase/` keeps the auth helpers).
- Dashboard actions return to their tab with a message code; API errors travel as `?err=api.<code>` and are shown from a fixed table (`src/lib/api/messages.ts`), so links can't inject text.
- `/api/revalidate` accepts HMAC-signed page refreshes from the API (`REVALIDATE_SECRET`, same value as on the API).
- Security headers live in `src/lib/csp.ts` (applied in `next.config.ts`).
- API types: `npm run api:types` regenerates `src/lib/api/schema.d.ts` from `../gventz-api/openapi.json` (or `API_OPENAPI_URL`). Run it when the API changes.
- Errors from the API carry messages written for users (`apiMessage` in `src/lib/api/problem.ts`); anything unexpected shows a generic message and is logged.

## Deploying to Vercel
1. In Vercel, import the repo. Framework preset: Next.js.
2. Add the environment variables from `.env.example`: staging keys for Preview, production keys for Production.
3. Every pull request gets its own preview URL. Merging to `main` deploys production.
