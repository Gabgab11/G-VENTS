# CLAUDE.md — G-ventZ

Guidance for Claude Code (and humans) working in this repo. The AI-DLC core workflow is loaded from `.claude/CLAUDE.md`; its rule details are in `.aidlc-rule-details/`. Every software change follows that workflow.

## What this is

**G-ventZ** — an event platform: hosts create events (free tickets for now), guests sign up and register, hosts manage guests and check them in at the door with a QR ticket. A Discover page also lists events from Ticketmaster, PredictHQ and iCal feeds.

Current state: see `aidlc-docs/aidlc-state.md`. The existing system is documented in `aidlc-docs/inception/reverse-engineering/`. Read those before changing behaviour.

## Change in progress (October 2026)

Requested by the product owner and being run through AI-DLC:

1. Split the backend out into a separate **NestJS** application in its own repository, hosted on **Render**. This repo becomes the Next.js frontend and stays on **Vercel**. The backend is object-oriented (domain, services, repositories behind interfaces).
2. Move off Supabase to plain PostgreSQL (data, auth and storage are all Supabase today).
3. Add sign-up and sign-in with Google, next to the existing email code.
4. A scalable, highly optimized backend.

Decisions on these are made in Requirements Analysis and recorded in `aidlc-docs/`. Until the Construction phase starts, the code below is the system of record.

## Today's architecture (until replaced)

- Next.js 15 App Router on Vercel. Server Actions and two Route Handlers (`/api/places/*`) are the whole backend.
- Supabase: Postgres, Auth (email one-time code), Storage (`event-covers` bucket), PostgREST client.
- Permissions live in the database: row-level security keyed on `auth.uid()`, plus `security definer` functions (`register_guest`, `check_in_guest`, `create_event_with_tiers`, ...). The app also checks up front with `requireEventRole` in `src/lib/auth.ts`.
- Schema is in `supabase/migrations/`, applied in filename order, staging (`gvents-staging`) before production (`gvents-prod`).

## Conventions (keep these)

- Money is integer minor units (`price_minor`, kobo) plus an ISO 4217 currency. Never a float.
- Each event stores its own IANA time zone; `Africa/Lagos` is only the default.
- Categories must match the `events.category` check constraint (`src/lib/categories.ts`).
- Tickets go to the guest's verified account email only, never a typed address.
- Messages raised on purpose by the database (code `P0001`) may be shown to users; anything else is logged and replaced with a generic message (`src/lib/errors.ts`).
- Secrets stay on the server. Only `NEXT_PUBLIC_*` values reach the browser.

## Commands

```bash
npm run dev          # http://localhost:3000
npm run lint
npm run typecheck
npm test             # vitest unit tests
npm run build
npm run test:db      # pgTAP tests in supabase/tests (needs Docker + Supabase CLI)
```

## Working rules

- Work on a branch and open a pull request. `main` deploys to production.
- Schema changes are new migration files. Nobody edits a live database by hand.
- Application code lives at the repo root; `aidlc-docs/` holds documentation only.
