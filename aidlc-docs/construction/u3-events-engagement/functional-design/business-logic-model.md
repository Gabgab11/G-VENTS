# U3 Events and Engagement — Business Logic Model

Code generation is split into two passes (unit-of-work Q2 A):
- **Pass 1 (M1):** create, publish, public page, plus the permission guard.
- **Pass 2 (M2):** everything else.

## 1. Access check (every event-scoped route) — `EventPermissionGuard`
```text
@RequireEventPermission('event.edit') on handler
eventId = ParseUuidOr404(params.id)          not a UUID -> 404 event.not_found
principal = request context (AccessTokenGuard)  none -> 401 (route not public)
role = EventAccessService.roleOf(eventId, userId)
        one query: events.owner_id + strongest accepted event_members row
        cached in CLS for the request
role null            -> 404 event.not_found
!policy.can(role, p) -> 403 event.forbidden
```

## 2. Create — `EventCommandService.create(ownerId, dto)` (pass 1)
```text
schedule = EventSchedule.fromLocal(startsAt, endsAt?, zone)   zone = dto.timeZone ?? derive(location)
location = LocationFactory.from(dto.location, catalog)        C2 validation
ticketTypes = dto.ticketTypes (drop empty names) -> TicketType.create(..., currency default from location)
event = Event.create({...}, ownerId, slug = Slug.generate(title, random), now)
[tx] repo.insert(event) -> unique slug conflict -> regenerate (max 3)
record events.event_created
return { id, slug, status }
```

## 3. Publish / cancel / edit (publish in pass 1; the rest in pass 2)
```text
[tx] event = repo.findForUpdate(id)
     event.publish(now) | event.cancel(now) | event.updateDetails(...) | event.changeLocation(loc) | event.updateSettings(...)
     repo.save(event)   (collects events)
     cancel -> audit event.cancelled
```

## 4. Delete (pass 2)
```text
[tx] event = repo.findForUpdate(id)
     stats = RegistrationStats.forEvent(id)       guestCount, paidCount
     event.assertDeletable(confirmTitle, stats.paidCount > 0)
     audit event.deleted {eventId, title, guestCount}   (written before the delete; event_id set null by FK)
     repo.delete(id)                               cascades
     record events.event_deleted {coverPublicIds}
```

## 5. Public page — `EventQueryService.getPublicPage(slug, viewer?)` (pass 1)
```text
row = events by slug (+ owner id)                       none -> 404
role = viewer ? roleOf(row.id, viewer) : null
if row.status != published and role == null -> 404 (VR1)
ticketTypes = active, order by price_minor, created_at; remaining = quantity - sold
questions  = order by position
attendeeCount = (row.showAttendeeCount or role) ? confirmed count : null
return EventPageDto (instants + local times)
```
Three indexed queries: event by slug, ticket types and questions batched, and the count. There's no N+1.

## 6. Questions (pass 2)
```text
add(eventId, dto):
  [tx] set = QuestionSetRepository.loadForUpdate(eventId)    SELECT events FOR UPDATE; then questions
       q = set.add(NewQuestion.from(dto))                     limit 30, position = max+1
       repo.save(set)  -> engagement.questions_changed
remove(eventId, questionId): same lock; set.remove(id); save
```

## 7. Reference data (pass 2; country and subdivision checks are already used by pass 1 create)
```text
CountryCatalog / SubdivisionCatalog: loaded once at startup from bundled data, kept in memory
TimeZoneLocator.zoneAt(lat, lng): offline lookup (geo-tz style), lazy-loaded
```

## 8. Testable Properties (PBT-01)

| Component | Property | Category |
|---|---|---|
| `EventSchedule` | For any zone and any local time that exists in it, `toLocal(fromLocal(t, zone), zone) = t` | Round-trip |
| `EventSchedule` | For any valid input, `endsAt > startsAt` whenever `endsAt` is set; construction with end ≤ start always fails | Invariant |
| `EventSchedule` | Converting with the zone's offset at the resulting instant gives back the same wall-clock time, checked against a reference `Intl.DateTimeFormat` formatting | Oracle |
| `Slug` | For any Unicode title, the slug matches `^[a-z0-9-]+$`, is ≤ 66 characters and ends in `-` + 5 base-36 characters | Invariant |
| `Location` (C1) | For any sequence of location changes, the final stored location equals the last one sent; a typed venue never keeps a place id or coordinates | Invariant, Idempotence |
| `Region` matching | `canonical(canonical(x)) = canonical(x)`; any casing or accent variant of a subdivision name or code resolves to the same canonical name | Idempotence |
| `Capacity` / `TicketType` quantity | Accepted iff an integer in 1..1,000,000 (or null) | Invariant |
| `EventAccessPolicy` | `can(role, permission)` equals the §6 table for every pair; owner can do everything | Oracle |
| Role resolution | For any set of member rows, the resolved role is the strongest accepted one (or owner) | Oracle |
| Public visibility | For every (status, role-or-none), visible iff published or role ≠ null (VR1) | Oracle |
| `QuestionSet` | For any sequence of add and remove: count ≤ 30; positions unique and strictly increasing; `terms` always required; an add past 30 always fails | Stateful (PBT-06) |
| Option normalization | `normalize(normalize(x)) = normalize(x)`; result has no duplicates, every entry is 1–100 characters, at most 30 | Idempotence, Invariant |
| Delete confirmation | `sameTitle(t, v)` is true for any variant of `t` differing only in letter case and surrounding whitespace, and false for any other title | Invariant |
| `CountryCatalog` | Every country's currency is a valid ISO 4217 code, and every listed zone is a valid IANA zone | Invariant |

No PBT properties identified for:
- **Controllers:** covered by end-to-end tests.
- **Drizzle repositories:** covered by integration tests.
- **Announcement drafts:** simple field limits, covered by example tests.
