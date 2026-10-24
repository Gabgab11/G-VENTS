# Services (version 2, Change 1)

Version 1 is in `v1/services.md`. Application services are use cases: they load aggregates, call domain methods, save, and publish events. Controllers only map HTTP. Query services read straight into DTOs.

## Orchestration Conventions

1. **Transactions:** every writing command is `@Transactional()`. It is retried on serialization or deadlock errors, up to 3 times.
2. **Outbox for durable side effects:**
   - Events that start durable work are written to `outbox_events` in the same transaction as the change. Examples: ticket email, revalidation, refunds, applying a payment to an order.
   - The worker's `OutboxRelay` moves them to BullMQ, at least once.
   - Handlers are idempotent, with deterministic job ids joined by `.`.
   - This replaces version 1's accepted limitation that a side effect could be lost after commit.
3. **In-process events** after commit are used only for quick, non-essential reactions such as metrics.
4. **Authorization at the edge:**
   - `AccessTokenGuard` verifies the Supabase token through the cached JWKS.
   - `EventPermissionGuard` checks event permissions, returning 404 when the caller has no access.
   - `RequireMfa` needs `aal2`. `PlatformStaffGuard` checks staff routes.
   - The domain re-checks rules that depend on loaded data, such as order ownership and ticket status.
5. **Outside calls** go through `CircuitBreaker` with explicit timeouts. Payment calls carry idempotency keys.
6. **Errors:**
   - `DomainError` → RFC 9457 with a stable code.
   - Anything else is logged with the request id, sent to Sentry, and returned as a generic 500.
   - Payment and authorization paths fail closed.
7. **Money:**
   - Every amount is `Money`: integer minor units plus currency.
   - The quote is fixed on the order when it is created.
   - Ledger entries are append-only. They are never updated or deleted.

## Service Catalogue

| Service | Module | Kind | Main collaborators | Events raised |
|---|---|---|---|---|
| `ProfileService` | Identity | Command + query | `ProfileRepository` | — |
| `EventCommandService` | Events | Command | `EventRepository`, `PayoutReadiness`, `TicketingStats` | `EventCreated`, `EventUpdated`, `EventPublished`, `EventCancelled`, `EventDeleted` |
| `EventQueryService`, `EventAccessService` | Events | Query | read queries, `EventAccessPolicy` | — |
| `QuestionService`, `AnnouncementService` | Engagement | Command + query | repositories | `QuestionsChanged` |
| `OrderService` | Ticketing | Command | `EventInventoryRepository`, `OrderRepository`, `TicketRepository`, `QuestionCatalog`, `EventPurchaseRules`, `UserDirectory`, `RateLimiter`, `FeeQuotePort` (M4) | `OrderCompleted`, `OrderPendingApproval`, `OrderWaitlisted`, `OrderAwaitingPayment`, `OrderExpired`, `PublicCountChanged` |
| `ApprovalService`, `WaitlistService` | Ticketing | Command | same | `OrderCompleted`, `OrderAwaitingPayment` |
| `CheckInService` | Ticketing | Command | `TicketRepository`, `EventAccessService`, `Metrics` | `GuestCheckedIn` |
| `TicketQueryService`, `GuestListQueryService`, `BuyerOrdersQuery` | Ticketing | Query | read queries | — |
| `CheckoutService` | Payments | Command | `OrderReader`, `PayoutAccountRepository`, `ProviderRouter`, `FeeCalculator`, `PaymentProvider` | `PaymentInitiated` |
| `WebhookIngestService` | Payments | Command | `PaymentProvider.parseWebhook`, `WebhookInboxRepository` | — (queues inbox job) |
| `PaymentEventProcessor` | Payments | Worker | `PaymentProvider.verifyPayment`, `PaymentRepository`, `LedgerRepository` | `PaymentSucceeded`, `PaymentFailed` |
| `RefundService` | Payments | Command + worker | `PaymentProvider.refund`, `RefundRepository`, `LedgerRepository`, `AuditTrail` | `RefundRequested`, `RefundSucceeded`, `RefundFailed` |
| `PayoutAccountService` | Payments | Command | `PayoutAccountProvider`, `PayoutAccountRepository`, `AuditTrail` | `PayoutAccountChanged` |
| `FeeScheduleService` | Payments | Command | `FeeScheduleRepository`, `AuditTrail` | — |
| `SalesQueryService`, `SupportLookupQuery` | Payments | Query | ledger read queries | — |
| `ReconciliationService` | Payments | Worker | `ProviderStatement`, `LedgerRepository`, `Metrics` | `ReconciliationMismatch` |
| `DisputeService` | Payments | Worker | `DisputeRepository`, `LedgerRepository` | `DisputeOpened`, `DisputeClosed` |
| `FlyerService` | Media | Command | `FileStorage` (Supabase), `EventCoverPort` | `FlyerReplaced` |
| `OutsideListingsService`, `PlacesService` | Discovery | Query | sources, `PlacesClient`, `RateLimiter` | — |
| `EmailComposer` + processors | Notifications | Worker | `Mailer`, `QrCodeRenderer`, `EventSummaryReader`, `UserDirectory`, `OrderReader` | — |
| `RevalidationProcessor` | Notifications | Worker | `RevalidationClient` | — |

## Event Subscriptions (all through the outbox unless noted)

| Domain event | Handler | Action |
|---|---|---|
| `OrderCompleted` | Notifications `OrderTicketsEmailHandler` | One email to the buyer with every ticket's QR. Job id `order-tickets.{orderId}`. |
| `OrderCompleted`, `GuestCheckedIn` (count only), `EventCreated`, `EventUpdated`, `EventPublished`, `EventCancelled`, `EventDeleted`, `QuestionsChanged`, `FlyerReplaced` | Notifications `RevalidationHandler` | Revalidate `event:{slug}` and `featured` (debounced per slug) |
| `OrderAwaitingPayment` | Ticketing `HoldExpiryScheduler` | Delayed job at hold expiry: `hold-expiry.{orderId}`. Expired holds are also swept every minute. |
| `PaymentSucceeded` (M4) | Ticketing `OrderService.applyPayment` | If the hold is valid, or tickets are still free: complete the order and issue tickets. Otherwise raise `LatePaymentUnfillable`. |
| `LatePaymentUnfillable` (M4) | Payments `RefundService.systemRefund` | Full automatic refund, and email the buyer |
| `RefundSucceeded` (M4) | Ticketing `TicketVoidHandler` | Void the tickets and return them to inventory |
| `EventCancelled` (M4) | Payments `RefundService.refundCancelledEvent` | One refund job per paid order |
| `EventDeleted`, `FlyerReplaced` | Media `FlyerCleanupHandler` | Delete the files |
| `PayoutAccountChanged`, `RefundSucceeded`, `RefundFailed`, `DisputeOpened` (M4) | Notifications | Emails to the host or buyer |
| `ReconciliationMismatch`, `RefundFailed` (final), `DisputeOpened` (M4) | Platform alerting (metrics) | Grafana alert to on-call and staff |

## Key Orchestrations

### Free order, with several tickets (FR-4, US-3.1)
1. `OrdersController` calls `OrderService.placeFreeOrder(eventId, buyer, { lines, guestNames, answers })`. It is rate limited per user and per IP.
2. Inside `@Transactional()`:
   1. `EventPurchaseRules.get` checks the event is published, registration is open and the sales windows. `QuestionCatalog` gives the `AnswerSet`.
   2. `EventInventoryRepository.lockForPurchase(eventId)` locks that event's ticket type rows in a fixed order. This serializes purchases for one event across instances; other events aren't affected.
   3. `TicketRepository.countHeldByBuyer` gives the `BuyerAllowance`. If it's over the limit: `BuyerLimitExceeded`.
   4. `EventInventory.admit(order)` is all-or-nothing:
      - `Admitted` → the order completes, and the tickets are confirmed.
      - Approval events → `pending_approval`; the tickets are pending.
      - Capacity full → `waitlisted`; the exact rule is set in U4 Functional Design.
      - Not enough of a ticket type → refused.
   5. A `TicketCode` is generated per ticket. Order, tickets and counters are saved, and outbox rows are written.
3. After commit, the relay queues the order tickets email and the revalidation. The API answers 201 with the order and ticket codes.

### Paid order and checkout (FR-5, US-4.1 to 4.3, M4)
1. `OrderService.startPaidOrder` follows the same steps as a free order. Then:
   - `admit` places a **hold**, held += quantity.
   - `FeeQuotePort` (Payments' `FeeCalculator`) fixes the amounts on the order.
   - The order is `awaiting_payment`, with a hold until now + 10 minutes.
   - `OrderAwaitingPayment` is written to the outbox, which schedules the expiry.
2. `CheckoutService.start(orderId)`:
   - `ProviderRouter` chooses Paystack or Stripe.
   - `Payment.initiate`.
   - `PaymentProvider.createCheckout` with the split and idempotency key `checkout.{orderId}`.
   - It returns the provider URL. Next.js redirects the buyer there.
3. The buyer pays, with Apple Pay or Google Pay on the provider's page where available, and returns to `/orders/{id}`. That page only shows the status.

### Webhook ingest and processing (FR-5.3 to 5.5, M4)
1. **Ingest:** `POST /v1/webhooks/{provider}` is public and needs no token. `WebhookIngestService.receive`:
   - checks the signature over the raw body
   - inserts the event into `webhook_inbox`, unique on (provider, event id)
   - queues `payments-inbox.{inboxId}`
   - answers **200** within milliseconds
   - A duplicate is a no-op 200. A bad signature gets 400, is logged, and counts toward an alert.
2. **Processing:** the worker runs `PaymentEventProcessor.process`, in one transaction:
   - `PaymentProvider.verifyPayment(providerRef)`, a server-side check.
   - `Payment.succeed(verified)`, which requires amount and currency to match.
   - Ledger entries: charge, G-ventZ fee, provider charge, host share.
   - The inbox row is marked processed.
   - `PaymentSucceeded` goes to the outbox.
3. **Ticketing:** `applyPayment` completes the order: hold → sold, tickets confirmed. It writes `OrderCompleted`, which sends the tickets and receipt emails.
   - It is idempotent: a completed order ignores repeats.

### Hold expiry and late payment (FR-5.6)
1. The `hold-expiry.{orderId}` job, or the minute sweep, runs `OrderService.expireHolds`:
   - It locks the inventory, releases the held tickets, and sets the order to `expired`.
2. If `PaymentSucceeded` arrives for an expired order, `applyPayment` re-admits it:
   - If tickets are free, it completes.
   - If not, it raises `LatePaymentUnfillable` → system refund → buyer email.

### Host refund (FR-10.1, M4)
1. `RefundsController` checks `orders.refund` and **MFA**, then calls `RefundService.hostRefund`. In one transaction it:
   - creates the `Refund`, for the ticket amount, from the host's share (D43)
   - writes an audit entry
   - writes `RefundRequested` to the outbox
2. The worker's `processRefundJob` calls `PaymentProvider.refund`:
   - Idempotency key: `refund.{refundId}`.
   - On Stripe, `reverseHostShare` is true.
   - On Paystack, the method is confirmed in U7 Functional Design (risk R-P1).
   - Ledger entries are written, and the refund is marked requested.
3. The provider's refund webhook goes through the inbox: `Refund.succeed` or `fail` → `RefundSucceeded` → Ticketing voids the tickets and returns them to inventory → the buyer is emailed.

### Cancel an event with paid tickets (FR-2.4, FR-10.2)
- `EventCommandService.cancel` → `EventCancelled` (outbox) → `RefundService.refundCancelledEvent` queues one refund job per paid order, with job id `refund-cancel.{orderId}`.
- Failed refunds are retried with backoff. A final failure alerts the host and on-call (`RefundFailed`).

### Check-in scan (FR-7, US-8.1 to 8.3)
1. The Next.js scanner action calls `POST /v1/events/{eventId}/check-in` with `{ code }`.
2. `EventPermissionGuard` checks `guests.checkIn`, then `CheckInService.scan`:
   - It looks the ticket up by code. A code from another event → `WrongEvent`.
   - It checks the status: refunded, pending or waitlisted gets a red result with the reason.
   - `TicketRepository.checkInIfNotYet` is a single conditional `UPDATE ... WHERE checked_in_at IS NULL`. If two devices scan at once, only one wins. The loser gets "already used", with the time and device.
3. The target is under 300 ms p95 at the API. This is one indexed lookup and one update, with no event-wide lock.

### Daily reconciliation (FR-15.2, M4)
- At 02:00 in the platform's zone, `ReconciliationService.runForDay(yesterday)` compares `ProviderStatement` against the ledger by provider reference:
  - It records the result.
  - Any mismatch raises `ReconciliationMismatch`, which alerts.

### Connect a payout account (FR-9, M4)
- `PayoutAccountController` (MFA) calls `PayoutAccountService.connect`:
  - **Paystack:** `resolveAccount` shows the account name, then `createAccount` creates the subaccount.
  - **Stripe:** `createAccount` returns the onboarding URL.
- The account starts as `pending`. Provider webhooks update the status. The change is audited, and a notice email is sent.
