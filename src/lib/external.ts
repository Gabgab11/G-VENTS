// Listings from other platforms. Each source is optional: a source with no key or feed URL is skipped.
// Results are cached for an hour, and each request gives up after 4 seconds, so pages stay fast.

export type ExternalEvent = {
  id: string;
  title: string;
  startsAt: string;   // ISO date-time
  place: string;
  source: string;
  url: string;
};

export type SourceReport = {
  name: string;
  configured: boolean;   // key or feed URL is set
  count: number;         // events returned
  error?: string;        // what went wrong, if anything
};

const TIMEOUT_MS = 4000;
const REVALIDATE_S = 3600;

type Fetched = { data: unknown; error?: string };

async function getJSON(url: string, headers?: Record<string, string>): Promise<Fetched> {
  try {
    const res = await fetch(url, {
      headers,
      next: { revalidate: REVALIDATE_S },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { data: null, error: `Provider replied HTTP ${res.status}` };
    return { data: await res.json() };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Request failed" };
  }
}

// Ticketmaster Discovery API (free key: developer.ticketmaster.com). No country filter, so results are worldwide.
async function ticketmaster(): Promise<{ events: ExternalEvent[]; report: SourceReport }> {
  const name = "Ticketmaster";
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return { events: [], report: { name, configured: false, count: 0 } };

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const { data, error } = await getJSON(
    `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${key}&size=30&sort=date,asc&startDateTime=${encodeURIComponent(now)}`
  );

  type TM = {
    id: string; name: string; url: string;
    dates?: { start?: { dateTime?: string; localDate?: string; localTime?: string } };
    _embedded?: { venues?: { city?: { name?: string }; country?: { name?: string } }[] };
  };

  const list = ((data as { _embedded?: { events?: TM[] } } | null)?._embedded?.events) ?? [];
  const events = list.map((e) => {
    const venue = e._embedded?.venues?.[0];
    return {
      id: `tm-${e.id}`,
      title: e.name,
      startsAt: e.dates?.start?.dateTime ?? `${e.dates?.start?.localDate ?? ""}T${e.dates?.start?.localTime ?? "00:00:00"}`,
      place: [venue?.city?.name, venue?.country?.name].filter(Boolean).join(", "),
      source: "Ticketmaster",
      url: e.url,
    };
  });
  return { events, report: { name, configured: true, count: events.length, error: error ?? (events.length === 0 ? "No events returned" : undefined) } };
}

// PredictHQ events intelligence (free key: predicthq.com). Worldwide, filtered by category.
async function predicthq(): Promise<{ events: ExternalEvent[]; report: SourceReport }> {
  const name = "PredictHQ";
  const key = process.env.PREDICTHQ_API_KEY;
  if (!key) return { events: [], report: { name, configured: false, count: 0 } };

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await getJSON(
    `https://api.predicthq.com/v1/events/?category=conferences,festivals,expos,community,concerts&active.gte=${today}&sort=start&limit=30`,
    { Authorization: `Bearer ${key}`, Accept: "application/json" }
  );

  type PHQ = { id: string; title: string; start: string; locality?: string; country?: string };
  const list = ((data as { results?: PHQ[] } | null)?.results) ?? [];
  const events = list.map((e) => ({
    id: `phq-${e.id}`,
    title: e.title,
    startsAt: e.start,
    place: [e.locality, e.country].filter(Boolean).join(", "),
    source: "PredictHQ",
    // PredictHQ does not return ticket links, so this opens a search for the event.
    url: `https://www.google.com/search?q=${encodeURIComponent(e.title)}`,
  }));
  return { events, report: { name, configured: true, count: events.length, error: error ?? (events.length === 0 ? "No events returned" : undefined) } };
}

// Public calendar feeds (iCal / .ics). Add comma-separated URLs in ICAL_FEED_URLS.
function unfold(text: string) {
  return text.replace(/\r?\n[ \t]/g, "");
}

function icsDate(value: string): string | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if (!m) return null;
  const [, y, mo, d, hh = "00", mi = "00", ss = "00", z] = m;
  // Times without Z are treated as Lagos time (UTC+1).
  return `${y}-${mo}-${d}T${hh}:${mi}:${ss}${z ? "Z" : "+01:00"}`;
}

function unescapeIcs(v: string) {
  return v.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}

async function calendars(): Promise<{ events: ExternalEvent[]; report: SourceReport[] }> {
  const urls = (process.env.ICAL_FEED_URLS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (urls.length === 0) return { events: [], report: [{ name: "Calendar feeds", configured: false, count: 0 }] };

  const feeds = await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, { next: { revalidate: REVALIDATE_S }, signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) return { url, text: null, error: `HTTP ${res.status}` };
        return { url, text: unfold(await res.text()), error: undefined };
      } catch (e) {
        return { url, text: null, error: e instanceof Error ? e.message : "Request failed" };
      }
    })
  );

  const out: ExternalEvent[] = [];
  const reports: SourceReport[] = [];
  for (const feed of feeds) {
    const source = new URL(feed.url).hostname.replace(/^www\./, "");
    if (!feed.text) {
      reports.push({ name: source, configured: true, count: 0, error: feed.error });
      continue;
    }
    let count = 0;
    const blocks = feed.text.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
    for (const block of blocks) {
      const props: Record<string, string> = {};
      for (const line of block.split(/\r?\n/)) {
        const idx = line.indexOf(":");
        if (idx < 0) continue;
        const name = line.slice(0, idx).split(";")[0].toUpperCase();
        props[name] = line.slice(idx + 1);
      }
      const startsAt = icsDate(props.DTSTART ?? "");
      if (!startsAt || !props.SUMMARY) continue;
      out.push({
        id: `ics-${props.UID ?? startsAt + props.SUMMARY}`,
        title: unescapeIcs(props.SUMMARY),
        startsAt,
        place: unescapeIcs(props.LOCATION ?? ""),
        source,
        url: props.URL?.trim() || feed.url,
      });
      count++;
    }
    reports.push({ name: source, configured: true, count, error: count === 0 ? "No upcoming events in this feed" : undefined });
  }
  return { events: out, report: reports };
}

// Everything combined, upcoming only, soonest first, plus a status report for each source.
export async function getElsewhereReport(limit = 12) {
  const [tm, phq, cal] = await Promise.all([ticketmaster(), predicthq(), calendars()]);
  const now = Date.now();
  const events = [...tm.events, ...phq.events, ...cal.events]
    .filter((e) => !Number.isNaN(new Date(e.startsAt).getTime()) && new Date(e.startsAt).getTime() > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, limit);
  return { events, sources: [tm.report, phq.report, ...cal.report] };
}

export async function getElsewhereEvents(limit = 12): Promise<ExternalEvent[]> {
  return (await getElsewhereReport(limit)).events;
}
