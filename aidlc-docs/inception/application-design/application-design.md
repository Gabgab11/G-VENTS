# Application Design — G-ventZ API (version 2, Change 1)

This is the consolidated view. Details are in [components.md](components.md), [component-methods.md](component-methods.md), [services.md](services.md) and [component-dependency.md](component-dependency.md). Version 1 is in [v1/](v1/).

## Decisions

### Kept from version 1 (`application-design-plan.md`)
| # | Decision |
|---|---|
| AD1 | Repository `gventz-api` at `/Users/payazaafrica/gventz-api` |
| AD2 | Clean layers per module (`domain` / `application` / `infrastructure` / `presentation`). The domain is framework-free, and boundaries are enforced by lint. |
| AD3 | Rich domain model |
| AD4 | Modules talk through exported interfaces and ports. Side effects go through domain events. |
| AD5 | `@Transactional()` (`@nestjs-cls/transactional`) |
| AD6 | Query services read straight into DTOs. Writes go through aggregates. |
| AD7 | Domain errors → RFC 9457 problem details with stable codes |
| AD8 | One build, two roles (API and worker) by `APP_ROLE` |
| AD9 | `/v1` REST, camelCase JSON |
| AD10 | `EventAccessPolicy` plus guard plus `@RequireEventPermission()`. No access gives 404. |

### New in Change 1 (`application-design-change1-plan.md`, all A)
| # | Decision |
|---|---|
| AD11 | **One `Order` for free and paid purchases, in Ticketing.** Tickets always belong to an order. Payments handles money only, and tells Ticketing through events. |
| AD12 | **Overselling is prevented in Postgres.** One short transaction locks the event's ticket type rows (`FOR UPDATE`, fixed order) and checks sold + held against quantity and capacity. A Redis pre-check is a fallback only if the load test fails. |
| AD13 | **Webhook inbox:** signature check → store once (unique provider event id) → 200 → the worker verifies with the provider and processes. |
| AD14 | **Supabase tokens are verified with the public signing keys (JWKS)**, cached. No shared secret. |
| AD15 | **A `platform_staff` table**, managed by SQL only. The API checks it with a 60-second cache. |
| AD16 | **The scanner goes through Next.js**, like every other call. |
| AD17 | **Existing SQL functions and grants stay until go-live is confirmed.** New migrations are additive only. |
| AD18 | **Transactional outbox** for durable cross-module events, replacing version 1's after-commit dispatch for durable work. *This follows from AD11, AD13 and the Resiliency rules: payment confirmations and ticket emails must never be lost.* |
| AD19 | **Separate connection pools** for web, worker and reports (bulkheads), through the Supabase pooler with TLS verification. |
| AD20 | **Telemetry:** OpenTelemetry traces and metrics plus logs go to Grafana Cloud, and errors to Sentry. Every outside call has a timeout, and providers sit behind circuit breakers. |

## Modules

| Module | Owns | Key classes | Milestone |
|---|---|---|---|
| Platform | config, Supabase pools, transactions, outbox, Redis, queues, logs, telemetry, resilience, errors, health, OpenAPI, rate limits, audit | `OutboxRelay`, `CircuitBreaker`, `ProblemDetailsFilter` | M1 |
| Identity | caller identity (Supabase), profile, staff role, MFA level | `SupabaseTokenVerifier`, `AccessTokenGuard`, `RequireMfa`, `PlatformStaffGuard` | M1 |
| Events | events, ticket types, members, permissions, purchase policy, fee choice | `Event`, `PurchasePolicy`, `EventAccessPolicy` | M1–M2 |
| Engagement | questions, announcement drafts | `QuestionSet` | M2 |
| Ticketing | orders, tickets, inventory and holds, approval, waitlist, check-in | `Order`, `Ticket`, `EventInventory`, `OrderService`, `CheckInService` | M1–M2 (holds M4) |
| Payments | checkout, webhooks, payments, refunds, disputes, payout accounts, fees, ledger, reconciliation | `FeeCalculator`, `ProviderRouter`, `PaymentProvider` (Paystack, Stripe), `RefundService` | M4 (Paystack), M5 (Stripe) |
| Media | flyers on Supabase Storage | `FlyerService`, `SupabaseStorageFileStorage` | M2 |
| Discovery | featured events, outside listings, venue search | `OutsideListingsService`, `PlacesService` | M2 |
| Notifications | order tickets, receipts, refund and payout notices, revalidation | `EmailComposer`, `Mailer` → Resend | M1 (tickets), M4 (money emails) |

## REST Resource Map (`/v1`)

**Auth column:**
- **Public:** no token.
- **User:** a valid Supabase token.
- **Permission name:** checked with `@RequireEventPermission`.
- **+MFA:** needs `aal2`.
- **Staff:** platform staff, and also needs MFA.

Sign-in, sign-out and refresh are handled by **Supabase Auth**, so there are no `/auth/*` endpoints.

| Method | Path | Service | Auth | Req. | Milestone |
|---|---|---|---|---|---|
| GET | `/me` | `ProfileService.getMe` | User | FR-1 | M1 |
| PATCH | `/me` | `ProfileService.updateProfile` | User | FR-14.1 | M2 |
| GET | `/me/events` | `EventQueryService.listHostEvents` | User | FR-14.1 | M2 |
| GET | `/me/orders`, `/me/orders/{orderId}` | `BuyerOrdersQuery` | User (own orders) | FR-5, US-4.3 | M2 |
| POST | `/events` | `EventCommandService.create` | User | FR-2.1 | M1 |
| GET | `/events/featured` | `EventQueryService.listFeatured` | Public | FR-13 | M2 |
| GET | `/events/by-slug/{slug}` | `EventQueryService.getPublicPage` | Public (viewer optional) | FR-13 | M1 |
| GET | `/events/{id}` | `EventQueryService.getDashboard` | `event.viewDashboard` | FR-14 | M2 |
| PATCH | `/events/{id}` | `EventCommandService.updateDetails` | `event.edit` | FR-2.3 | M2 |
| PUT | `/events/{id}/location` | `EventCommandService.changeLocation` | `event.edit` | FR-2.4, 2.5 | M2 |
| PATCH | `/events/{id}/settings` | `EventCommandService.updateSettings` (incl. per-buyer limit) | `event.edit` | FR-2.3, D56 | M2 |
| PUT | `/events/{id}/fees` | `EventCommandService.updateFeeChoice` | `event.fees` | FR-8.2 | M4 |
| POST | `/events/{id}/publish` | `EventCommandService.publish` | `event.publish` | FR-2.2 | M1 |
| POST | `/events/{id}/cancel` | `EventCommandService.cancel` | `event.cancel` | FR-2.6 | M2 |
| GET | `/events/{id}/deletion-check` | `EventCommandService.deletionCheck` | `event.delete` | FR-2.7 | M2 |
| DELETE | `/events/{id}` | `EventCommandService.delete` | `event.delete` | FR-2.7 | M2 |
| GET, POST, DELETE | `/events/{id}/questions[/{questionId}]` | `QuestionService` | `event.viewDashboard` / `questions.manage` | FR-3 | M2 |
| GET, POST | `/events/{id}/announcements` | `AnnouncementService` | `event.viewDashboard` / `announcements.draft` | FR-14.1 | M2 |
| POST | `/events/{id}/flyer/upload-url` | `FlyerService.createUploadSignature` | `flyer.manage` | FR-12 | M2 |
| PUT, DELETE | `/events/{id}/flyer` | `FlyerService.confirmUpload` / `remove` | `flyer.manage` | FR-12 | M2 |
| POST | `/events/{id}/orders` | `OrderService.placeFreeOrder` / `startPaidOrder` | User | FR-4, FR-5.1 | M1 (free), M4 (paid) |
| POST | `/events/{id}/orders/{orderId}/approve` | `ApprovalService.approve` | `orders.approve` | FR-4.1 | M2 |
| POST | `/events/{id}/waitlist/promote` | `WaitlistService.promoteNext` | `waitlist.promote` | FR-6 | M2 |
| GET | `/events/{id}/guests` | `GuestListQueryService.list` | `event.viewDashboard` | FR-14.1 | M2 |
| POST | `/events/{id}/check-in` | `CheckInService.scan` (body: code) | `guests.checkIn` | FR-7 | M1 |
| POST | `/events/{id}/guests/{ticketId}/check-in` | `CheckInService.checkInGuest` | `guests.checkIn` | FR-7 | M2 |
| GET | `/tickets/{code}` | `TicketQueryService.getTicket` | Public (viewer optional) | FR-7.1 | M1 |
| POST | `/orders/{orderId}/checkout` | `CheckoutService.start` | User (own order) | FR-5.2 | M4 |
| POST | `/webhooks/paystack`, `/webhooks/stripe` | `WebhookIngestService.receive` | Public (signature) | FR-5.3 | M4 / M5 |
| GET | `/events/{id}/sales` | `SalesQueryService.forEvent` | `sales.view` | FR-14.2 | M4 |
| GET | `/events/{id}/orders` | `SalesQueryService.orders` | `orders.view` | FR-14.3 | M4 |
| POST | `/events/{id}/refunds` | `RefundService.hostRefund` | `orders.refund` +MFA | FR-10.1 | M4 |
| GET | `/payout-account` | `PayoutAccountService.get` | User | FR-9 | M4 |
| GET | `/payout-account/banks`, `/payout-account/resolve` | `PayoutAccountService.listBanks` / `resolve` | User +MFA | FR-9.1 | M4 |
| PUT | `/payout-account` | `PayoutAccountService.connect` / `change` | User +MFA | FR-9.1, 9.3 | M4 |
| GET, PUT | `/staff/fees[/{currency}]` | `FeeScheduleService` | Staff | FR-8.1 | M4 |
| GET | `/staff/reconciliation`, `/staff/orders/{ref}` | `ReconciliationService` results / `SupportLookupQuery` | Staff | FR-15 | M4 |
| GET | `/discover/outside` | `OutsideListingsService.list` | Public | FR-13 | M2 |
| GET | `/places/autocomplete`, `/places/{placeId}` | `PlacesService` | User | FR-16.1 | M2 |
| GET | `/health/live`, `/health/ready` (unversioned) | `HealthModule` | Public | FR-16.3 | M1 |

**Next.js side (U6):**
- `POST /api/revalidate` (HMAC).
- Server actions that call the API with the user's Supabase access token.
- The Supabase sign-in UI, with Google added.

## Milestone Slices
- **M1 (2026-11-01):**
  - health, `GET /me`
  - create event, publish, public page
  - free orders (several tickets)
  - ticket view, check-in scan
  - order tickets email
  - the outbox and telemetry foundations
- **M2 (2026-11-08):** every other non-payment endpoint, plus the load test.
- **M3 (2026-11-15):** gates and go-live.
- **M4:** holds and paid orders, Paystack, webhooks, refunds, payout accounts, fees, sales, staff.
- **M5:** the Stripe adapter and Connect.

## Coverage

### Requirements
| Requirement | Component(s) |
|---|---|
| FR-1 | Identity (with Supabase Auth configuration) |
| FR-2, FR-3 | Events, Engagement |
| FR-4, FR-6, FR-7 | Ticketing |
| FR-5 | Ticketing (order, hold) + Payments (checkout, webhooks) |
| FR-8, FR-9, FR-10, FR-15 | Payments (+ Ticketing for voiding) |
| FR-11 | Notifications |
| FR-12 | Media |
| FR-13, FR-16.1 | Discovery |
| FR-14 | Events, Ticketing, Payments read sides |
| FR-16.2–16.4 | Notifications (revalidation), Platform (health), migrations in G-VENTS |
| FR-17 | Platform Telemetry, Logging, alerts |
| FR-18 | Next.js (U6) |

### Stories
Every one of the 45 stories maps to a component:
- **E1:** Identity
- **E2:** Events, Engagement, Media, Discovery
- **E3, E8:** Ticketing
- **E4–E7:** Payments and Ticketing
- **E9:** Payments staff services and Platform

## Validation and Compliance
- **Structure:**
  - No module imports another module's repositories or tables.
  - Cross-module ports avoid cycles (`PayoutReadiness`, `TicketingStats`, `FeeQuotePort`).
- **Diagrams:**
  - The Mermaid diagram (`flowchart LR`) uses quoted labels, with a text alternative.
  - ASCII flows are in code blocks.
- **PBT:** N/A at this stage (PBT-01 starts at Functional Design). Candidate properties noted for later:
  - `FeeCalculator` (host share + fees = buyer total)
  - inventory all-or-nothing
  - ledger balance per order
- **Security Baseline at design level:**

  | Rule | Status | Notes |
  |---|---|---|
  | SECURITY-08 | Compliant | Deny-by-default guard; event, order and ticket ownership checks; staff guard; CORS restricted; token verified on every request |
  | SECURITY-11 | Compliant | Payments isolated; rate limits on public endpoints; misuse cases addressed: bulk buying (per-buyer limit), hold flooding (rate limits, 10-minute holds), webhook replay (inbox unique id), refund abuse (MFA, audit), code guessing (unguessable codes, rate limits) |
  | SECURITY-12 | Compliant | Supabase Auth; MFA step-up for money actions |
  | SECURITY-13 | Compliant | Webhook signatures; audit trail |
  | SECURITY-15 | Compliant | Global error handler; fail closed; transactions roll back |
  | Others | N/A | Applied at NFR Design, Infrastructure and Code |

- **Resiliency Baseline at design level:**

  | Rule | Status | Notes |
  |---|---|---|
  | RESILIENCY-01 | Compliant | Criticality table in components.md §7 |
  | RESILIENCY-06 | Compliant | Health endpoints |
  | RESILIENCY-10 | Compliant | Timeouts, breakers, bulkhead pools, degraded behaviour |
  | Others | N/A | Applied at NFR and Infrastructure Design |
