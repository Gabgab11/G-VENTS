# Component Methods (version 2, Change 1)

Version 1 is in `v1/component-methods.md`. Sections marked **unchanged** keep the version 1 signatures.

Business rules are specified in each unit's Functional Design. All service methods are `async`. `Promise` is omitted for readability.

## Shared (unchanged, plus)
```ts
class Percentage extends ValueObject<{ basisPoints: number }> { applyTo(amount: Money): Money; } // rounds half-up to minor units
```

## Platform (additions)
```ts
interface OutboxWriter { append(events: DomainEvent[]): void; }          // same transaction as the aggregate save
class OutboxRelay { drain(batchSize: number): number; }                   // worker: outbox_events -> BullMQ, marks dispatched
interface CircuitBreaker { run<T>(name: string, call: (signal: AbortSignal) => T, opts: { timeoutMs: number }): T; } // throws ServiceUnavailable when open
interface Metrics { increment(name: string, tags?: Record<string, string>): void; observe(name: string, value: number, tags?: Record<string, string>): void; }
interface AuditTrail { record(entry: { actorId: string; action: string; subject: string; before?: unknown; after?: unknown }): void; }
```

## Identity (replaced)
```ts
interface AuthenticatedUser { id: UserId; email: string; emailVerified: boolean; aal: 'aal1' | 'aal2'; methods: string[]; }
interface TokenVerifier { verify(token: string): AuthenticatedUser; }    // signature (JWKS), iss, aud, exp; throws UnauthenticatedError
class ProfileService {
  getMe(user: AuthenticatedUser): MeDto;
  updateProfile(userId: UserId, input: UpdateProfileDto): MeDto;          // name, country, dashboard theme
}
interface UserDirectory { getContact(userId: UserId): { email: string; emailVerified: boolean; fullName: string | null }; }
interface PlatformStaffDirectory { isStaff(userId: UserId): boolean; }   // 60 s cache
```

## Events (version 1, plus)
```ts
class Event extends AggregateRoot<EventId> {
  // version 1 methods unchanged, plus:
  setPurchasePolicy(policy: PurchasePolicy): void;                        // per-buyer limit 1..10
  setFeeChoice(choice: FeeChoice): void;                                  // applies to new orders only
  publish(now: Date, payoutReady: boolean): void;                         // paid types need payoutReady
}
interface PayoutReadiness { isReady(ownerId: UserId, currency: CurrencyCode): boolean; } // declared by Events, implemented by Payments
interface EventPurchaseRules {
  get(eventId: EventId): { status: EventStatus; ownerId: UserId; currency: CurrencyCode; perBuyerLimit: number;
    feeChoice: FeeChoice; requiresApproval: boolean; registrationOpen: boolean; capacity: number | null };
}
class EventCommandService {
  // version 1 methods, plus:
  updatePurchasePolicy(eventId: EventId, input: PurchasePolicyDto): void;
  updateFeeChoice(eventId: EventId, input: FeeChoiceDto): void;
}
```

## Engagement (unchanged)

## Ticketing (replaces Registration)

### Domain
```ts
class Order extends AggregateRoot<OrderId> {
  static place(input: { buyer: UserId; eventId: EventId; lines: OrderLineInput[]; guestNames: string[]; answers: AnswerSet;
    amounts: OrderAmounts; kind: 'free' | 'paid' }, now: Date): Order;
  complete(now: Date): void;
  awaitPayment(holdUntil: Date): void;
  markPaid(paymentRef: string, now: Date): void;          // throws OrderNotPayable if final
  expire(now: Date): void;
  approve(now: Date): void;                               // free -> complete; paid -> awaitPayment
  cancel(reason: string, now: Date): void;
}
class Ticket extends Entity<TicketId> {
  checkIn(by: UserId, at: Date): void;                    // throws NotConfirmed | AlreadyCheckedIn | TicketRefunded
  void(reason: 'refunded' | 'cancelled', at: Date): void;
}
class EventInventory extends AggregateRoot<EventId> {
  admit(order: Order, allowance: BuyerAllowance, now: Date): AdmissionDecision; // all or nothing
  hold(order: Order, until: Date): void;
  convertHold(order: Order): void;                        // held -> sold
  release(order: Order): void;                            // held -> available (expiry, cancel)
  returnTickets(ticketTypeCounts: Map<TicketTypeId, number>): void; // after refund
}
```

### Repository interfaces
```ts
interface EventInventoryRepository { lockForPurchase(eventId: EventId): EventInventory | null; save(inv: EventInventory): void; }
interface OrderRepository { findById(id: OrderId): Order | null; findForUpdate(id: OrderId): Order | null; save(order: Order): void;
  findExpiredHolds(now: Date, limit: number): OrderId[]; }
interface TicketRepository { findByCode(code: TicketCode): Ticket | null; countHeldByBuyer(eventId: EventId, buyer: UserId): number;
  saveAll(tickets: Ticket[]): void; checkInIfNotYet(id: TicketId, by: UserId, at: Date): boolean; }  // conditional update
```

### Application services
```ts
class OrderService {
  placeFreeOrder(eventId: EventId, buyer: AuthenticatedUser, input: PlaceOrderDto): OrderResultDto;   // completed | pending_approval | waitlisted
  startPaidOrder(eventId: EventId, buyer: AuthenticatedUser, input: PlaceOrderDto): PaidOrderDto;     // awaiting_payment + hold (M4)
  applyPayment(orderId: OrderId, paymentRef: string): void;            // handler for PaymentSucceeded; idempotent
  expireHolds(now: Date): number;                                      // worker
}
class ApprovalService { approve(eventId: EventId, orderId: OrderId, staff: UserId): OrderResultDto; }
class WaitlistService { promoteNext(eventId: EventId): OrderResultDto; }
class CheckInService {
  scan(eventId: EventId, code: string, staff: UserId): ScanResultDto;          // green or red with reason
  checkInGuest(eventId: EventId, ticketId: TicketId, staff: UserId): ScanResultDto;
}
class TicketQueryService { getTicket(code: string, viewer: UserId | null): TicketDto; }
class GuestListQueryService { list(eventId: EventId, filter: GuestFilter, cursor?: string): Paginated<GuestDto> & { waitlistCount: number }; }
class BuyerOrdersQuery { listMine(buyer: UserId, cursor?: string): Paginated<MyOrderDto>; get(orderId: OrderId, buyer: UserId): MyOrderDto; }

// public interface
interface TicketingStats { confirmedCount(eventId: EventId): number; hasPaidOrders(eventId: EventId): boolean; }
interface OrderReader { get(orderId: OrderId): OrderSnapshot; }       // amounts, lines, buyer, status, event
```

## Payments (new, M4/M5)

### Domain
```ts
class FeeCalculator {
  quote(input: { lines: PricedLine[]; choice: FeeChoice; schedule: FeeSchedule | null; charges: ChargeModel }): Quote;
}   // Quote = { buyerTotal, gventzFee, providerChargeEstimate, hostShare, currency }
class ProviderRouter { route(currency: CurrencyCode, account: PayoutAccount | null): ProviderName; }   // throws PayoutAccountNotReady
class Payment extends AggregateRoot<PaymentId> {
  static initiate(order: OrderSnapshot, provider: ProviderName, quote: Quote, now: Date): Payment;
  succeed(verified: VerifiedPayment, now: Date): void;     // amount and currency must match, else PaymentMismatch
  fail(reason: string, now: Date): void;
}
class Refund extends AggregateRoot<RefundId> {
  static request(payment: Payment, amount: Money, reason: RefundReason, by: UserId | 'system', now: Date): Refund;
  succeed(providerRef: string, now: Date): void;
  fail(reason: string, now: Date): void;
}
class PayoutAccount extends AggregateRoot<PayoutAccountId> {
  static connect(owner: UserId, provider: ProviderName, providerAccountId: string, currencies: CurrencyCode[], now: Date): PayoutAccount;
  updateStatus(status: PayoutStatus): void;
  changeDetails(providerAccountId: string, now: Date): void;
}
class FeeSchedule extends AggregateRoot<CurrencyCode> { change(rate: Percentage, fixed: Money, by: UserId, now: Date): void; }
```

### Ports
```ts
interface PaymentProvider {
  readonly name: ProviderName;
  createCheckout(req: { orderId: OrderId; amount: Money; split: SplitInstruction; buyerEmail: string; returnUrl: string;
    idempotencyKey: string }): { checkoutUrl: string; providerRef: string };
  verifyPayment(providerRef: string): VerifiedPayment;            // server-side check
  refund(req: { providerRef: string; amount: Money; reverseHostShare: boolean; idempotencyKey: string }): { refundRef: string };
  parseWebhook(rawBody: Buffer, headers: Record<string, string>): ProviderEvent;   // verifies signature first; throws InvalidSignature
}
interface PayoutAccountProvider {
  listBanks(country: CountryCode): Bank[];
  resolveAccount(bankCode: string, accountNumber: string): { accountName: string };
  createAccount(req: PayoutAccountRequest): { providerAccountId: string; onboardingUrl?: string };
}
interface ProviderStatement { settledOn(day: string): ProviderTransaction[]; }
```

### Application services
```ts
class CheckoutService { start(orderId: OrderId, buyer: AuthenticatedUser): { checkoutUrl: string }; }
class WebhookIngestService { receive(provider: ProviderName, rawBody: Buffer, headers: Record<string, string>): void; } // verify -> inbox -> 200
class PaymentEventProcessor { process(inboxId: string): void; }    // verify with provider -> Payment.succeed -> ledger -> PaymentSucceeded
class RefundService {
  hostRefund(eventId: EventId, ticketIds: TicketId[], by: AuthenticatedUser): RefundDto;   // needs aal2 and orders.refund
  refundCancelledEvent(eventId: EventId): number;                    // queues one refund job per paid order
  systemRefund(paymentId: PaymentId, reason: 'late_payment'): RefundDto;
  processRefundJob(refundId: RefundId): void;                        // worker, retried
}
class PayoutAccountService {
  listBanks(country: CountryCode): BankDto[];
  resolve(bankCode: string, accountNumber: string): { accountName: string };
  connect(owner: AuthenticatedUser, input: ConnectPayoutDto): PayoutAccountDto;     // needs aal2
  change(owner: AuthenticatedUser, input: ConnectPayoutDto): PayoutAccountDto;      // needs aal2, audited, notice email
  get(owner: UserId): PayoutAccountDto | null;
}
class FeeScheduleService { list(): FeeScheduleDto[]; change(staff: AuthenticatedUser, currency: CurrencyCode, input: FeeDto): FeeScheduleDto; }
class SalesQueryService { forEvent(eventId: EventId): SalesSummaryDto[]; orders(eventId: EventId, filter: OrderFilter, cursor?: string): Paginated<OrderRowDto>; }
class ReconciliationService { runForDay(day: string): ReconciliationResultDto; }   // alerts on any difference
class DisputeService { record(event: ProviderEvent): void; }
class SupportLookupQuery { byReference(staff: AuthenticatedUser, ref: string): SupportOrderDto; }   // audited
```

## Media
`FileStorage` signatures are unchanged. The implementation becomes `SupabaseStorageFileStorage` (`createSignedUpload` returns a signed upload URL and path).

## Discovery (unchanged)

## Notifications
```ts
class EmailComposer {
  orderTicketsEmail(data: OrderTicketsEmailData): EmailMessage;   // one email, one QR per ticket
  receiptEmail(data: ReceiptEmailData): EmailMessage;             // M4
  refundEmail(data: RefundEmailData): EmailMessage;               // M4
  payoutChangedEmail(data: PayoutChangedEmailData): EmailMessage; // M4
  orderExpiredEmail(data: OrderExpiredEmailData): EmailMessage;   // M4
}
// Mailer, RevalidationClient, processors unchanged; signInCodeEmail removed
```
