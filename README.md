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
- Work on a branch and open a pull request. `main` deploys to production, so nothing is pushed to it directly.
- Permission checks live in the database (row-level security and functions). The app also checks access up front, using `requireEventRole` in `src/lib/auth.ts`, so users get a clear answer.

## Deploying to Vercel
1. In Vercel, import the repo. Framework preset: Next.js.
2. Add the environment variables from `.env.example`: staging keys for Preview, production keys for Production.
3. Every pull request gets its own preview URL. Merging to `main` deploys production.
