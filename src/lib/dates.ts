// One place for event date handling. Events store a time zone; Lagos is only the default.

export const DEFAULT_TIMEZONE = "Africa/Lagos";

const STYLES = {
  // "Sat 7 Nov, 18:00"
  short: { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" },
  // "7 Nov, 18:00"
  compact: { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" },
  // "Saturday 7 November 2026 at 18:00"
  long: { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export function formatEventDate(
  iso: string,
  timeZone: string | null | undefined = DEFAULT_TIMEZONE,
  style: keyof typeof STYLES = "short",
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const tz = timeZone || DEFAULT_TIMEZONE;
  try {
    return date.toLocaleString("en-GB", { ...STYLES[style], timeZone: tz });
  } catch {
    // Unknown zone name in the data: show Lagos time rather than crash the page.
    return date.toLocaleString("en-GB", { ...STYLES[style], timeZone: DEFAULT_TIMEZONE });
  }
}

// Short label for the zone, e.g. "Lagos" for Africa/Lagos.
export function timezoneLabel(timeZone: string | null | undefined): string {
  const tz = timeZone || DEFAULT_TIMEZONE;
  return tz.split("/").pop()!.replace(/_/g, " ");
}

// The UTC offset of a zone at a given instant, in minutes (Lagos: +60).
function offsetMinutes(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

// Turns a wall-clock date ("2026-11-07") and time ("18:00") in a zone into a UTC Date.
// Returns null for invalid input. Handles zones with daylight saving.
export function zonedTimeToUtc(date: string, time: string, timeZone: string = DEFAULT_TIMEZONE): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m || !t) return null;
  const [y, mo, d, h, mi] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(t[1]), Number(t[2])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;

  const naiveUtc = Date.UTC(y, mo - 1, d, h, mi);
  let result: Date;
  try {
    // Two passes settle the offset when the first guess lands on the other side of a DST change.
    const first = naiveUtc - offsetMinutes(timeZone, new Date(naiveUtc)) * 60000;
    result = new Date(naiveUtc - offsetMinutes(timeZone, new Date(first)) * 60000);
  } catch {
    return null;
  }
  // Reject dates that roll over, like 31 February.
  const check = new Date(naiveUtc);
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return result;
}

export type EventDateParts = {
  /** "FEB" and "20" for the calendar tile. */
  month: string;
  day: string;
  /** "Saturday, 20 February 2027" */
  dateLine: string;
  /** "18:00 – 23:00 · Lagos time", or "20 Feb 18:00 – 21 Feb 02:00 · Lagos time" across days. */
  timeLine: string;
};

// The date block on the event page, in the event's own time zone.
export function eventDateParts(startsAt: string, endsAt: string | null, timeZone: string | null | undefined): EventDateParts {
  let tz = timeZone || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
  } catch {
    tz = DEFAULT_TIMEZONE;
  }
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : null;
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...o, timeZone: tz }).format(d);
  const clock = (d: Date) => fmt(d, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const dayKey = (d: Date) => fmt(d, { year: "numeric", month: "2-digit", day: "2-digit" });
  const short = (d: Date) => fmt(d, { day: "numeric", month: "short" });
  const zone = `${timezoneLabel(tz)} time`;

  let range = clock(start);
  if (end && !Number.isNaN(end.getTime())) {
    range = dayKey(end) === dayKey(start) ? `${clock(start)} – ${clock(end)}` : `${short(start)} ${clock(start)} – ${short(end)} ${clock(end)}`;
  }
  return {
    month: fmt(start, { month: "short" }).toUpperCase(),
    day: fmt(start, { day: "numeric" }),
    dateLine: fmt(start, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).replace(/^(\w+) /, "$1, "),
    timeLine: `${range} · ${zone}`,
  };
}
