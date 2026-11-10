# G-vents

Events for everyone. Next.js on Cloudflare Workers (OpenNext); the backend is gventz-api (NestJS on Vercel). Supabase holds the data and storage, and handles sign-in.

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
- Work on a branch and open a pull request into `staging`. After a staging deploy passes, the pipeline opens the pull request from `staging` into `main`; merging it releases to production. Nothing is pushed to `staging` or `main` directly.
- Every screen reads and writes through gventz-api. Supabase is used for sign-in only (`src/lib/supabase/` keeps the auth helpers).
- Dashboard actions return to their tab with a message code; API errors travel as `?err=api.<code>` and are shown from a fixed table (`src/lib/api/messages.ts`), so links can't inject text.
- `/api/revalidate` accepts HMAC-signed page refreshes from the API (`REVALIDATE_SECRET`, same value as on the API).
- Security headers live in `src/lib/csp.ts` (applied in `next.config.ts`).
- API types: `src/lib/api/schema.d.ts` is generated from the gventz-api contract pinned in `api-contract.ref` (a commit SHA, or a `vX.Y.Z` release tag once the API is released). To move to a newer API, change the ref and run `npm run api:types:pinned`; CI fails if the committed types don't match the pinned contract. `npm run api:types` still generates from a local `../gventz-api/openapi.json` while you work on both repos.
- Errors from the API carry messages written for users (`apiMessage` in `src/lib/api/problem.ts`); anything unexpected shows a generic message and is logged.

## Deploying
```
feature branch ──PR──▶ staging ──release PR (opened by the pipeline)──▶ main
   CI only            staging.gventz.com                                gventz.com
                      staging database                                  production database
```
- **CI** (`.github/workflows/ci.yml`) runs lint, typecheck, tests, the Next.js + Cloudflare Worker build and the migration checks on every pull request, and for every push to `staging`/`main` through `deploy.yml`.
- **Website** (`.github/workflows/deploy.yml`, Cloudflare Workers, details in [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md)):
  - merging into `staging` runs CI, deploys the Worker `gventz-web-staging` at `staging.gventz.com` and smoke-tests it;
  - the release gates then check that production has every migration and that `api.gventz.com` serves the contract in `api-contract.ref`, and the workflow opens (or updates) the pull request `staging` → `main`;
  - **merging that pull request deploys production**: the gates run again, the job confirms staging ran exactly this code, deploys `gventz-web` at `gventz.com` (`www` redirects to it) and smoke-tests it. There is no approval step; the merge is the release decision.
- **API:** gventz-api on Vercel, `api.gventz.com` and `api-staging.gventz.com`. It is released separately and always before a website change that needs it.
- **Database migrations** (`.github/workflows/migrate.yml`):
  - merging into `staging` applies new migrations to `gvents-staging` automatically;
  - production is migrated only by hand: Actions → Database migrations → Run workflow from `staging`, target `production`, confirm with "apply to production". The production release waits for this, so the database is always ready before the new code goes live.

Release order: migrations, then the API, then the website.

If a gate fails, nothing reaches production: the workflow opens (or comments on) a GitHub issue labelled `deploy-failure`, and posts to Slack when `SLACK_WEBHOOK_URL` is set. It stops when:
- `main` has commits that `staging` doesn't: merge `main` into `staging` first.
- production is missing a migration: run Database migrations for production, then re-run the workflow.
- the production API is behind the website: release gventz-api first, then re-run the workflow.

Public settings per environment (`API_URL`, `NEXT_PUBLIC_SITE_URL`) live in `wrangler.jsonc`; secrets and the Supabase keys are repository secrets and variables (`STAGING_*` / `PRODUCTION_*`), listed in [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md). For local development see `.env.example`.
