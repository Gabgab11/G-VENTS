# Services

Application services are use cases. Each one loads aggregates through repository interfaces, calls domain methods, saves them, and publishes domain events. Controllers only map HTTP to service calls. Query services read straight into DTOs (Question 6 A).

## Orchestration conventions

1. **Transactions.** Every command method that writes is `@Transactional()` (Question 5 A). Repositories inside it share one transaction through CLS. Queries run outside transactions.
2. **Domain events after commit.** Saving an aggregate pushes its recorded events to the `DomainEventPublisher`. They are dispatched only after the transaction commits. A rollback discards them. Handlers do quick in-process work, or put durable work on BullMQ (Question 4 A).
3. **Idempotent jobs.** Every job has a deterministic `jobId` (for example `ticket-email.{registrationId}.confirmed`; parts are joined with `.` because BullMQ rejects `:` in custom ids), so the same fact never queues two jobs. The Resend call carries the same value as `Idempotency-Key`, so a retried job never sends twice.
4. **Authorization at the edge.** The `AccessTokenGuard` identifies the user. The `EventPermissionGuard` checks `@RequireEventPermission(...)` through `EventAccessService` before the service runs, returning 404 when the caller has no access. Services therefore receive already-authorized ids. Owner-only and ticket-holder rules that depend on loaded data are re-checked in the domain.
5. **Errors.** Services throw `DomainError` subclasses. `ProblemDetailsFilter` maps them to RFC 9457 responses with a stable `code`. Any other error is logged and returned as a generic 500 (Question 7 A).
6. **Accepted limitation.** Dispatch after commit isn't a transactional outbox. If the process dies between commit and enqueue, a side effect can be lost: a ticket email or a cache refresh. At design load this is rare, and the ticket is still visible at `/t/{code}`. An outbox table can replace the publisher later without changing services.

## Service catalogue

| Service | Module | Kind | Main collaborators | Events raised |
|---|---|---|---|---|
| `EmailCodeSignInService` | Identity | Command | `SignInCodeRepository`, `UserRepository`, `RateLimiter`, `SessionService` | `SignInCodeIssued`, `UserRegistered` |
| `GoogleSignInService` | Identity | Command | `GoogleOidcClient`, `PkceStore`, `AccountLinker`, `SessionService` | `UserRegistered`, `GoogleAccountLinked` |
| `SessionService` | Identity | Command | `SessionRepository`, `AccessTokenSigner`, `TokenHasher` | — |
| `ProfileService` | Identity | Command + query | `UserRepository` | — |
| `EventCommandService` | Events | Command | `EventRepository`, `SlugGenerator`, `RegistrationStats` | `EventCreated`, `EventUpdated`, `EventPublished`, `EventCancelled`, `EventDeleted` |
| `EventQueryService` | Events | Query | Drizzle read queries, `EventAccessPolicy` | — |
| `EventAccessService` | Events | Query | `EventMemberRepository`, `EventAccessPolicy`, per-request cache | — |
| `QuestionService` | Engagement | Command + query | `QuestionSetRepository` | `QuestionsChanged` |
| `AnnouncementService` | Engagement | Command + query | `AnnouncementRepository` | — |
| `RegistrationService` | Registration | Command | `EventInventoryRepository`, `RegistrationRepository`, `QuestionCatalog`, `UserDirectory`, `TicketCodeGenerator`, `RateLimiter` | `RegistrationConfirmed`, `RegistrationPending`, `RegistrationWaitlisted`, `PublicCountChanged` |
| `WaitlistService` | Registration | Command | same repositories | `WaitlistPromoted`, `PublicCountChanged` |
| `CheckInService` | Registration | Command | `RegistrationRepository`, `EventAccessService` | `GuestCheckedIn` |
| `TicketQueryService` | Registration | Query | Drizzle read queries, `EventAccessService` | — |
| `GuestListQueryService` | Registration | Query | Drizzle read queries | — |
| `FlyerService` | Media | Command | `FileStorage`, `EventCoverPort` | `FlyerReplaced` |
| `OutsideListingsService` | Discovery | Query | `ExternalEventSource[]`, Redis cache | — |
| `PlacesService` | Discovery | Query | `PlacesClient`, `RateLimiter` | — |
| `EmailComposer` + processors | Notifications | Worker | `Mailer`, `QrCodeRenderer`, `EventSummaryReader`, `UserDirectory` | — |
| `RevalidationProcessor` | Notifications | Worker | `RevalidationClient` | — |

## Event handlers (subscriptions)

| Domain event | Handler | Action |
|---|---|---|
| `SignInCodeIssued` | Notifications `SignInEmailHandler` | Enqueue sign-in email. The plain code is only in the job payload and the job is removed when it completes. |
| `RegistrationConfirmed`, `WaitlistPromoted` | Notifications `TicketEmailHandler` | Enqueue ticket email (jobId per registration and status) |
| `EventCreated`, `EventUpdated`, `EventPublished`, `EventCancelled`, `EventDeleted`, `QuestionsChanged`, `PublicCountChanged`, `FlyerReplaced` | Notifications `RevalidationHandler` | Enqueue revalidation of tags `event:{slug}` and `featured` |
| `EventDeleted` | Media `FlyerCleanupHandler` | Enqueue deletion of the event's Cloudinary folder |
| `FlyerReplaced` | Media `FlyerCleanupHandler` | Enqueue deletion of the old file |

## Key orchestrations

### Register a guest (FR-4)
1. `RegistrationsController` → `RegistrationService.register(eventId, userId, dto)`. Rate limit per user.
2. Inside `@Transactional()`:
   1. `EventInventoryRepository.lockForRegistration(eventId)` takes a row lock on the event, which serializes registrations for that event across all API instances.
   2. `RegistrationRepository.findActiveForUser` → `AlreadyRegistered`.
   3. `QuestionCatalog.getForEvent` → `AnswerSet.fromInput`.
   4. `UserDirectory.getContact(userId)` supplies the ticket email (verified account email only).
   5. `EventInventory.admit(request, now)` returns the decision and updates the stored counters (no counting of rows, P3).
   6. `Registration.fromAdmission(...)` with a new `TicketCode`. Save both aggregates. The partial unique index stays as a final guard.
3. After commit: `RegistrationConfirmed` → ticket email job; `PublicCountChanged` → revalidation job.

### Sign in with Google (FR-1.2, FR-1.3)
1. Next.js (or the app) calls `POST /v1/auth/google/start` → `GoogleSignInService.start` creates the PKCE verifier, `state` and `nonce`, keeps them in Redis for 10 minutes, and returns Google's URL.
2. Google redirects the browser to Next.js `/auth/google/callback` (or to the app's deep link). The client posts `{ code, state }` to `POST /v1/auth/google/callback`.
3. `complete` takes the verifier from Redis once, exchanges the code, validates the ID token (issuer, audience, nonce, expiry), and requires `email_verified`.
4. `AccountLinker` finds the user by Google subject, then by verified email (links), else registers a new user.
5. `SessionService.issue` returns the token pair. Next.js stores it in httpOnly cookies; mobile keeps it in secure storage.

### Refresh (FR-1.4)
`SessionService.refresh` hashes the presented token and loads the session. If the hash is the current one, it rotates and returns a new pair. If it is a previous one, it revokes the whole family (`RefreshTokenReused`).

### Check in (FR-6)
`POST /v1/tickets/{code}/check-in` → `CheckInService.checkInTicket`. It loads the registration by code, then `EventAccessService.requirePermission(eventId, staff, 'guests.checkIn')`, then `Registration.checkIn(staff, now)`, all in one transaction with a conditional update (`checked_in_at is null`) so a second check-in fails even when two staff scan at once.

### Delete event (FR-2.7)
`EventCommandService.delete` → `Event.assertDeletable(confirmTitle, RegistrationStats.hasPaidRegistrations)` → delete rows (cascade) → `EventDeleted` → flyer folder cleanup job and revalidation job.
