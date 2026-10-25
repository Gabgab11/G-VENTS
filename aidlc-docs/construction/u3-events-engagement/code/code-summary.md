# U3 Events and Engagement — Code Summary

- **Plan:** `aidlc-docs/construction/plans/u3-events-engagement-code-generation-plan.md`.
- **Design:** the U3 functional design plus `change1-delta.md`.
- **Not committed.**

## Pass 1 (M1): create, publish, public page, permissions — done 2026-10-24

### Reference data (Step 1)

| Dataset | Package | Version | Licence |
|---|---|---|---|
| Countries (248, English names) and their IANA zones | `countries-and-timezones` | 3.11.0 | MIT |
| Country → ISO 4217 currency | `country-to-currency` | 3.0.1 | MIT |
| ISO 3166-2 first-level subdivisions | `country-region-data` | 4.1.0 | MIT |
| Coordinates → IANA zone (offline) | `@photostructure/tz-lookup` | 11.7.0 | CC0 |

- `geo-tz` was rejected: it's more precise near borders, but 72 MB. Hosts can always choose the zone themselves.
- Subdivision labels ("State", "Province", …) come from a small built-in map, defaulting to "Region".

### Files

| Area | Files |
|---|---|
| Migrations (G-VENTS) | `20261024000400_events_purchase_policy.sql`, `20261024000500_audit_keep_on_event_delete.sql`, `20261024000600_events_guard_api_role.sql`; `supabase/tests/events_policy_and_audit.test.sql`; regenerated `database.types.ts` |
| Shared | `src/shared/domain/constants.ts` (categories, themes, roles, …; the platform schema constants re-export it); `FieldInvalid` error (400 with a field code) |
| Domain | `src/modules/events/domain/{reference/catalog,errors,value-objects,event-schedule,location,slug,ticket-type,event,access-policy,domain-events,ports,index}.ts` |
| Application | `application/{ports,dto,event-access.service,event-command.service,event-query.service}.ts` |
| Infrastructure | `infrastructure/{reference-data,drizzle-event.repository,drizzle-event.queries,payout-readiness.stub}.ts` |
| Presentation | `presentation/{event-permission.guard,dto,events.controller}.ts` |
| Module | `events.module.ts`, `index.ts`; wired in `src/app.module.ts` |
| Identity | `ProfileProvisioner` added to the public interface (Δ5) |
| Platform | `RequestContext.memo()` for per-request caching (PM3); `per_buyer_limit`, `fee_choice` in `tables.ts` |
| Tests | domain PBT (`event-schedule.pbt`, `value-objects.pbt`), `location.spec`, `event.spec`, `reference-data.spec`, `event-command.service.spec`; `test/support/{events-arbitraries,auth-server}.ts`; `test/integration/events.integration.spec.ts` |

### Endpoints
- `POST /v1/events`
- `POST /v1/events/{id}/publish` (owner or admin)
- `GET /v1/events/by-slug/{slug}` (public, optional viewer)

### Verification

| Check | Result |
|---|---|
| Lint, typecheck | Clean |
| Unit and property-based tests | 191 passed |
| Integration tests | 49 passed. The 7 events cases: create and storage; zone from coordinates and zone-required; 7 refusal codes; first-time host without a profile; publish permissions (owner, editor 403, stranger 404, cancelled 409); drafts hidden from guests; attendee-count rule; audit kept on delete |
| Supabase CLI | Lint clean; database tests (4 files) pass |
| OpenAPI | Snapshot has the 3 event paths |

### What the property tests found
- **Dotless i:** region matching failed for the Azerbaijani region "Saatlı" typed in capitals (ı uppercases to I). Fixed in the text folding, which now also handles ß.
- **Timeouts:** the clock-change scan can pass the 5-second limit under full parallel load, so it now has a 30-second limit.

### What integration testing found
- Supabase's `events_guard` trigger calls `auth.uid()`, and the API role can't use the `auth` schema (Supabase owns it, and migrations can't grant on it). Publishing therefore failed with a 500.
- **Fix:** migration `20261024000600` makes the trigger return early for `gventz_api`. It's otherwise unchanged. The design delta Δ6 is updated.

## Pass 2 (M2): the rest of Events, and Engagement — done 2026-10-24

### Files

| Area | Files |
|---|---|
| Events domain | `event.ts` (`updateDetails`, `changeLocation`, `updateSettings`, `cancel`, `assertDeletable`, `markDeleted`, `sameTitle`); `domain-events.ts` (updated, cancelled, deleted); `ports.ts` (`delete`, deletion and dashboard counts) |
| Events application | `event-command.service.ts` (edit, location, settings, cancel with audit, deletion check, delete with audit kept); `event-query.service.ts` (dashboard, featured with cursor, my events); `reference.service.ts`; DTOs |
| Events infrastructure | queries (`eventById`, `featured`, `hostEvents`, counts); `event-ports.ts` (`EventSummaryReader` for U4, `EventCoverPort` for U5) |
| Events presentation | `events.controller.ts` (8 more routes), `me-events.controller.ts`, `reference.controller.ts` (public, `Cache-Control: public, max-age=86400`) |
| Engagement | `src/modules/engagement/`: `QuestionSet`/`Question`, `normalizeOptions`, announcement drafts, `QuestionService`, `AnnouncementService`, `QuestionCatalog` (for U4), repositories (event row locked), controllers, module |
| Platform | Empty JSON bodies are accepted (found by the smoke run) |
| Identity | Blank profile names (`''` from Supabase's trigger) are returned as `null` |
| Tests | `event-changes.spec.ts` (PBT for delete confirmation), `questions.pbt.spec.ts` (stateful `QuestionSet`; options idempotence), `events-manage.integration.spec.ts` (9), `engagement.integration.spec.ts` (4, including **C3**) |

### Endpoints added
- **Events:** `GET /v1/events/featured`, `GET /v1/events/{id}`, `PATCH /v1/events/{id}`, `PUT /v1/events/{id}/location`, `PATCH /v1/events/{id}/settings`, `POST /v1/events/{id}/cancel`, `GET /v1/events/{id}/deletion-check`, `DELETE /v1/events/{id}`.
- **My events:** `GET /v1/me/events`.
- **Questions and announcements:** `GET|POST|DELETE /v1/events/{id}/questions[/{questionId}]`, `GET|POST /v1/events/{id}/announcements`.
- **Reference data:** `GET /v1/reference/countries`, `/countries/{code}/subdivisions`, `/time-zone`.

### Verification

| Check | Result |
|---|---|
| Lint, typecheck | Clean |
| Unit and property-based tests | 199 passed |
| Integration tests | 62 passed (10 files) |
| Build, OpenAPI | Pass; 19 paths |
| Docker | Image builds |
| Smoke run (production image, local test key server, local Supabase Postgres) | `GET /v1/me` → create → draft hidden from guests → publish → page visible to guests → listed in "my events": all as expected, after the 2 fixes below |

### Findings
- **Smoke run:** a JSON content type with an empty body (typical of browser `fetch`) made publish answer 400. Fixed in the HTTP layer, and the integration test now sends requests that way.
- **Smoke run:** profiles created by Supabase's trigger have `full_name = ''`; `/v1/me` now returns `null`.
- **Deviation:** the unique `(event_id, position)` question index is deferred to after go-live. The current app sets position = count + 1, which repeats after a delete, so an index would break it (AD17). The event-row lock is the guard, and the C3 test proves it.

### Product research (requested during pass 2)
`aidlc-docs/inception/research/luma-eventporte-notes.md` lists 12 ideas from Luma and EventPorte, awaiting the product owner's choices.
