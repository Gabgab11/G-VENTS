# Database

Every schema change is a SQL file in `migrations/`, named `YYYYMMDDHHMMSS_description.sql` and applied in filename order. Nobody edits the live databases by hand; if a change is needed, it goes in a new migration.

| File | What it does |
| --- | --- |
| `20261013000000_baseline.sql` | The original schema as first committed. |
| `20261014000100_reconcile_live_schema.sql` | Objects that were created by hand and never committed: `event_questions`, extra columns, the `waitlisted` status, and `register_guest`, `public_attendee_count` and `promote_next_waitlisted`. |
| `20261014000200_security_hardening.sql` | Fixes from the architecture review: private events, anonymous ticket reservation, email squatting, staff permissions, theme values, atomic event creation, and storage rules. |
| `20261022000100_ticket_page.sql` | `get_ticket` for the ticket page (`/t/[code]`). |
| `20261022000200_event_location_details.sql` | Venue details from the place search. |
| `20261022000400_registration_email.sql` | `register_guest` stores the account's verified email, so tickets can't be emailed to arbitrary addresses. |
| `20261022000500_places_quota.sql` | Shared per-user limit for Google Places lookups (`take_places_quota`). |
| `20261024000100_api_role.sql` | The `gventz_api` login role for the NestJS API (Change 1): table grants, one RLS policy per table for that role only, timeouts. Its password is set once per project by hand (see below). |
| `20261024000200_outbox.sql` | `outbox_events`, the API's transactional outbox. Only `gventz_api` can reach it. |
| `20261024000300_platform_staff.sql` | `platform_staff`: G-ventZ staff by verified email (read-only for the API). |
| `20261024000400_events_purchase_policy.sql` | `events.per_buyer_limit` (1–10) and `events.fee_choice`. |
| `20261024000500_audit_keep_on_event_delete.sql` | Audit rows survive event deletion (`event_id` set to null). |
| `20261024000600_events_guard_api_role.sql` | `events_guard` steps aside for `gventz_api`, which checks the same rules itself. |
| `20261025000100_orders.sql` | `orders`: one purchase by one buyer for one event (U4). Only `gventz_api` can reach it. |
| `20261025000200_registrations_orders.sql` | Tickets get `order_id`, `ticket_number`, `guest_name` and the `declined` status; one buyer may hold several tickets (the one-per-user index is dropped; `register_guest` still refuses a second registration itself). |
| `20261025000600_api_role_lock_timeout.sql` | `lock_timeout = 3s` for `gventz_api` (one round trip less per order). |
| `20261025000700_announcement_sending.sql` | Sending announcements (C2): send facts on `email_campaigns`, the `email_campaign_recipients` audience snapshot with unsubscribe tokens; API role only. |
| `20261025000500_active_count_per_statement.sql` | `active_count` kept per statement (one event-row update per order, not per ticket), found by the load test. |
| `20261025000400_outbox_run_at.sql` | `outbox_events.run_at`: delayed jobs (the once-a-minute page refresh after orders, U5). |
| `20261025000300_events_active_count.sql` | `events.active_count` (confirmed + pending), backfilled and kept by a trigger on registrations; `updated_at` ignores count-only changes. |

## Testing locally

Needs Docker. `config.toml` holds the local settings.

```bash
supabase db start           # empty local database with every migration applied
npm run test:db             # tests in tests/*.test.sql (pgTAP)
npm run db:types:local      # regenerates src/lib/supabase/database.types.ts; commit it
supabase stop
```

CI runs the same steps on every pull request and fails if the committed types are out of date.

## Applying changes (GitHub Actions)

`.github/workflows/supabase-migrations.yml` applies migrations for you:

- **Staging:** automatic on push to `feature/backend-split` or `main` when a migration changes.
- **Production:** run the workflow by hand with target `production`; the `production` GitHub environment asks for one approval.
- **Order:** apply production migrations **before** releasing an API version (gventz-api) that needs them. Migrations only add things until the split has gone live (application design AD17), so the current app keeps working.

GitHub environment secrets (one set per environment `staging` and `production`): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`.

### The API role password (once per project)

`20261024000100_api_role.sql` creates `gventz_api` without a password. Run `gventz-api/scripts/generate-secrets.sh`, then in the SQL editor of the project run the single `alter role gventz_api with password '...'` line it prints. This is the only statement run by hand, and it changes no schema.

## Applying changes by hand

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
