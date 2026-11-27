// The answer of gventz-api's public GET /v1/search (FR-34), as the website's /api/search returns it.
// Written against the agreed field names; switch to the generated schema types once
// `npm run api:types` includes the endpoint.

export type SearchEvent = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  timeZone: string;
  city: string | null;
  isOnline: boolean;
  coverUrl: string | null;
  coverTheme: string | null;
  /** Lowest ticket price on sale, integer minor units; null when free. */
  minPriceMinor: number | null;
  currency: string | null;
  hostVerified: boolean;
};

export type SearchHost = {
  id: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
  verified: boolean;
  followerCount: number;
};

export type SearchResults = {
  events: SearchEvent[];
  hosts: SearchHost[];
  categories: { key: string; count: number }[];
  cities: { city: string; country: string | null; count: number }[];
};

export const NO_RESULTS: SearchResults = { events: [], hosts: [], categories: [], cities: [] };

/** Shortest and longest text worth sending to the API. */
export const MIN_QUERY = 2;
export const MAX_QUERY = 80; // the API accepts 1 to 80 characters

/** Trims, collapses spaces and caps the length; "" when too short to search. */
export function cleanQuery(raw: string | null | undefined): string {
  const chars = Array.from((raw ?? "").replace(/\s+/g, " ").trim()).slice(0, MAX_QUERY);
  return chars.length >= MIN_QUERY ? chars.join("").trim() : "";
}

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Keeps only well-formed rows from an untrusted answer, so a changed or partial API answer
 * never breaks the palette (a row missing its id, slug or handle is dropped).
 */
export function normalizeResults(body: unknown): SearchResults {
  const b = (body ?? {}) as Record<string, unknown>;
  const events = arr(b.events).flatMap((raw): SearchEvent[] => {
    const e = (raw ?? {}) as Record<string, unknown>;
    const id = str(e.id), slug = str(e.slug), title = str(e.title), startsAt = str(e.startsAt);
    if (!id || !slug || !title || !startsAt) return [];
    return [{
      id, slug, title, startsAt,
      timeZone: str(e.timeZone) ?? "Africa/Lagos",
      city: str(e.city),
      isOnline: e.isOnline === true,
      coverUrl: str(e.coverUrl),
      coverTheme: str(e.coverTheme),
      minPriceMinor: num(e.minPriceMinor),
      currency: str(e.currency),
      hostVerified: e.hostVerified === true,
    }];
  });
  const hosts = arr(b.hosts).flatMap((raw): SearchHost[] => {
    const h = (raw ?? {}) as Record<string, unknown>;
    const id = str(h.id), handle = str(h.handle);
    if (!id || !handle) return [];
    return [{ id, handle, name: str(h.name) ?? handle, avatarUrl: str(h.avatarUrl), verified: h.verified === true, followerCount: num(h.followerCount) ?? 0 }];
  });
  const categories = arr(b.categories).flatMap((raw) => {
    const c = (raw ?? {}) as Record<string, unknown>;
    const key = str(c.key);
    return key ? [{ key, count: num(c.count) ?? 0 }] : [];
  });
  const cities = arr(b.cities).flatMap((raw) => {
    const c = (raw ?? {}) as Record<string, unknown>;
    const city = str(c.city);
    return city ? [{ city, country: str(c.country), count: num(c.count) ?? 0 }] : [];
  });
  return { events, hosts, categories, cities };
}

export function isEmpty(r: SearchResults): boolean {
  return !r.events.length && !r.hosts.length && !r.categories.length && !r.cities.length;
}
