// What the event page and the booking page both show about an event: the date in the page's language
// and the event's time zone, and the place. Pure (the translator is passed in).
import type { Locale } from "@/i18n/languages";
import { localizedPath } from "@/i18n/routing";
import { eventDateParts, timezoneLabel } from "@/lib/dates";
import { intlLocale, safeZone } from "@/lib/format";
import type { EventPage } from "@/lib/event-page";
import { directionsUrl } from "@/components/VenueMap";

/** The calendar tile and date line in the page's language; English keeps eventDateParts' exact output. */
export function dateParts(startsAt: string, endsAt: string | null, timeZone: string | null | undefined, lang: Locale) {
  const en = eventDateParts(startsAt, endsAt, timeZone);
  if (lang === "en") return { month: en.month, day: en.day, dateLine: en.dateLine };
  const tz = safeZone(timeZone);
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intlLocale(lang, "date"), { ...o, timeZone: tz }).format(new Date(startsAt));
  return {
    month: fmt({ month: "short" }).toUpperCase(),
    day: fmt({ day: "numeric" }),
    dateLine: fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  };
}

type Translate = (key: "page.timeLine" | "page.place.venue" | "page.place.online" | "page.place.onlineLine", values?: Record<string, string>) => string;

/** The date tile, date line and "19:00 – 22:00 · Lagos time" line. */
export function eventDate(event: Pick<EventPage, "startsAt" | "endsAt" | "timeZone">, lang: Locale, range: string, t: Translate) {
  return {
    ...dateParts(event.startsAt, event.endsAt, event.timeZone, lang),
    timeLine: t("page.timeLine", { range, zone: timezoneLabel(safeZone(event.timeZone)) }),
  };
}

/** The place's title and second line, and Google Maps directions when it is a venue. */
export function eventPlace(location: EventPage["location"], t: Translate) {
  const venue = location.kind === "venue";
  return {
    venue,
    title: venue ? location.venueName || location.address || location.city || t("page.place.venue") : t("page.place.online"),
    line: venue ? [location.venueName ? location.address : null, location.city, location.country].filter(Boolean).join(", ") : t("page.place.onlineLine"),
    directions: directionsUrl(location),
  };
}

/** The event page and its booking page, in the page's language. */
export const eventPath = (slug: string, lang: Locale) => localizedPath(`/e/${slug}`, lang);
export const bookingPath = (slug: string, lang: Locale) => `${eventPath(slug, lang)}/tickets`;
