# Database

Every schema change is a SQL file in `migrations/`, named `YYYYMMDDHHMMSS_description.sql` and applied in filename order. Nobody edits the live databases by hand; if a change is needed, it goes in a new migration.

| File | What it does |
| --- | --- |
| `20261013000000_baseline.sql` | The original schema as first committed. |
| `20261014000100_reconcile_live_schema.sql` | Objects that were created by hand and never committed: `event_questions`, extra columns, the `waitlisted` status, and `register_guest`, `public_attendee_count` and `promote_next_waitlisted`. |
| `20261014000200_security_hardening.sql` | Fixes from the architecture review: private events, anonymous ticket reservation, email squatting, staff permissions, theme values, atomic event creation, and storage rules. |
| `20261022000100_ticket_page.sql` | `get_ticket` for the ticket page (`/t/[code]`). |
| `20261022000200_event_location_details.sql` | Venue details from the place search. |
| `20261022000300_registration_email.sql` | `register_guest` stores the account's verified email, so tickets can't be emailed to arbitrary addresses. |
| `20261022000400_places_quota.sql` | Shared per-user limit for Google Places lookups (`take_places_quota`). |

## Testing locally

Needs Docker. `config.toml` holds the local settings.

```bash
supabase db start           # empty local database with every migration applied
npm run test:db             # tests in tests/*.test.sql (pgTAP)
npm run db:types:local      # regenerates src/lib/supabase/database.types.ts; commit it
supabase stop
```

CI runs the same steps on every pull request and fails if the committed types are out of date.

## Applying changes

Apply to `gvents-staging`, test, then apply to `gvents-prod`.

```bash
supabase link --project-ref <staging-ref>
supabase db pull            # first time only: compare the live schema with migrations/
supabase db push            # applies migrations that haven't run yet
npm run db:types            # regenerates src/lib/supabase/database.types.ts
```

## One-time check before the first push

The two October 2026 migrations recreate objects that already exist on both databases. Before pushing:

1. Run `supabase db pull` against staging and diff the live `register_guest`, `public_attendee_count` and `promote_next_waitlisted` with `20261014000100_reconcile_live_schema.sql`. The new `register_guest` is intentionally stricter. It validates answers server-side and refuses paid tickets.
2. List the existing storage policies and drop any older, broader `event-covers` write policy. Policies are OR'ed together, so an old permissive one would keep allowing writes:
   `select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects';`
3. If the `registrations_one_active_per_user` index fails, duplicate registrations already exist. The migration file has the query that lists them.
