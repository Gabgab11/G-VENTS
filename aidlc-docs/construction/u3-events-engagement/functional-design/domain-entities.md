# U3 Events and Engagement — Domain Entities

Answers used (u3-events-engagement-functional-design-plan.md):
- **Q1 A:** times are sent as local date-time plus time zone.
- **Q2 A:** dates and ticket types are fixed after creation.
- **Q3 A:** publish and cancel are owner and admin only.
- **Q4 A:** a cancelled event returns 404 to guests.
- **Q5:** worldwide, refined by follow-ups 5.1 A (all ISO 3166-1 countries, with ISO 3166-2 regions from a bundled dataset), 5.2 A (default time zone from the venue) and 5.3 A (default currency from the venue country).

Modules: `src/modules/events/` (events, ticket types, members, access) and `src/modules/engagement/` (questions, announcements). Reference data (countries, regions, zones, currencies) is in `src/modules/events/domain/reference/`.

## Events module

### `Event` (aggregate)
| Field | Type | Notes |
|---|---|---|
| id | uuid | v7 for new events |
| ownerId | `UserId` | Never changes |
| title | `EventTitle` | 3–140 characters, trimmed |
| slug | `Slug` | Never changes after creation |
| description | string \| null | ≤ 5,000 |
| category | `Category` | One of the 14 |
| schedule | `EventSchedule` | Fixed after creation (Q2 A) |
| location | `Location` | `Venue` or `Online` |
| coverTheme | `CoverTheme` | One of the 10 themes |
| cover | `{ url, publicId \| null } \| null` | Set by Media (U5) |
| capacity | `Capacity` | 1–1,000,000, or unlimited |
| refundPolicy | string \| null | ≤ 2,000 |
| status | `EventStatus` | `draft` \| `published` \| `cancelled` |
| visibility | `Visibility` | `public` \| `private` |
| showAttendeeCount, requireApproval, registrationOpen, notifyRegistration | boolean | — |
| ticketTypes | `TicketType[]` | 1–20, fixed after creation |
| createdAt, updatedAt | Date | — |

`activeCount` and `ticket_tiers.sold` belong to Registration (U4). `Event` never writes them.

Behaviour:
- `create(...)`
- `updateDetails(...)`
- `changeLocation(location)`, which replaces every venue field together (C1)
- `updateSettings(...)`
- `publish(now)`, `cancel(now)`
- `setCover(...)`, `clearCover()`
- `assertDeletable(confirmTitle, hasPaidRegistrations)`

### `TicketType` (entity inside `Event`)
| Field | Rules |
|---|---|
| id | uuid |
| name | 1–80 characters, trimmed |
| price | `Money`. Must be 0 until payments exist (`event.paid_tickets_unsupported`). |
| currency | ISO 4217. Defaults to the venue country's currency, or USD for online events (5.3 A). |
| quantity | 1–1,000,000, or null = unlimited |
| salesStart, salesEnd | Date \| null. If both are set, end > start. |
| isActive | boolean, default true |

### `EventMember` (entity, read by access checks)
Fields: eventId, userId, invitedEmail, role (`EventRole`), invitedAt, acceptedAt. Only accepted members (with `acceptedAt`) hold a role. There's no endpoint that creates members yet (parity).

### Value objects
| Value object | Rules |
|---|---|
| `EventTitle` | Trimmed, 3–140 characters |
| `Slug` | `^[a-z0-9-]+$`, ≤ 66 characters. Generated as base (title folded to ASCII, lowercased, non-alphanumerics → `-`, trimmed, ≤ 60) + `-` + 5 random base-36 characters. An empty base (for example a title only in a non-Latin script) becomes `event`. |
| `Category` | Music, Conferences, Tech, Faith, Arts, Food, Sports, Business, Nightlife, Education, Community, Charity, Family, Other |
| `EventSchedule` | `{ startsAt: Instant, endsAt: Instant \| null, timeZone: IanaTimeZone }`, built from local `YYYY-MM-DDTHH:mm` values in the zone. `endsAt > startsAt`. Exposes `startsAtLocal` and `endsAtLocal`. |
| `Location` | `Venue { venueName, countryCode, countryName, region, city, address, place? }` or `Online {}` |
| `Place` (inside `Venue`) | `{ placeId: ^[A-Za-z0-9_-]{10,300}$, lat: −90..90, lng: −180..180 }`. Present only for Google Places venues, and then all three are present. |
| `CountryCode` | ISO 3166-1 alpha-2, from the bundled dataset (about 250) |
| `Region` | For a country with ISO 3166-2 subdivisions: one of them, matched by name or code (case- and accent-insensitive) and stored as the canonical name. Otherwise free text ≤ 120. Optional. |
| `Capacity` | null (unlimited) or an integer 1–1,000,000 |
| `CoverTheme` | The 10 themes (shared list with the dashboard theme) |
| `EventStatus`, `Visibility` | As in the table above |
| `EventRole` | `owner` (from `events.owner_id`), `admin`, `editor`, `checkin`, `finance`, `viewer` |
| `EventPermission` | See business-rules §6 |

### Reference data (`domain/reference/`, 5.1 A, 5.2 A, 5.3 A)
| Class | Content | Source (chosen in code generation) |
|---|---|---|
| `CountryCatalog` | Code, English name, currency (ISO 4217), IANA zones, subdivision label | Bundled open datasets: ISO 3166-1 list; country → currency; country → time zones |
| `SubdivisionCatalog` | Per country: ISO 3166-2 code and name of first-level subdivisions | Bundled ISO 3166-2 dataset |
| `TimeZoneLocator` (port) | `zoneAt(lat, lng): IanaTimeZone \| null` | Offline boundary lookup (for example `geo-tz`), behind a port |

The data ships inside the build, with no network calls. Updating it means updating a dependency.

### Domain events (Events)
| Event | Payload | Used by |
|---|---|---|
| `events.event_created` | eventId, slug, status | U5 revalidation |
| `events.event_published` | eventId, slug | U5 revalidation |
| `events.event_updated` | eventId, slug, fields changed | U5 revalidation |
| `events.event_cancelled` | eventId, slug | U5 revalidation; U4 later (notify guests is out of scope) |
| `events.event_deleted` | eventId, slug, coverPublicIds | U5 flyer cleanup and revalidation |

## Engagement module

### `QuestionSet` (aggregate per event, key = eventId)
Loaded with the event row locked (`FOR UPDATE` on `events`), so concurrent changes are serialized (C3).

| Field | Rules |
|---|---|
| eventId | — |
| questions | `Question[]`, ordered by position, at most 30 |

Behaviour:
- `add(newQuestion)` uses the next position, max(position) + 1.
- `remove(questionId)` throws `question.not_found` if the question isn't on this event.

### `Question` (entity)
| Field | Rules |
|---|---|
| id | uuid |
| label | 1–200 characters, trimmed |
| kind | `QuestionKind`: text, options, social, company, terms, phone, website |
| options | `options` kind only: 2–30 distinct values, each trimmed and ≤ 100 characters. Other kinds: empty. |
| required | `terms` questions are always required |
| position | Integer, strictly increasing within the set |

### `Announcement` (aggregate)
Fields: id, eventId, createdBy, subject (1–200), body (1–10,000), segment (`AudienceSegment`: all, paid, checked_in, not_checked_in, waitlist), status (`draft` only from the API), createdAt. Sending stays out of scope (D25).

### Domain events (Engagement)
`engagement.questions_changed` (eventId) is used by U5 revalidation.

## Tables
No new tables:
- **Events** writes `events` (definition columns), `ticket_tiers` (definition columns) and `event_members`.
- **Engagement** writes `event_questions` and `email_campaigns`.

Index added by the U3 migration:
- `event_members (user_id) where accepted_at is not null`, for "events I can manage" and the access check
- `events (status, visibility, starts_at)` for the featured list; this replaces the use of `events_status_starts_idx`, which stays
- `event_questions (event_id, position)` stays as is; a unique index on `(event_id, position)` is added as a last guard for C3
