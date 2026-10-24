# Components

Backend repository: `/Users/payazaafrica/gventz-api` (`gventz-api`). NestJS 11, Node 22, TypeScript strict. Design decisions come from `aidlc-docs/inception/plans/application-design-plan.md` (all answers A).

## 1. Repository layout

```text
gventz-api/
├── src/
│   ├── main.ts                    # boots the API role, the worker role, or both (APP_ROLE)
│   ├── app.module.ts
│   ├── shared/                    # framework-free building blocks
│   │   ├── domain/                # Entity, AggregateRoot, ValueObject, DomainError, DomainEvent
│   │   └── kernel/                # Clock, IdGenerator, Result helpers, Paginated<T>
│   ├── platform/                  # cross-cutting NestJS infrastructure
│   │   ├── config/  database/  transaction/  redis/  queue/
│   │   ├── logging/  http/  rate-limit/  health/  openapi/
│   │   └── events/                # domain event bus (after-commit dispatch)
│   └── modules/
│       ├── identity/  events/  engagement/  registration/
│       ├── media/  discovery/  notifications/
│       └── <module>/
│           ├── domain/            # entities, value objects, errors, repository interfaces
│           ├── application/       # use-case services, query services, DTOs, event handlers
│           ├── infrastructure/    # Drizzle repositories, external adapters, job processors
│           ├── presentation/      # controllers, request/response DTOs, guards
│           ├── <module>.module.ts
│           └── index.ts           # the module's public interface (only thing other modules import)
├── drizzle/                       # schema migrations (generated SQL, applied on deploy)
├── scripts/migrate-from-supabase/ # data migration tool (U6)
├── test/                          # integration and e2e (Testcontainers)
└── render.yaml
```

### Layer rules
| Layer | May import | Must not import |
|---|---|---|
| `domain` | `shared/domain`, `shared/kernel`, its own module's domain | NestJS, Drizzle, Redis, other modules |
| `application` | its domain, `platform` interfaces, other modules' `index.ts` | Drizzle tables, controllers, adapters directly |
| `infrastructure` | its domain and application, `platform` | other modules' internals |
| `presentation` | its application layer, `platform/http` | repositories, Drizzle |

An ESLint boundaries rule enforces these in CI.

## 2. Shared building blocks (`shared/`)

| Component | Purpose |
|---|---|
| `Entity<TId>` | Identity and equality by id |
| `AggregateRoot<TId>` | Entity that records domain events (`pullEvents()`) |
| `ValueObject<TProps>` | Immutable, validated on construction, equality by value |
| `DomainError` | Base class for rule violations. Has a stable `code`, a user-safe message and an HTTP category (`not_found`, `conflict`, `invalid`, `forbidden`, `rate_limited`) |
| `DomainEvent` | Base class for facts such as `RegistrationConfirmed` |
| `Clock` | Abstract current time (testable; fixed clock in tests) |
| `IdGenerator` | UUIDs (v7 for new rows; existing v4 ids kept) |
| `Paginated<T>`, `Cursor` | Keyset pagination result and opaque cursor |

## 3. Platform components (`platform/`)

| Component | Responsibility |
|---|---|
| **ConfigModule** | Loads environment variables, validates them at startup (refuses to start if one is missing), exposes typed config classes per area |
| **DatabaseModule** | `pg` pool (bounded), Drizzle instance, full schema definition |
| **TransactionModule** | `@nestjs-cls/transactional` with the Drizzle adapter. `@Transactional()` on service methods; repositories use the ambient transaction |
| **DomainEventBus** | Collects events from aggregates saved in a transaction and dispatches them to handlers **after commit** |
| **RedisModule** | Shared `ioredis` connection |
| **QueueModule** | BullMQ queues (`email`, `revalidation`, `media-cleanup`) and processor registration when `APP_ROLE` includes `worker` |
| **LoggingModule** | `nestjs-pino` JSON logs, request id from `x-request-id`, redaction of tokens, codes and emails |
| **HttpModule** | Global `ValidationPipe` (class-validator), `ProblemDetailsFilter` (maps `DomainError` to RFC 9457), CORS, versioning (`/v1`) |
| **RateLimiter** | Redis fixed-window counters, used for sign-in codes, registration and Places |
| **HealthModule** | `GET /health/live`, `GET /health/ready` (Postgres and Redis) |
| **OpenApiModule** | Swagger document at `/openapi.json`, docs UI at `/docs` outside production |

## 4. Business modules

### 4.1 Identity
**Purpose**: who the caller is. Accounts, sign-in by email code and Google, sessions, profile.

- **Domain**
  - `User` (aggregate): id, `Email`, email verified, `Profile` (full name, country, dashboard theme), linked `ExternalIdentity` list.
  - `ExternalIdentity` (entity): provider `google`, subject, email at link time.
  - `SignInCode` (aggregate): email, code hash, expiry, attempts left, consumed. Owns `verify(code, now)`.
  - `Session` (aggregate): id, user id, client type (`web` or `mobile`), family id, current refresh-token hash, last used, revoked. Owns `rotate()`, `detectReuse()`, `revoke()`.
  - Value objects: `Email`, `UserId`, `DashboardTheme`.
  - Errors: `InvalidSignInCode`, `SignInCodeExpired`, `TooManyAttempts`, `GoogleEmailNotVerified`, `RefreshTokenReused`, `SessionRevoked`.
  - Repository interfaces: `UserRepository`, `SignInCodeRepository`, `SessionRepository`.
- **Application**: `EmailCodeSignInService`, `GoogleSignInService`, `SessionService`, `ProfileService`, `AccountLinker`.
- **Infrastructure**: Drizzle repositories; `GoogleOidcClient` (`openid-client`); `JwtAccessTokenSigner`; `Sha256TokenHasher`; `RedisPkceStore` (state → verifier + nonce, 10 minutes).
- **Presentation**: `AuthController`, `MeController`, global `AccessTokenGuard` (all routes need a token unless marked `@Public()`), `@CurrentUser()`.
- **Public interface (`index.ts`)**: `UserDirectory` (`getContact(userId)`), `AccessTokenGuard`, `CurrentUser`, `AuthenticatedUser` type.

### 4.2 Events
**Purpose**: what an event is and who may manage it.

- **Domain**
  - `Event` (aggregate): owner, `EventTitle`, `Slug`, description, `Category`, `EventSchedule` (start, end, `IanaTimeZone`), `Location` (`Venue` or `Online`), `Visibility`, `EventStatus`, `Capacity`, `CoverTheme`, cover image, refund policy, approval flag, attendee-count display, registration open. Owns `changeLocation()` (fix C1), `updateDetails()`, `publish()`, `cancel()`, `openRegistration()`, `closeRegistration()`, `setCapacity()`, `setCover()`, `clearCover()`, `assertDeletableBy()`.
  - `TicketType` (entity inside `Event` at creation): name, `Money`, quantity, sales window, active.
  - `EventMember` (entity): user, `EventRole`, accepted.
  - Value objects: `Slug`, `EventTitle`, `Category`, `IanaTimeZone`, `EventSchedule`, `Location`, `Money`, `Capacity`, `CoverTheme`, `EventRole`.
  - `EventAccessPolicy` (domain service): the permission matrix (section 5).
  - Errors: `EventNotFound`, `InvalidLocation`, `EventAlreadyCancelled`, `DeleteConfirmationMismatch`, `EventHasPaidRegistrations`, `TooManyTicketTypes`.
  - Repository interfaces: `EventRepository`, `EventMemberRepository`.
- **Application**: `EventCommandService`, `EventQueryService`, `EventAccessService`.
- **Infrastructure**: Drizzle repositories, `DrizzleEventQueries` (read side), `SlugGenerator`.
- **Presentation**: `EventsController`, `HostEventsController`, `EventPermissionGuard` + `@RequireEventPermission()`.
- **Public interface**: `EventAccessService`, `EventPermissionGuard`, `RequireEventPermission`, `EventCoverPort` (used by Media), `EventSummaryReader` (title, slug, schedule, venue for emails).

### 4.3 Engagement
**Purpose**: what hosts ask guests (questions) and what hosts send guests (announcement drafts).

- **Domain**: `QuestionSet` (aggregate per event: ordered `Question` list, max 30, owns `add()` and `remove()`, fix C3); `Question` (kind, label, options, required); `QuestionKind`; `Announcement` (draft, `AudienceSegment`).
- **Application**: `QuestionService`, `AnnouncementService`.
- **Infrastructure**: `DrizzleQuestionSetRepository` (loads with the event row locked), `DrizzleAnnouncementRepository`.
- **Presentation**: `QuestionsController`, `AnnouncementsController`.
- **Public interface**: `QuestionCatalog` (`getForEvent(eventId)`), used by Registration to validate answers.

### 4.4 Registration
**Purpose**: getting a guest a place, a ticket and in through the door.

- **Domain**
  - `EventInventory` (aggregate): the registration view of one event. Status, registration open, requires approval, capacity, active count (confirmed + pending), ticket types with quantity, sold, price, sales window and active flag. Owns `admit(request, now)`, which returns `Confirmed`, `Pending` or `Waitlisted`, or throws, and updates the counters.
  - `Registration` (aggregate): event, ticket type, user, attendee name, attendee email, `RegistrationStatus`, `TicketCode`, `AnswerSet`, check-in. Owns `checkIn(by, at)`, `confirmFromWaitlist()`.
  - Value objects: `TicketCode` (24 hex), `AttendeeName`, `AnswerSet` (validated against the question catalog), `RegistrationStatus`.
  - Errors: `EventNotOpenForRegistration`, `AlreadyRegistered`, `TicketTypeUnavailable`, `TicketTypeSoldOut`, `OutsideSalesWindow`, `MissingRequiredAnswer`, `InvalidOptionAnswer`, `PaidTicketsNotSupported`, `TicketNotFound`, `NotConfirmed`, `AlreadyCheckedIn`, `WaitlistEmpty`.
  - Repository interfaces: `EventInventoryRepository` (`lockForRegistration`), `RegistrationRepository`.
- **Application**: `RegistrationService`, `WaitlistService`, `CheckInService`, `TicketQueryService`, `GuestListQueryService`.
- **Infrastructure**: Drizzle repositories, `CryptoTicketCodeGenerator`, `DrizzleRegistrationQueries`.
- **Presentation**: `RegistrationsController`, `GuestsController`, `TicketsController`.
- **Public interface**: `RegistrationStats` (`countForEvent`, `hasPaidRegistrations`) used by Events (delete check, attendee count).

### 4.5 Media
**Purpose**: event flyers.

- **Domain**: `Flyer` value object (public id, URL, format, bytes); `FlyerRules` (JPG/PNG/WebP, 5 MB); errors `UnsupportedFlyerFormat`, `FlyerTooLarge`, `UploadNotFound`.
- **Application**: `FlyerService`, handler for `EventDeleted` (enqueue folder cleanup).
- **Infrastructure**: `FileStorage` interface → `CloudinaryFileStorage`; `MediaCleanupProcessor`.
- **Presentation**: `FlyersController`.

### 4.6 Discovery
**Purpose**: what guests browse before they register.

- **Application**: `FeaturedEventsQuery`, `OutsideListingsService`, `PlacesService`.
- **Infrastructure**: `ExternalEventSource` interface → `TicketmasterSource`, `PredictHqSource`, `IcalSource`; `RedisListingsCache`; `GooglePlacesClient`.
- **Presentation**: `DiscoverController`, `PlacesController`.

Discovery owns no tables. It reads public event data through `EventQueryService` and adds outside listings and venue search.

### 4.7 Notifications
**Purpose**: everything that leaves the system as a side effect.

- **Domain**: `EmailMessage` (to, subject, html, text, attachments, idempotency key); `RevalidationRequest` (tags).
- **Application**: handlers for `SignInCodeIssued`, `RegistrationConfirmed`, `WaitlistPromoted` (enqueue email) and for `PublicEventChanged` (enqueue revalidation); `EmailComposer` with `TicketEmailTemplate` and `SignInCodeTemplate`.
- **Infrastructure**: `Mailer` interface → `ResendMailer`; `QrCodeRenderer`; `EmailProcessor`; `RevalidationProcessor` → `NextRevalidationClient` (HMAC-signed).

## 5. Permission matrix (`EventAccessPolicy`)

Taken from today's RLS policies and `requireEventRole` calls. A caller with no role on an event gets 404 (FR-11.3).

| Permission | owner | admin | editor | checkin | finance | viewer |
|---|---|---|---|---|---|---|
| `event.viewDashboard` (drafts, guest list, counts) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `ticketTypes.viewUnpublished` | ✓ | ✓ | ✓ | | ✓ | ✓ |
| `event.edit` (details, location, settings, cover theme) | ✓ | ✓ | ✓ | | | |
| `event.publish` (corrected in U3 functional design: today's `events_guard` allows owner and admin only) | ✓ | ✓ | | | | |
| `questions.manage` | ✓ | ✓ | ✓ | | | |
| `flyer.manage` | ✓ | ✓ | ✓ | | | |
| `waitlist.promote` | ✓ | ✓ | ✓ | | | |
| `announcements.draft` | ✓ | ✓ | ✓ | | | |
| `guests.checkIn` | ✓ | ✓ | ✓ | ✓ | | |
| `event.cancel` | ✓ | ✓ | | | | |
| `members.manage`, `audit.read` | ✓ | ✓ | | | | |
| `event.delete` | ✓ | | | | | |

## 6. External adapters (all behind interfaces)

| Interface | Implementation | Module |
|---|---|---|
| `GoogleOidcClient` | `openid-client` against Google | Identity |
| `AccessTokenSigner` | `jose` (HS256 now; key id allows a switch to RS256 for mobile) | Identity |
| `PkceStore` | Redis | Identity |
| `FileStorage` | Cloudinary (S3 later) | Media |
| `ExternalEventSource` | Ticketmaster, PredictHQ, iCal | Discovery |
| `PlacesClient` | Google Places (New) | Discovery |
| `Mailer` | Resend HTTP API with `Idempotency-Key` | Notifications |
| `RevalidationClient` | HMAC-signed POST to Next.js | Notifications |
