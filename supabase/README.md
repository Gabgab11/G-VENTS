# Database

Every schema change is a SQL file in `migrations/`, named `YYYYMMDDHHMMSS_description.sql` and applied in filename order. Nobody edits the live databases by hand; if a change is needed, it goes in a new migration.

| File | What it does |
| --- | --- |
| `20261013000000_baseline.sql` | The original schema as first committed. |
| `20261014000100_reconcile_live_schema.sql` | Objects that were created by hand and never committed: `event_questions`, extra columns, the `waitlisted` status, and `register_guest`, `public_attendee_count` and `promote_next_waitlisted`. |
| `20261014000200_security_hardening.sql` | Fixes from the architecture review: private events, anonymous ticket reservation, email squatting, staff permissions, theme values, atomic event creation, and storage rules. |
| `20261022000100_ticket_page.sql` | `get_ticket` for the ticket page (`/t/[code]`). |
| `20261022000200_event_location_details.sql` | Venue details from the place search. |
| `20261022000300_delete_event.sql` | Owners can delete their own event (`delete_event`, `event_delete_check`). |
| `20261022000400_registration_email.sql` | `register_guest` stores the account's verified email, so tickets can't be emailed to arbitrary addresses. |
| `20261022000500_places_quota.sql` | Shared per-user limit for Google Places lookups (`take_places_quota`). |
| `20261023000100_owner_reads_own_events.sql` | Restores the owner's read rule on `events`, so draft and private events can be created again. |
| `20261024000100_api_role.sql` | The `gventz_api` login role for the NestJS API (Change 1): table grants, one RLS policy per table for that role only, timeouts. Its password is set once per project by hand (see below). |
| `20261024000200_outbox.sql` | `outbox_events`, the API's transactional outbox. Only `gventz_api` can reach it. |
| `20261024000300_platform_staff.sql` | `platform_staff`: G-ventZ staff by verified email (read-only for the API). |
| `20261024000400_events_purchase_policy.sql` | `events.per_buyer_limit` (1–10) and `events.fee_choice`. |
| `20261024000500_audit_keep_on_event_delete.sql` | Audit rows survive event deletion (`event_id` set to null). |
| `20261024000600_events_guard_api_role.sql` | `events_guard` steps aside for `gventz_api`, which checks the same rules itself. |
| `20261025000100_ticket_deliveries.sql` | `ticket_deliveries`: the log of "Email my ticket" sends from the ticket page (written by the API). |
| `20261026000100_orders.sql` | `orders`: one purchase by one buyer for one event (U4). Only `gventz_api` can reach it. |
| `20261026000200_registrations_orders.sql` | Tickets get `order_id`, `ticket_number`, `guest_name` and the `declined` status; one buyer may hold several tickets (the one-per-user index is dropped; `register_guest` still refuses a second registration itself). |
| `20261026000300_events_active_count.sql` | `events.active_count` (confirmed + pending), backfilled and kept by a trigger on registrations; `updated_at` ignores count-only changes. |
| `20261026000400_outbox_run_at.sql` | `outbox_events.run_at`: delayed jobs (the once-a-minute page refresh after orders, U5). |
| `20261026000500_active_count_per_statement.sql` | `active_count` kept per statement (one event-row update per order, not per ticket), found by the load test. |
| `20261026000600_api_role_lock_timeout.sql` | `lock_timeout = 3s` for `gventz_api` (one round trip less per order). |
| `20261026000700_announcement_sending.sql` | Sending announcements (C2): send facts on `email_campaigns`, the `email_campaign_recipients` audience snapshot with unsubscribe tokens; API role only. |
| `20261026000800_ticket_deliveries_api.sql` | The API may read and append the ticket delivery log (it sends "Email my ticket" now). |
| `20261113000100_close_legacy_data_api.sql` | Closes the Data API (PostgREST/GraphQL) on `public` to visitors and signed-in users. |
| `20261114000100_event_maps_url.sql` | A Google Maps link per venue (LO6). |
| `20261114000200_drop_legacy_data_api.sql` | Drops the old app's Data API functions and table policies (the contract step after the previous migration). |
| `20261114000300_admin_platform_settings.sql` | G-ventZ admin dashboard settings (Change 2 / M4). |
| `20261114000400_platform_staff_invites.sql` | Staff invitations (Change 2 amendment, FR-21.7). |
| `20261114000500_paystack_payments.sql` | Paystack payments (M5), including the private `host-documents` bucket. |
| `20261114000600_drop_legacy_storage_policies.sql` | Drops the old app's storage policies on `event-covers` and the helper only they used. |
| `20261114000700_payment_integrity.sql` | Payment integrity fixes after the security review of M5. |
| `20261114000800_email_confirmed.sql` | `public.email_confirmed(user, email)`, for the API's staff check. |
| `20261114000900_profile_language.sql` | `profiles.language` (Change 3, FR-23.3). |
| `20261114001000_profiles_email_lower_index.sql` | Case-insensitive profile lookup by email (Change 3). |
| `20261114001100_platform_staff_note_fix.sql` | Corrects a staff record's note. |
| `20261114001200_hosts_profiles_follows.sql` | Host profiles and follows (Change 4, FR-32), including `profiles.verified_at`. |
| `20261114001300_event_team_activity.sql` | Event team invitations and the activity log (Change 4). |
| `20261114001400_discount_codes.sql` | Discount codes and the `discount` ledger kind (Change 4, FR-33.1). |
| `20261114001500_host_home.sql` | Announcement templates (Change 4, FR-33.3). |
| `20261114001600_events_touch_writer_bump.sql` | `events.updated_at` may be moved forward by its writer (Change 4, FR-29.3). |
| `20261114001700_event_images.sql` | Up to 5 pictures per event (Change 4). |
| `20261114001800_checkout_groups_recipients.sql` | Checkout: group tickets, ticket-type descriptions, tickets for other people, buyer phone (Change 4). |

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

`.github/workflows/migrate.yml` (*Database migrations*) applies migrations for you. It runs
`supabase db push --dry-run`, then `supabase db push`, and lists the migrations before and after.

- **Staging:** automatic on a push to `staging` that changes `supabase/migrations/**`.
- **Production:** by hand only: Actions → *Database migrations* → Run workflow from `staging` (or
  `main`), target `production`, and type `apply to production` in the confirm box. There is no
  approval step; the typed confirmation is the check. Read the dry-run list in the log.
- **Order:** production migrations, then the gventz-api release that needs them, then the website.
  gventz-api's schema gate and this repository's production migration gate both refuse to release
  code whose migrations production lacks. Migrations expand before they contract, so the running
  code keeps working after each one.

Repository secrets (no GitHub environments): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_STAGING_REF`,
`SUPABASE_STAGING_DB_PASSWORD`, `SUPABASE_PROD_REF`, `SUPABASE_PROD_DB_PASSWORD`.

Each database records what it has applied in `supabase_migrations.schema_migrations`;
`supabase migration list --linked` shows it.

### The API role password (once per project)

`20261024000100_api_role.sql` creates `gventz_api` without a password. Run `gventz-api/scripts/generate-secrets.sh`, then in the SQL editor of the project run the single `alter role gventz_api with password '...'` line it prints. This is the only statement run by hand, and it changes no schema.

## Applying changes by hand

Don't, except to recover when the workflow can't run. Apply to `gvents-staging`, test, then apply to
`gvents-prod`.

```bash
supabase link --project-ref <staging-ref>
supabase db pull            # first time only: compare the live schema with migrations/
supabase db push            # applies migrations that haven't run yet
npm run db:types            # regenerates src/lib/supabase/database.types.ts
```

## One-time check before the first push (done, historical)

The two October 2026 migrations recreate objects that already exist on both databases. Before pushing:

1. Run `supabase db pull` against staging and diff the live `register_guest`, `public_attendee_count` and `promote_next_waitlisted` with `20261014000100_reconcile_live_schema.sql`. The new `register_guest` is intentionally stricter. It validates answers server-side and refuses paid tickets.
2. List the existing storage policies and drop any older, broader `event-covers` write policy. Policies are OR'ed together, so an old permissive one would keep allowing writes:
   `select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects';`
3. If the `registrations_one_active_per_user` index fails, duplicate registrations already exist. The migration file has the query that lists them.
