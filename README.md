# G-vents

Events from everywhere. Next.js on Vercel, Supabase for data, login, and storage.

## Local setup
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the staging values (project `gvents-staging`).
3. `npm run dev`, then open http://localhost:3000

## Environments
- **Staging:** Supabase project `gvents-staging` (eu-west-2). Used for every test.
- **Production:** Supabase project `gvents-prod` (eu-west-2). Only changed after staging passes the checklist.

## Database
The schema is in `../supabase/gvents-schema.sql`. Change it there first, test on staging, then apply to production.

## Deploying to Vercel
1. Push this repo to GitHub.
2. In Vercel, import the repo. Framework preset: Next.js.
3. Add the environment variables from `.env.example` for the Preview environment (staging keys) and the Production environment (production keys).
4. Every pull request gets its own preview URL. Merge to `main` to deploy production.
