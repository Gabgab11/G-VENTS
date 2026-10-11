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

const TIMEOUT_MS = 4000;
const REVALIDATE_S = 3600;

async function getJSON(url: string, headers?: Record<string, string>): Promise<unknown> {
  try {
    const res = await fetch(url, {
      headers,
      next: { revalidate: REVALIDATE_S },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// Ticketmaster Discovery API (free key: developer.ticketmaster.com)
async function ticketmaster(): Promise<ExternalEvent[]> {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return [];
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const countries = ["NG", "ZA", "KE", "GH", "EG"];

  const responses = await Promise.all(
    countries.map((cc) =>
      getJSON(
        `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${key}&countryCode=${cc}&size=5&sort=date,asc&startDateTime=${encodeURIComponent(now)}`
      )
    )
  );

  type TM = {
    id: string; name: string; url: string;
    dates?: { start?: { dateTime?: string; localDate?: string; localTime?: string } };
    _embedded?: { venues?: { city?: { name?: string } }[] };
  };

  return responses.flatMap((r) => {
    const events = ((r as { _embedded?: { events?: TM[] } } | null)?._embedded?.events) ?? [];
    return events.map((e) => ({
      id: `tm-${e.id}`,
      title: e.name,
      startsAt: e.dates?.start?.dateTime ?? `${e.dates?.start?.localDate ?? ""}T${e.dates?.start?.localTime ?? "00:00:00"}`,
      place: e._embedded?.venues?.[0]?.city?.name ?? "",
      source: "Ticketmaster",
      url: e.url,
    }));
  });
}

// PredictHQ events intelligence (free key: predicthq.com)
async function predicthq(): Promise<ExternalEvent[]> {
  const key = process.env.PREDICTHQ_API_KEY;
  if (!key) return [];
  const today = new Date().toISOString().slice(0, 10);
  const data = await getJSON(
    `https://api.predicthq.com/v1/events/?country=NG,KE,ZA,GH,EG&category=conferences,festivals,expos,community,concerts&active.gte=${today}&sort=start&limit=10`,
    { Authorization: `Bearer ${key}`, Accept: "application/json" }
  );

  type PHQ = { id: string; title: string; start: string; locality?: string; country?: string };
  const results = ((data as { results?: PHQ[] } | null)?.results) ?? [];
  return results.map((e) => ({
    id: `phq-${e.id}`,
    title: e.title,
    startsAt: e.start,
    place: [e.locality, e.country].filter(Boolean).join(", "),
    source: "PredictHQ",
    // PredictHQ does not return ticket links, so this opens a search for the event.
    url: `https://www.google.com/search?q=${encodeURIComponent(e.title)}`,
  }));
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

async function calendars(): Promise<ExternalEvent[]> {
  const urls = (process.env.ICAL_FEED_URLS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const feeds = await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, { next: { revalidate: REVALIDATE_S }, signal: AbortSignal.timeout(TIMEOUT_MS) });
        return res.ok ? { url, text: unfold(await res.text()) } : null;
      } catch {
        return null;
      }
    })
  );

  const out: ExternalEvent[] = [];
  for (const feed of feeds) {
    if (!feed) continue;
    const source = new URL(feed.url).hostname.replace(/^www\./, "");
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
    }
  }
  return out;
}

// Everything combined, upcoming only, soonest first.
export async function getElsewhereEvents(limit = 9): Promise<ExternalEvent[]> {
  const all = (await Promise.all([ticketmaster(), predicthq(), calendars()])).flat();
  const now = Date.now();
  return all
    .filter((e) => !Number.isNaN(new Date(e.startsAt).getTime()) && new Date(e.startsAt).getTime() > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, limit);
}
