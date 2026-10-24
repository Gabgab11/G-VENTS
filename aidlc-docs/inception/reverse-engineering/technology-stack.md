# Technology Stack

## Programming Languages
- TypeScript - ^5 (strict) - All application code
- SQL / PL/pgSQL - PostgreSQL, Supabase-managed (major version not pinned in supabase/config.toml) - Schema, RLS policies, business functions, triggers
- CSS - Global stylesheets and inline styles

## Frameworks
- Next.js - 15.5.27 - App Router, Server Components, Server Actions, Route Handlers, middleware, ISR, `after()`
- React - 19.1.0 - UI
- Supabase JS / SSR - 2.117.3 / 0.12.7 - Database, auth and storage client; cookie sessions

## Infrastructure
- Vercel - Hosting, preview deployments per pull request, production on merge to `main`
- Supabase (eu-west-2) - Managed Postgres, Auth (email OTP), Storage (`event-covers`), PostgREST; projects `gvents-staging` and `gvents-prod`
- Resend - Transactional email (ticket emails)
- Google Places API (New) - Venue search
- Ticketmaster Discovery, PredictHQ, iCal - Optional outside listings

## Build Tools
- npm - bundled with Node >= 22 - Dependencies and scripts
- Next.js compiler (SWC) - 15.5.27 - Build
- ESLint - ^9 with `eslint-config-next` 15.5.27 - Linting
- Supabase CLI - 2.121.0 (pinned in CI) - Local database, migrations, type generation, `db lint`
- GitHub Actions - CI

## Testing Tools
- Vitest - ^3 - Unit tests
- pgTAP (via `supabase test db`) - Database tests
