# U3 Events and Engagement — Functional Design Plan

U3 covers what an event is, who may manage it, and what hosts ask guests:
- **Events:** create with ticket types, details, venue (fixes C1 and C2), settings, publish, cancel, delete.
- **Access:** event members, roles, and the permission policy and guard used by every module.
- **Reads:** public event page by slug, host's events, featured list, dashboard summary.
- **Engagement:** registration questions (fix C3) and announcement drafts.

Today's behaviour (BT2–BT4, BT10–BT12) is the baseline. It comes from `src/app/events/actions.ts`, `src/app/dashboard/[id]/actions.ts`, `src/app/dashboard/actions.ts` and the Supabase functions and triggers.

Please fill in each `[Answer]:` tag with a letter, or X plus your own text, then tell me "done".

## Plan

- [x] 1. Collect and analyze answers below
- [x] 2. `domain-entities.md`
  - `Event` (with `TicketType`), `EventMember`, `QuestionSet` and `Question`, `Announcement`
  - Value objects: `EventTitle`, `Slug`, `Category`, `EventSchedule`, `Location` (`Venue` / `Online`), `Capacity`, `CoverTheme`, `Visibility`, `EventStatus`, `EventRole`, `QuestionKind`, `AudienceSegment`
  - Domain events
  - No new tables expected; any index additions listed
- [x] 3. `business-rules.md`
  - Create-event validation (today's rules, kept), slug generation, time zone handling
  - Detail and venue edits (C1, C2), settings, publish and cancel, the delete check
  - The permission matrix, corrected against today's database triggers
  - Questions (limits, options, terms always required, C3 concurrency)
  - Announcement drafts
  - Public page visibility rules, attendee-count rule, read models
  - Error codes
- [x] 4. `business-logic-model.md`: flows per endpoint, including the M1 slice (create, publish, public page) and pass 2; the access check per request; the event-row lock for question changes
- [x] 5. Testable Properties (PBT-01)
- [x] 6. Validate against FR-2, FR-3, FR-9.1–9.2, FR-10, FR-11 and the application design

## Questions

### Question 1 — How event times are sent to the API
Today the form sends a local date and time ("2026-12-05", "18:00"), and the server turns them into an instant in the event's time zone (Africa/Lagos by default).

A) The API takes local date-time plus time zone, for example `{ "startsAt": "2026-12-05T18:00", "endsAt": "2026-12-05T23:00", "timeZone": "Africa/Lagos" }`, and converts using the zone's rules, including daylight saving. Responses return both the UTC instant and the local wall-clock time. Every client sends the same thing hosts type, and the conversion lives in one place. (Recommended)

B) The API takes UTC instants only (`2026-12-05T17:00:00Z`) and the frontend converts

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — Editing dates and ticket types after creation
Today, once an event is created, the host can edit title, description, venue, refund policy, visibility, theme, capacity and the registration switch. **Dates and ticket types cannot be changed.**

A) Keep parity now: dates and ticket types stay fixed after creation, and editing them comes later as its own change. (Recommended for the timeline, D25)

B) Add date editing now (start, end, time zone), keeping ticket types fixed

C) Add both date and ticket-type editing now

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — Who may publish an event
The application design gave publishing to owner, admin **and editor**. Today's database trigger (`events_guard`) allows only the **owner or an admin** to change an event's status (publish or cancel). The dashboard's quick "Publish" toggle refuses editors.

A) Match today: publish and cancel are owner and admin only, with a separate `event.publish` permission. Editors edit everything else. (Recommended, parity)

B) Let editors publish too; cancelling stays owner and admin only

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4 — What guests see for a cancelled event
Today a cancelled event disappears from its public page (404) for everyone except staff. Ticket links (`/t/{code}`) still work.

A) Keep parity: cancelled events return 404 on the public page for guests; staff still see them; tickets still load. (Recommended for parity; the frontend design upgrade can revisit)

B) Return the event to guests with `status: "cancelled"`, so the page can show "This event was cancelled". Registration is closed either way.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5 — Countries and regions list
Venue validation needs today's country list and first-level regions (Nigeria's 36 states plus FCT, US states, and so on). It's currently in the frontend (`src/lib/locations.ts`).

A) Copy the list into the API as a reference data class, used for validation, and serve it at `GET /v1/reference/locations`, so the frontend and the mobile app can use the same source from U7 on. (Recommended)

B) Copy it into the API for validation only. The frontend keeps its own copy.

X) Other (please describe after [Answer]: tag below)

[Answer]: X - THIS SOLUTION SHOULD NOT BE LIMITED TO NIGERIA, IT'S A WORLDWIDE SOLUTION

## Follow-up (your answer to Question 5: "worldwide, not limited to Nigeria")

Today's app already accepts any country code, but:
- the dropdown lists only 30 countries
- region lists exist for about 20 of them; elsewhere the region is typed in by hand
- every event's time zone defaults to Africa/Lagos
- every ticket type's currency defaults to NGN

Making it worldwide raises these choices.

### Follow-up 5.1 — Countries and regions
A) Every country in ISO 3166-1 (about 250) can be chosen. Regions are validated against ISO 3166-2 subdivisions for every country that has them, from a maintained open dataset bundled with the API. Regions are free text only where a country has no subdivisions. The API serves this at `GET /v1/reference/locations` so web and mobile share one source. (Recommended)

B) Every country can be chosen, with region lists only for today's ~20 countries, typed elsewhere

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Follow-up 5.2 — Default time zone for a new event
A) Derived from the venue:
- **Google Places venue:** the time zone at its coordinates.
- **Typed venue in a single-zone country:** that country's zone.
- **Multi-zone country** (US, Canada, Brazil, Australia and others): the host must pick from that country's zones.
- **Online events:** the host's chosen zone.

The API always stores and validates an IANA zone. Africa/Lagos stops being a global default. (Recommended)

B) The host always picks the time zone, and the form pre-selects the browser's zone

C) Keep Africa/Lagos as the default unless the host changes it

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Follow-up 5.3 — Default currency for ticket types
Tickets are free until payments exist (D25), but each ticket type stores a currency.

A) Default to the venue country's currency (for example GH → GHS, GB → GBP, US → USD). The host can change it. Any ISO 4217 code is accepted. For online events, the host's choice, or USD if none. (Recommended)

B) Keep NGN as the default everywhere until payments are designed

X) Other (please describe after [Answer]: tag below)

[Answer]: A
