# Components (version 2, Change 1)

Version 1 is in `v1/components.md`.

**Backend:** `gventz-api` at `/Users/payazaafrica/gventz-api`. NestJS 11, Node 22, TypeScript strict.

**Decisions:**
- **Version 1** (`application-design-plan.md`), still valid: clean layers, rich domain, module interfaces plus domain events, `@Transactional()`, separate read queries.
- **Change 1** (`application-design-change1-plan.md`, all A):
  1. One `Order` for free and paid purchases.
  2. Postgres row locks prevent overselling.
  3. Webhooks go to an inbox, then are processed.
  4. Supabase tokens are checked with the public signing keys (JWKS).
  5. Platform staff are kept in a `platform_staff` table.
  6. The scanner goes through Next.js.
  7. Existing SQL functions stay until go-live.

## 1. Repository Layout

```text
gventz-api/
├── src/
│   ├── main.ts                    # boots the API role, the worker role, or both (APP_ROLE)
│   ├── app.module.ts
│   ├── shared/                    # framework-free: Entity, AggregateRoot, ValueObject, DomainError, DomainEvent, Clock, Money...
│   ├── platform/                  # config, database, transaction, outbox, events, redis, queue,
│   │                              # logging, telemetry, resilience, http, rate-limit, health, openapi, audit
│   └── modules/
│       ├── identity/  events/  engagement/  ticketing/  payments/
│       ├── media/  discovery/  notifications/
│       └── <module>/{domain, application, infrastructure, presentation}/, <module>.module.ts, index.ts
├── src/platform/database/schema/  # Drizzle schema GENERATED from Supabase (drizzle-kit pull); CI checks it matches
├── test/                          # integration and e2e (Testcontainers Postgres loaded with supabase/migrations)
└── render.yaml
```

- There is **no `drizzle/` migrations folder**. Schema changes are made only in `G-VENTS/supabase/migrations/` (D35).
- The test database is built by applying those migrations, using a local copy fetched in CI.

The layer rules (version 1, §1) are unchanged and enforced by lint.

## 2. Shared Building Blocks
Unchanged from version 1:
- `Entity`, `AggregateRoot`, `ValueObject`, `DomainError`, `DomainEvent`
- `Clock`, `IdGenerator`, `Paginated`, `Cursor`
- `Money`, `Email`, `IanaTimeZone`, `UserId`

New: **`Percentage`** (basis points), used by fees.

## 3. Platform Components

| Component | Responsibility | Change |
|---|---|---|
| **ConfigModule** | Typed, validated settings. Refuses to start if one is missing. | Supabase URL, JWKS URL, pooler URL; provider keys (M4/M5); Grafana and Sentry |
| **DatabaseModule** | `pg` pools through the **Supabase pooler**, TLS with certificate check. **Separate pools** (bulkheads): `web`, `worker`, `reports`. Drizzle instance. | Was Render Postgres |
| **TransactionModule** | `@Transactional()` through `@nestjs-cls/transactional`; retries on serialization and deadlock errors | Unchanged |
| **Outbox** (new) | Domain events that trigger durable work are written to `outbox_events` **in the same transaction**. A worker relay moves them to BullMQ, at least once. Replaces version 1's "lost after commit" limitation. | New (resiliency, money) |
| **DomainEventBus** | In-process handlers after commit, for quick, non-durable reactions | Unchanged |
| **RedisModule** | Shared `ioredis` connections (app and BullMQ) | Unchanged |
| **QueueModule** | BullMQ queues: `email`, `revalidation`, `media-cleanup`, `maintenance`, `outbox-relay`, `holds`, `payments-inbox` (M4), `refunds` (M4), `reconciliation` (M4) | Queues added |
| **LoggingModule** | `nestjs-pino` JSON logs with request id; redaction | Ships to Grafana Loki |
| **TelemetryModule** (new) | OpenTelemetry traces and metrics to Grafana Cloud; Sentry errors; business metrics (orders, holds, scans, webhook lag) | New |
| **ResilienceModule** (new) | Timeout per outside call; circuit breaker per provider; retry with backoff and jitter for safe operations | New (RESILIENCY-10) |
| **HttpModule** | Validation pipe, problem-details filter, CORS (frontend origins only), `/v1`, security headers, body size limit | Unchanged |
| **RateLimiter** | Redis fixed-window limits: orders, checkout, scans, places, webhooks | Policies added |
| **HealthModule** | `/health/live`, `/health/ready` (Postgres, Redis) | Unchanged |
| **OpenApiModule** | `/openapi.json`; docs UI off in production | Unchanged |
| **AuditTrail** | Append-only `audit_log` with actor, action, before, after | Used by payments and staff actions |

## 4. Business Modules

### 4.1 Identity (replaced)
**Purpose:** who the caller is. Supabase Auth does the sign-in. The API only verifies and describes the caller.

- **Domain:**
  - `AuthenticatedUser` (value): id, email, email verified, `aal` (`aal1`/`aal2`), sign-in methods.
  - `PlatformRole` (`staff`).
- **Application:**
  - `ProfileService`: me, profile, dashboard theme.
  - `UserDirectory`: contact details from `profiles`.
  - `PlatformStaffDirectory`: `isStaff(userId)`, cached for 60 seconds.
- **Infrastructure:**
  - `SupabaseTokenVerifier`: `jose` with a cached remote JWKS. Checks issuer, audience, expiry and algorithm.
  - `DrizzleProfileRepository`, `DrizzlePlatformStaffReader`.
- **Presentation:**
  - Global `AccessTokenGuard` (deny by default, `@Public()` to opt out).
  - `@CurrentUser()`.
  - **`@RequireMfa()`** guard (needs `aal2`).
  - **`PlatformStaffGuard`**.
  - `MeController`.
- **Public interface:** `AccessTokenGuard`, `CurrentUser`, `RequireMfa`, `PlatformStaffGuard`, `UserDirectory`, `AuthenticatedUser`.
- **Removed:** sign-in codes, sessions, Google OIDC and the `/auth/*` endpoints. They are parked on branch `parked/own-auth`.

### 4.2 Events (delta from version 1)
Version 1 content stands (`Event`, `TicketType`, `EventMember`, `EventAccessPolicy`, U3 functional design), plus:
- **`PurchasePolicy`** (value object on `Event`):
  - `perBuyerLimit` (1–10, default 10)
  - `feeChoice` (`host_absorbs` default, or `guest_pays`)
- **Paid ticket types gate:** `Event.publish()` with paid types asks the **`PayoutReadiness`** port, `isReady(ownerId, currency)`.
  - The port is declared by Events and implemented by Payments.
  - Until M4, a stub always says "not ready", so paid publishing is refused.
- **`EventCancelled`** now also triggers refunds in Payments (M4).
- **Public interface additions:** `EventPurchaseRules` (limit, fee choice, currency, owner, status, sales windows), read by Ticketing and Payments.

### 4.3 Engagement
Unchanged:
- **Classes:** `QuestionSet` (fix C3), `Announcement` drafts.
- **Public interface:** `QuestionCatalog`.

### 4.4 Ticketing (was Registration)
**Purpose:** getting buyers tickets, free or paid, and getting guests in through the door.

- **Domain:**
  - **`Order`** (aggregate): buyer, event, `OrderLine[]` (ticket type, quantity, unit price snapshot), guest names, answers.
    - Kind: `free` or `paid`.
    - Status: `completed`, `pending_approval`, `awaiting_payment`, `expired`, `waitlisted`, `cancelled`.
    - Hold expiry, and amount snapshot (`OrderAmounts`: subtotal, fees shown, total, currency).
    - Methods: `complete()`, `awaitPayment(holdUntil)`, `markPaid(paymentRef)`, `expire()`, `approve()`, `cancel()`.
  - **`Ticket`** (entity, one row in `registrations`): `TicketCode`, ticket type, guest name, holder (the buyer), status (`confirmed`, `pending`, `waitlisted`, `cancelled`, `refunded`), check-in.
    - Methods: `checkIn(by, at)`, `void(reason)`.
  - **`EventInventory`** (aggregate): per event, the counters (sold, held per ticket type; active per event), capacity and sales windows.
    - `admit(order, now)` is all-or-nothing. It returns `Admitted`, `Pending`, `Waitlisted` or `Refused`.
    - `hold(order, until)`, `release(order)`, `convertHold(order)`.
  - **`BuyerAllowance`** (value): tickets the buyer already holds for the event, compared with `perBuyerLimit`.
  - Value objects: `TicketCode`, `GuestName`, `AnswerSet`, `Quantity`.
  - Errors: `NotOpenForSale`, `OutsideSalesWindow`, `BuyerLimitExceeded`, `NotEnoughTickets`, `MissingRequiredAnswer`, `InvalidOptionAnswer`, `OrderNotPayable`, `HoldExpired`, `TicketNotFound`, `NotConfirmed`, `AlreadyCheckedIn`, `TicketRefunded`, `WrongEvent`.
  - Repository interfaces:
    - `EventInventoryRepository.lockForPurchase(eventId)` locks the event's ticket type rows with `FOR UPDATE`, in id order.
    - `OrderRepository`, `TicketRepository`.
- **Application:**
  - `OrderService`: free order, start paid order, apply payment, expire hold.
  - `ApprovalService`, `WaitlistService`, `CheckInService`.
  - `TicketQueryService`, `GuestListQueryService`, `BuyerOrdersQuery`.
  - Handlers for Payments events: `PaymentSucceeded`, `RefundSucceeded`.
- **Infrastructure:** Drizzle repositories and read queries, `CryptoTicketCodeGenerator`, `HoldExpiryProcessor`.
- **Presentation:** `OrdersController`, `TicketsController`, `GuestsController`, `CheckInController`.
- **Public interface:**
  - `TicketingStats` (confirmed count, has paid orders)
  - `OrderReader` (amounts, buyer, status, lines)

### 4.5 Payments (new; built in M4/M5)
**Purpose:** money. Checkout sessions, confirmation, fees, payouts to hosts, refunds, disputes, ledger and reconciliation. Isolated as a security-critical module (SECURITY-11).

- **Domain:**
  - **`Payment`** (aggregate): order, provider, provider reference, amount, currency, status (`initiated`, `succeeded`, `failed`), attempts.
  - **`Refund`** (aggregate): payment, amount, reason (`host`, `event_cancelled`, `late_payment`), initiated by, status (`requested`, `succeeded`, `failed`), attempts.
  - **`Dispute`** (aggregate): payment, provider case id, status, amount.
  - **`PayoutAccount`** (aggregate): owner, provider, provider account id, currencies, status (`pending`, `verified`, `restricted`).
  - **`FeeSchedule`** (aggregate per currency): percentage (basis points), fixed amount, effective from. Changed only by platform staff, and audited.
  - **`FeeCalculator`** (domain service): from line prices, the fee choice, the `FeeSchedule` and the provider's `ChargeModel`, it produces `Quote` = buyer total, G-ventZ fee, estimated provider charge, host share. Gross-up applies when guests pay.
  - **`ProviderRouter`** (domain service): event currency plus the host's payout account → `paystack` or `stripe`.
  - **`LedgerEntry`** (append-only): kind (`charge`, `gventz_fee`, `provider_charge`, `host_share`, `refund`, `dispute`), amount, currency, references.
  - **`WebhookEvent`** (inbox row): provider, provider event id (unique), received at, payload, processed at, outcome.
- **Ports:**
  - `PaymentProvider`: create checkout, verify payment, refund, verify and parse webhook.
  - `PayoutAccountProvider`: list banks, resolve account, create subaccount or connected account, onboarding link.
  - `ProviderStatement`: list settled transactions for a day, for reconciliation.
- **Application:**
  - `CheckoutService`, `WebhookIngestService`, `PaymentEventProcessor` (worker).
  - `RefundService`, `DisputeService`, `PayoutAccountService`, `FeeScheduleService`.
  - `SalesQueryService`, `ReconciliationService`, `SupportLookupQuery`.
  - Handler for `EventCancelled`, which queues refunds.
- **Infrastructure:**
  - `PaystackProvider` (M4) and `StripeProvider` (M5), both behind circuit breakers.
  - Drizzle repositories.
  - Inbox, refund and reconciliation processors.
- **Presentation:**
  - `CheckoutController`, `WebhooksController` (public; signature-checked; no token).
  - `PayoutAccountController` (MFA), `RefundsController` (MFA), `SalesController`.
  - `StaffPaymentsController` (staff and MFA).
- **Public interface:** `PayoutReadiness` (implements the Events port).
  - Ticketing hears about payments through domain events: `PaymentSucceeded` and `RefundSucceeded`, delivered through the outbox.

### 4.6 Media
Version 1, with **`FileStorage` → `SupabaseStorageFileStorage`**:
- signed upload URLs to the private bucket `event-covers`
- a check on confirm
- deletion, including a whole event folder, with no 100-file limit

### 4.7 Discovery
Unchanged: featured events, outside listings (cached in Redis), Places proxy with per-user limits.

### 4.8 Notifications
- **Emails:**
  - **order tickets** (one email, one QR per ticket)
  - receipt (M4)
  - refund notice (M4)
  - payout-account change notice (M4)
  - order expired or late-payment refund notice (M4)
- **Sign-in emails are no longer sent here.** Supabase Auth sends them through Resend SMTP.
- **Revalidation:** HMAC-signed calls to Next.js, unchanged.
- **Adapters:** `Mailer` → Resend (idempotency key), `QrCodeRenderer`.

## 5. Permission Matrix

Event roles (`EventAccessPolicy`). No role on an event gives 404.

| Permission | owner | admin | editor | checkin | finance | viewer |
|---|---|---|---|---|---|---|
| `event.viewDashboard` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `event.edit` (details, location, settings, **per-buyer limit**) | ✓ | ✓ | ✓ | | | |
| `event.publish` | ✓ | ✓ | | | | |
| `event.fees` (fee choice; new) | ✓ | ✓ | | | | |
| `questions.manage`, `flyer.manage`, `waitlist.promote`, `announcements.draft` | ✓ | ✓ | ✓ | | | |
| `orders.approve` (new; approval events) | ✓ | ✓ | ✓ | | | |
| `guests.checkIn` | ✓ | ✓ | ✓ | ✓ | | |
| `sales.view`, `orders.view` (new) | ✓ | ✓ | | | ✓ | |
| `orders.refund` (new; also needs MFA) | ✓ | ✓ | | | ✓ | |
| `event.cancel`, `members.manage`, `audit.read` | ✓ | ✓ | | | | |
| `event.delete` | ✓ | | | | | |

**Account-level permissions** (not tied to an event):
- **Payout account:** only the account's own user (the owner), and only with MFA.

**Platform staff permissions** (`PlatformStaffGuard`; MFA always required):
- `platform.fees.manage`
- `platform.reconciliation.view`
- `platform.support.lookup`
- `platform.disputes.view`

## 6. External Adapters

| Interface | Implementation | Module | Timeout, breaker |
|---|---|---|---|
| `TokenVerifier` | Supabase JWKS (`jose`, cached) | Identity | JWKS fetch 3 s; uses cached keys if the fetch fails |
| `FileStorage` | Supabase Storage | Media | 5 s |
| `ExternalEventSource` | Ticketmaster, PredictHQ, iCal | Discovery | 4 s each; skipped when failing |
| `PlacesClient` | Google Places | Discovery | 3 s |
| `Mailer` | Resend | Notifications | 10 s; breaker; queued retries |
| `RevalidationClient` | Next.js HMAC endpoint | Notifications | 5 s; queued retries |
| `PaymentProvider`, `PayoutAccountProvider`, `ProviderStatement` | Paystack (M4), Stripe (M5) | Payments | 10 s; breaker per provider; idempotency keys |

## 7. Workload Criticality (RESILIENCY-01)

| Criticality | Components | Impact if unavailable |
|---|---|---|
| Critical | Identity verification, Ticketing (orders, inventory, check-in), Payments (checkout, webhooks), Platform (database, outbox) | Guests can't get tickets or get in; money is taken without tickets; the December event fails at the door |
| High | Events commands, Payments refunds and payouts, Notifications email | Hosts can't manage events; refunds are delayed; tickets aren't emailed, though they are still visible by link |
| Medium | Discovery, Media, Places | Browsing is degraded; flyers can't be changed |
| Low | Announcement drafts | No user impact |
