# Application Design — G-ventZ API

Consolidated view. Details: [components.md](components.md), [component-methods.md](component-methods.md), [services.md](services.md), [component-dependency.md](component-dependency.md).

## Decisions (application-design-plan.md)

| # | Decision |
|---|---|
| AD1 | Repository `gventz-api` at `/Users/payazaafrica/gventz-api`; GitHub remote added when created |
| AD2 | Clean layers per module: `domain` / `application` / `infrastructure` / `presentation`; domain is framework-free; boundaries enforced by lint |
| AD3 | Rich domain model: aggregates and value objects own the rules |
| AD4 | Modules talk through exported interfaces; side effects through after-commit domain events; durable work on BullMQ (free library, Render Redis) |
| AD5 | Transactions via `@nestjs-cls/transactional` (`@Transactional()`) |
| AD6 | Read side: query services select straight into DTOs; writes go through aggregates |
| AD7 | Domain error classes → RFC 9457 problem details with stable codes |
| AD8 | One build, two roles (API and worker) by `APP_ROLE`; both in one process for M1 |
| AD9 | Versioned REST paths `/v1`, camelCase JSON |
| AD10 | `EventAccessPolicy` + guard + `@RequireEventPermission()`, 404 for no access |

## Modules

| Module | Owns | Key classes |
|---|---|---|
| Platform | config, DB, transactions, Redis, queues, logging, errors, health, OpenAPI, rate limits | `ProblemDetailsFilter`, `DomainEventBus`, `RateLimiter` |
| Identity | users, sign-in, sessions, profile | `User`, `SignInCode`, `Session`, `GoogleSignInService`, `SessionService` |
| Events | events, ticket types (definition), members, permissions | `Event`, `EventAccessPolicy`, `EventCommandService` |
| Engagement | questions, announcement drafts | `QuestionSet`, `QuestionService` |
| Registration | registrations, waiting list, tickets, check-in | `EventInventory`, `Registration`, `RegistrationService` |
| Media | flyers | `FlyerService`, `FileStorage` → Cloudinary |
| Discovery | featured list, outside listings, venue search | `OutsideListingsService`, `PlacesService` |
| Notifications | email, cache revalidation | `EmailComposer`, `Mailer` → Resend, `RevalidationClient` |

## REST resource map (`/v1`)

Auth column: **Public** = no token; **User** = signed in; a permission name = `@RequireEventPermission`.

| Method | Path | Service | Auth | FR |
|---|---|---|---|---|
| POST | `/auth/email/code` | `EmailCodeSignInService.requestCode` | Public | 1.1 |
| POST | `/auth/email/verify` | `EmailCodeSignInService.verifyCode` | Public | 1.1 |
| POST | `/auth/google/start` | `GoogleSignInService.start` | Public | 1.2 |
| POST | `/auth/google/callback` | `GoogleSignInService.complete` | Public | 1.2, 1.3 |
| POST | `/auth/refresh` | `SessionService.refresh` | Public (refresh token) | 1.4 |
| POST | `/auth/sign-out` | `SessionService.signOut` | User | 1.7 |
| GET | `/me` | `ProfileService.getMe` | User | 1 |
| PATCH | `/me` | `ProfileService.updateProfile` (name, country, dashboard theme) | User | 10.4 |
| GET | `/me/events` | `EventQueryService.listHostEvents` | User | 10.1 |
| POST | `/events` | `EventCommandService.create` | User | 2.1 |
| GET | `/events/featured` | `EventQueryService.listFeatured` | Public | 9.1 |
| GET | `/events/by-slug/{slug}` | `EventQueryService.getPublicPage` | Public (viewer optional) | 9.2 |
| GET | `/events/{id}` | `EventQueryService.getDashboard` | `event.viewDashboard` | 10 |
| PATCH | `/events/{id}` | `EventCommandService.updateDetails` | `event.edit` | 2.3 |
| PUT | `/events/{id}/location` | `EventCommandService.changeLocation` | `event.edit` | 2.4, 2.5 |
| PATCH | `/events/{id}/settings` | `EventCommandService.updateSettings` | `event.edit` | 2.3 |
| POST | `/events/{id}/publish` | `EventCommandService.publish` | `event.edit` | 2.3 |
| POST | `/events/{id}/cancel` | `EventCommandService.cancel` | `event.cancel` | 2.6 |
| GET | `/events/{id}/deletion-check` | `EventCommandService.deletionCheck` | `event.delete` | 2.7 |
| DELETE | `/events/{id}` | `EventCommandService.delete` (body `confirmTitle`) | `event.delete` | 2.7 |
| GET | `/events/{id}/questions` | `QuestionService.list` | `event.viewDashboard` | 3 |
| POST | `/events/{id}/questions` | `QuestionService.add` | `questions.manage` | 3 |
| DELETE | `/events/{id}/questions/{questionId}` | `QuestionService.remove` | `questions.manage` | 3 |
| GET | `/events/{id}/announcements` | `AnnouncementService.list` | `event.viewDashboard` | 10.3 |
| POST | `/events/{id}/announcements` | `AnnouncementService.draft` | `announcements.draft` | 10.3 |
| POST | `/events/{id}/flyer/upload-signature` | `FlyerService.createUploadSignature` | `flyer.manage` | 8.1 |
| PUT | `/events/{id}/flyer` | `FlyerService.confirmUpload` | `flyer.manage` | 8.1, 8.2 |
| DELETE | `/events/{id}/flyer` | `FlyerService.remove` | `flyer.manage` | 8.3 |
| POST | `/events/{id}/registrations` | `RegistrationService.register` | User | 4 |
| GET | `/events/{id}/guests` | `GuestListQueryService.list` | `event.viewDashboard` | 10.2 |
| POST | `/events/{id}/guests/{registrationId}/check-in` | `CheckInService.checkInGuest` | `guests.checkIn` | 6.2 |
| POST | `/events/{id}/waitlist/promote` | `WaitlistService.promoteNext` | `waitlist.promote` | 5.1 |
| GET | `/tickets/{code}` | `TicketQueryService.getTicket` | Public (viewer optional) | 6.1 |
| POST | `/tickets/{code}/check-in` | `CheckInService.checkInTicket` | User + `guests.checkIn` (checked in service) | 6.2 |
| GET | `/discover/outside` | `OutsideListingsService.list` | Public | 9.3 |
| GET | `/places/autocomplete` | `PlacesService.autocomplete` | User | 12 |
| GET | `/places/{placeId}` | `PlacesService.details` | User | 12 |
| GET | `/health/live`, `/health/ready` (unversioned) | `HealthModule` | Public | 16.1 |

Next.js side (U7): `POST /api/revalidate` (HMAC) and `/auth/google/callback`.

## M1 slice

Endpoints needed for M1: the six `/auth/*` endpoints, `GET /me`, `POST /events`, `POST /events/{id}/publish`, `GET /events/by-slug/{slug}`, `POST /events/{id}/registrations`, `GET /tickets/{code}`, `POST /tickets/{code}/check-in`, and health. Everything else lands in M2.

## Requirements coverage

| FR | Component(s) |
|---|---|
| FR-1 | Identity |
| FR-2 | Events (+ Registration `RegistrationStats` for delete) |
| FR-3 | Engagement |
| FR-4, FR-5, FR-6 | Registration |
| FR-7 | Notifications |
| FR-8 | Media |
| FR-9 | Discovery + Events read side |
| FR-10 | Events, Registration, Engagement read sides; Identity profile |
| FR-11 | Events `EventAccessPolicy` |
| FR-12 | Discovery `PlacesService` |
| FR-13 | Notifications `RevalidationProcessor` |
| FR-14 | `scripts/migrate-from-supabase` (U6) |
| FR-15 | This repo (U7) |
| FR-16 | Platform `HealthModule`, Drizzle migrations on deploy |

Every FR maps to at least one component. No module imports another module's repository or tables. NFR-1's module list is kept as specified.

## Validation
- Mermaid diagram in component-dependency.md: one `flowchart LR` with quoted labels and a text alternative.
- Text diagrams use plain ASCII inside code blocks.
- PBT extension: no rules apply at Application Design (PBT-01 starts at Functional Design). N/A.
- Security and Resiliency extensions: disabled; skipped.
