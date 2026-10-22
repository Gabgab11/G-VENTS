# G-vents

Events from everywhere. Next.js on Vercel, Supabase for data, login, and storage.

## Local setup
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the staging values (project `gvents-staging`).
3. `npm run dev`, then open http://localhost:3000

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
- Work on a branch and open a pull request into `staging`. When staging has been checked, open a pull request from `staging` into `main`. Nothing is pushed to `staging` or `main` directly.
- Permission checks live in the database (row-level security and functions). The app also checks access up front, using `requireEventRole` in `src/lib/auth.ts`, so users get a clear answer.

## Deploying
```
feature branch ──PR──▶ staging ──PR──▶ main
   preview URL        staging site      production site
                      staging database  production database
```
- **CI** (`.github/workflows/ci.yml`) runs lint, typecheck, tests, build and the migration checks on every pull request.
- **Vercel** deploys every branch through its Git integration:
  - `main` → Production, with the production Supabase keys, at `gventz.com` (`www.gventz.com` redirects to it).
  - `staging` → a Preview with the staging Supabase keys, at `staging.gventz.com` (the domain is assigned to the `staging` branch in Vercel → Settings → Domains).
  - any other branch or pull request → its own preview URL with the staging keys.
- **Database migrations** (`.github/workflows/migrate.yml`):
  - merging into `staging` applies new migrations to `gvents-staging` automatically;
  - production is migrated only by hand: Actions → Database migrations → Run workflow from `staging`, target `production`, confirm with "apply to production". The automatic release waits for this, so the database is always ready before the new code goes live.

### Automatic release (`.github/workflows/promote.yml`)
When Vercel finishes deploying `staging`, the pipeline checks that:
1. the staging deployment succeeded,
2. CI passed for that exact commit,
3. smoke tests pass on `staging.gventz.com`,
4. production has every migration the commit needs.

It then fast-forwards `main` to that commit, and Vercel deploys production from exactly the code that was tested. It also smoke-tests production afterwards.

If any step fails, nothing reaches production. The pipeline opens (or comments on) a GitHub issue labelled `deploy-failure`, which GitHub emails to everyone watching the repo, and posts to Slack when `SLACK_WEBHOOK_URL` is set.

It stops instead of promoting when:
- `main` has commits that `staging` doesn't: merge `main` into `staging` first.
- production is missing a migration: run Database migrations for production, then re-run the workflow.
- the release changes `.github/workflows/`: GitHub doesn't let the pipeline push those, so open a pull request from `staging` into `main`.

Environment variables per Vercel environment are listed in `.env.example`. `NEXT_PUBLIC_SITE_URL` must be the public address of each environment (production domain for Production, the staging domain for the `staging` branch).
