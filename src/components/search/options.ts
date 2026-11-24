// The palette's rows (FR-34) in the order the arrow keys walk them: recent searches when nothing is
// typed; otherwise Events, Hosts, Categories, Cities, then "Search all on Discover". Pure, so the
// keyboard order and the links are unit-tested.
import { localizedPath } from "@/i18n/routing";
import type { Locale } from "@/i18n/languages";
import { isCategory } from "@/lib/categories";
import type { SearchEvent, SearchHost, SearchResults } from "./types";

export type PaletteOption =
  | { kind: "recent"; id: string; query: string }
  | { kind: "event"; id: string; href: string; event: SearchEvent }
  | { kind: "host"; id: string; href: string; host: SearchHost }
  | { kind: "category"; id: string; href: string; category: string; count: number }
  | { kind: "city"; id: string; href: string; city: string; country: string | null; count: number }
  | { kind: "all"; id: string; href: string; query: string };

export type GroupKey = "recent" | "events" | "hosts" | "categories" | "cities" | "all";
export type PaletteGroup = { key: GroupKey; options: PaletteOption[] };

/** /discover in the page's language, with a query string. */
export function discoverHref(lang: Locale, params: Record<string, string>): string {
  return `${localizedPath("/discover", lang)}?${new URLSearchParams(params).toString()}`;
}

export function buildGroups(opts: { query: string; results: SearchResults | null; recent: string[]; lang: Locale }): PaletteGroup[] {
  const { query, results, recent, lang } = opts;
  if (!query) {
    return recent.length ? [{ key: "recent", options: recent.map((q, i) => ({ kind: "recent", id: `pal-recent-${i}`, query: q })) }] : [];
  }
  const groups: PaletteGroup[] = [];
  if (results) {
    const events: PaletteOption[] = results.events.map((event) => ({ kind: "event", id: `pal-event-${event.id}`, href: localizedPath(`/e/${event.slug}`, lang), event }));
    const hosts: PaletteOption[] = results.hosts.map((host) => ({ kind: "host", id: `pal-host-${host.id}`, href: localizedPath(`/h/${host.handle}`, lang), host }));
    const categories: PaletteOption[] = results.categories
      .filter((c) => isCategory(c.key))
      .map((c) => ({ kind: "category", id: `pal-cat-${c.key}`, href: discoverHref(lang, { category: c.key }), category: c.key, count: c.count }));
    const cities: PaletteOption[] = results.cities.map((c, i) => ({
      kind: "city", id: `pal-city-${i}`, href: discoverHref(lang, { q: c.city }), city: c.city, country: c.country, count: c.count,
    }));
    if (events.length) groups.push({ key: "events", options: events });
    if (hosts.length) groups.push({ key: "hosts", options: hosts });
    if (categories.length) groups.push({ key: "categories", options: categories });
    if (cities.length) groups.push({ key: "cities", options: cities });
  }
  groups.push({ key: "all", options: [{ kind: "all", id: "pal-all", href: discoverHref(lang, { q: query }), query }] });
  return groups;
}

/** The next active row for an arrow key, wrapping at both ends; -1 when there are no rows. */
export function moveActive(current: number, count: number, delta: 1 | -1): number {
  if (count <= 0) return -1;
  if (current < 0) return delta === 1 ? 0 : count - 1;
  return (current + delta + count) % count;
}
