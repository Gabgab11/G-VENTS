# Component Methods

Method signatures and their purpose. Business rules are specified in each unit's Functional Design. All service methods are `async` and return `Promise<...>`; `Promise` is omitted below for readability. Errors are `DomainError` subclasses (see components.md).

## Shared

```ts
abstract class AggregateRoot<TId> extends Entity<TId> {
  protected record(event: DomainEvent): void;
  pullEvents(): DomainEvent[];
}
abstract class ValueObject<TProps> { equals(other: this): boolean; }
abstract class DomainError extends Error { abstract readonly code: string; abstract readonly kind: ErrorKind; }
interface Clock { now(): Date; }
interface IdGenerator { uuid(): string; }
interface Paginated<T> { items: T[]; nextCursor: string | null; }
```

## Platform

```ts
interface RateLimiter {
  consume(key: string, limits: { perMinute?: number; perDay?: number }): RateLimitResult; // { allowed, retryAfterSeconds }
}
interface DomainEventPublisher { publish(events: DomainEvent[]): void; } // queued until commit
interface JobQueue<TPayload> { add(name: string, payload: TPayload, opts: { jobId: string; attempts: number; backoffMs: number }): void; }
```

## Identity

### Domain
```ts
class User extends AggregateRoot<UserId> {
  static register(email: Email, now: Date): User;
  linkGoogle(subject: string, email: Email, now: Date): void;
  updateProfile(changes: { fullName?: string; country?: string }): void;
  setDashboardTheme(theme: DashboardTheme): void;
}
class SignInCode extends AggregateRoot<string> {
  static issue(email: Email, codeHash: string, now: Date): SignInCode;  // 10-minute expiry, 5 attempts
  verify(candidateHash: string, now: Date): void;                       // throws InvalidSignInCode | SignInCodeExpired | TooManyAttempts
}
class Session extends AggregateRoot<string> {
  static start(userId: UserId, client: ClientType, refreshHash: string, now: Date): Session;
  rotate(presentedHash: string, nextHash: string, now: Date): void;     // throws RefreshTokenReused (revokes family)
  revoke(now: Date): void;
}
```

### Repository interfaces
```ts
interface UserRepository {
  findById(id: UserId): User | null;
  findByEmail(email: Email): User | null;
  findByGoogleSubject(subject: string): User | null;
  save(user: User): void;
}
interface SignInCodeRepository { findLatest(email: Email): SignInCode | null; save(code: SignInCode): void; }
interface SessionRepository {
  findByRefreshHash(hash: string): Session | null;   // current or previous hash (reuse detection)
  save(session: Session): void;
  revokeFamily(familyId: string, at: Date): void;
}
```

### Application services
```ts
class EmailCodeSignInService {
  requestCode(email: string, ip: string): void;                                   // raises SignInCodeIssued
  verifyCode(email: string, code: string, client: ClientInfo): TokenPair;          // creates user on first sign-in
}
class GoogleSignInService {
  start(redirectUri: string, client: ClientType): { authorizationUrl: string; state: string };
  complete(code: string, state: string, client: ClientInfo): TokenPair;            // links by verified email
}
class SessionService {
  issue(userId: UserId, client: ClientInfo): TokenPair;
  refresh(refreshToken: string): TokenPair;
  signOut(sessionId: string): void;
  verifyAccessToken(token: string): AuthenticatedUser;                             // local, no I/O
}
class ProfileService {
  getMe(userId: UserId): MeDto;
  updateProfile(userId: UserId, input: UpdateProfileDto): MeDto;
}
class AccountLinker { resolveGoogleUser(claims: GoogleClaims, now: Date): User; }

// public interface
interface UserDirectory { getContact(userId: UserId): { email: string; emailVerified: boolean; fullName: string | null }; }
```

`TokenPair = { accessToken: string; accessTokenExpiresAt: string; refreshToken: string; user: MeDto }`

## Events

### Domain
```ts
class Event extends AggregateRoot<EventId> {
  static create(input: NewEventProps, ownerId: UserId, slug: Slug, now: Date): Event;  // with ticket types
  updateDetails(changes: EventDetailsChanges): void;
  changeLocation(location: Location): void;            // replaces every venue field together (C1)
  updateSettings(changes: EventSettingsChanges): void; // visibility, attendee count, registration open, capacity, cover theme
  publish(now: Date): void;
  cancel(now: Date): void;
  setCover(flyer: CoverImage): CoverImage | null;      // returns the replaced cover, if any
  clearCover(): CoverImage | null;
  assertDeletable(confirmTitle: string, hasPaidRegistrations: boolean): void;
}
class EventAccessPolicy {
  roleOf(event: EventAccessFacts, userId: UserId | null): EventRole | null;
  can(role: EventRole | null, permission: EventPermission): boolean;
}
```

### Repository interfaces
```ts
interface EventRepository {
  findById(id: EventId): Event | null;
  save(event: Event): void;
  delete(id: EventId): void;
  slugExists(slug: Slug): boolean;
}
interface EventMemberRepository { findRole(eventId: EventId, userId: UserId): EventRole | null; }
```

### Application services
```ts
class EventCommandService {
  create(ownerId: UserId, input: CreateEventDto): EventCreatedDto;
  updateDetails(eventId: EventId, input: UpdateEventDetailsDto): void;
  changeLocation(eventId: EventId, input: LocationDto): void;
  updateSettings(eventId: EventId, input: UpdateEventSettingsDto): void;
  publish(eventId: EventId): void;
  cancel(eventId: EventId): void;
  deletionCheck(eventId: EventId, userId: UserId): DeletionCheckDto;
  delete(eventId: EventId, userId: UserId, confirmTitle: string): void;   // raises EventDeleted
}
class EventQueryService {
  getPublicPage(slug: string, viewer: UserId | null): EventPageDto;     // 404 for drafts unless staff
  getDashboard(eventId: EventId): EventDashboardDto;
  listHostEvents(userId: UserId, cursor?: string): Paginated<HostEventDto>;
  listFeatured(filter: { category?: Category; cursor?: string }): Paginated<EventCardDto>;
}
class EventAccessService {
  requirePermission(eventId: EventId, userId: UserId | null, permission: EventPermission): EventRole; // 404 if no access
  canCheckIn(eventId: EventId, userId: UserId | null): boolean;
}

// public interface
interface EventCoverPort { setCover(eventId: EventId, cover: CoverImage): CoverImage | null; clearCover(eventId: EventId): CoverImage | null; }
interface EventSummaryReader { getSummary(eventId: EventId): EventSummary; }  // for emails and tickets
```

## Engagement

```ts
class QuestionSet extends AggregateRoot<EventId> {
  add(question: NewQuestion): Question;     // max 30, next position
  remove(questionId: string): void;
}
interface QuestionSetRepository { loadForUpdate(eventId: EventId): QuestionSet; save(set: QuestionSet): void; }

class QuestionService {
  list(eventId: EventId): QuestionDto[];
  add(eventId: EventId, input: AddQuestionDto): QuestionDto;
  remove(eventId: EventId, questionId: string): void;
}
class AnnouncementService {
  draft(eventId: EventId, authorId: UserId, input: DraftAnnouncementDto): AnnouncementDto;
  list(eventId: EventId): AnnouncementDto[];
}

// public interface
interface QuestionCatalog { getForEvent(eventId: EventId): QuestionDefinition[]; }
```

## Registration

### Domain
```ts
class EventInventory extends AggregateRoot<EventId> {
  admit(request: AdmissionRequest, now: Date): AdmissionDecision;   // Confirmed | Pending | Waitlisted; increments counters
  releaseFromWaitlist(): void;                                      // counters when a waitlisted guest is confirmed
}
class Registration extends AggregateRoot<RegistrationId> {
  static fromAdmission(decision: AdmissionDecision, guest: GuestDetails, answers: AnswerSet, code: TicketCode, now: Date): Registration;
  confirmFromWaitlist(now: Date): void;
  checkIn(by: UserId, at: Date): void;      // throws NotConfirmed | AlreadyCheckedIn
}
class AnswerSet extends ValueObject<...> { static fromInput(raw: Record<string, unknown>, questions: QuestionDefinition[]): AnswerSet; }
```

### Repository interfaces
```ts
interface EventInventoryRepository {
  lockForRegistration(eventId: EventId): EventInventory | null;   // SELECT ... FOR UPDATE on the event row
  save(inventory: EventInventory): void;
}
interface RegistrationRepository {
  findById(id: RegistrationId): Registration | null;
  findByTicketCode(code: TicketCode): Registration | null;
  findActiveForUser(eventId: EventId, userId: UserId): Registration | null;
  findOldestWaitlisted(eventId: EventId): Registration | null;
  save(registration: Registration): void;
}
```

### Application services
```ts
class RegistrationService {
  register(eventId: EventId, userId: UserId, input: RegisterDto): RegistrationResultDto; // raises RegistrationConfirmed when confirmed
}
class WaitlistService { promoteNext(eventId: EventId): RegistrationResultDto; }       // raises WaitlistPromoted
class CheckInService {
  checkInGuest(eventId: EventId, registrationId: RegistrationId, staffId: UserId): CheckInResultDto;
  checkInTicket(code: string, staffId: UserId): CheckInResultDto;
}
class TicketQueryService { getTicket(code: string, viewer: UserId | null): TicketDto; }
class GuestListQueryService { list(eventId: EventId, filter: GuestFilter, cursor?: string): Paginated<GuestDto> & { waitlistCount: number }; }

// public interface
interface RegistrationStats {
  confirmedCount(eventId: EventId): number;
  hasPaidRegistrations(eventId: EventId): boolean;
}
```

## Media

```ts
interface FileStorage {
  createSignedUpload(params: { folder: string; maxBytes: number; formats: string[] }): SignedUpload;
  getUploaded(publicId: string): StoredFile | null;
  delete(publicId: string): void;
  deleteFolder(folder: string): void;
}
class FlyerService {
  createUploadSignature(eventId: EventId): SignedUploadDto;
  confirmUpload(eventId: EventId, publicId: string): FlyerDto;   // re-checks format and size; replaced file deleted
  remove(eventId: EventId): void;
}
```

## Discovery

```ts
interface ExternalEventSource { readonly name: string; fetch(query: OutsideQuery, signal: AbortSignal): OutsideEvent[]; }
class OutsideListingsService { list(query: OutsideQuery): OutsideEventDto[]; }  // Redis 1 hour, 4 s per source
interface PlacesClient {
  autocomplete(input: AutocompleteInput): PlaceSuggestion[];
  details(placeId: string, session: string): PlaceDetails;
}
class PlacesService {
  autocomplete(userId: UserId, input: AutocompleteInput): PlaceSuggestionDto[];  // 60/min, 1000/day
  details(userId: UserId, placeId: string, session: string): PlaceDetailsDto;
}
```

## Notifications

```ts
interface Mailer { send(message: EmailMessage): { providerId: string }; }
class EmailComposer {
  ticketEmail(ticket: TicketEmailData): EmailMessage;
  signInCodeEmail(email: string, code: string): EmailMessage;
}
interface RevalidationClient { revalidate(tags: string[]): void; }   // HMAC signature header
class EmailProcessor { process(job: Job<EmailJob>): void; }
class RevalidationProcessor { process(job: Job<RevalidationJob>): void; }
```
