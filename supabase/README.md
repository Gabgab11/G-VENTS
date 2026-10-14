# Database

Every schema change is a SQL file in `migrations/`, named `YYYYMMDDHHMMSS_description.sql` and applied in filename order. Nobody edits the live databases by hand; if a change is needed, it goes in a new migration.

| File | What it does |
| --- | --- |
| `20261013000000_baseline.sql` | The original schema as first committed. |
| `20261014000100_reconcile_live_schema.sql` | Objects that were created by hand and never committed: `event_questions`, extra columns, the `waitlisted` status, and `register_guest`, `public_attendee_count` and `promote_next_waitlisted`. |
| `20261014000200_security_hardening.sql` | Fixes from the architecture review: private events, anonymous ticket reservation, email squatting, staff permissions, theme values, atomic event creation, and storage rules. |

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
