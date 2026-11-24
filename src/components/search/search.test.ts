import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildGroups, discoverHref, moveActive } from "./options";
import { addRecent, clearRecent, readRecent, RECENT_KEY, RECENT_MAX } from "./recent";
import { isApplePlatform, isOpenShortcut, isTypingTarget } from "./shortcut";
import { cleanQuery, isEmpty, MAX_QUERY, NO_RESULTS, normalizeResults } from "./types";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => { data.delete(k); },
    setItem: (k, v) => { data.set(k, String(v)); },
  };
}

const event = {
  id: "e1", slug: "afro-night", title: "Afro Night", startsAt: "2026-12-05T17:00:00.000Z", timeZone: "Africa/Lagos",
  city: "Lagos", isOnline: false, coverUrl: null, coverTheme: "minimal", minPriceMinor: 500000, currency: "NGN", hostVerified: true,
};
const host = { id: "h1", handle: "gather-house", name: "Gather House", avatarUrl: null, verified: true, followerCount: 3 };

describe("cleanQuery", () => {
  it("trims, collapses spaces and needs two characters", () => {
    expect(cleanQuery("  lagos   island ")).toBe("lagos island");
    expect(cleanQuery("a")).toBe("");
    expect(cleanQuery(" ")).toBe("");
    expect(cleanQuery(null)).toBe("");
    expect(cleanQuery("音乐")).toBe("音乐");
  });
  it("never returns more than the API accepts, and never splits a character (PBT)", () => {
    fc.assert(fc.property(fc.string({ unit: "grapheme", maxLength: 200 }), (s) => {
      const q = cleanQuery(s);
      expect(Array.from(q).length).toBeLessThanOrEqual(MAX_QUERY);
      expect(q).toBe(q.trim());
      expect(q.includes("�")).toBe(false);
    }));
  });
});

describe("normalizeResults", () => {
  it("keeps well-formed rows and drops broken ones", () => {
    const r = normalizeResults({
      events: [event, { id: "x" }, null],
      hosts: [host, { id: "h2" }],
      categories: [{ key: "Music", count: 2 }, { count: 1 }],
      cities: [{ city: "Lagos", country: "Nigeria", count: 1 }, {}],
    });
    expect(r.events).toEqual([event]);
    expect(r.hosts).toEqual([host]);
    expect(r.categories).toEqual([{ key: "Music", count: 2 }]);
    expect(r.cities).toEqual([{ city: "Lagos", country: "Nigeria", count: 1 }]);
  });
  it("turns anything else into no results", () => {
    for (const body of [null, undefined, "x", 3, [], { events: "no" }]) expect(isEmpty(normalizeResults(body))).toBe(true);
  });
});

describe("recent searches", () => {
  it("puts the newest first, once (ignoring case), and keeps five", () => {
    const store = memoryStorage();
    for (const q of ["one", "two", "three", "four", "five", "six"]) addRecent(q, store);
    expect(readRecent(store)).toEqual(["six", "five", "four", "three", "two"]);
    expect(addRecent("FOUR", store)).toEqual(["FOUR", "six", "five", "three", "two"]);
    expect(readRecent(store)).toHaveLength(RECENT_MAX);
  });
  it("survives broken or missing storage", () => {
    expect(readRecent(memoryStorage({ [RECENT_KEY]: "{not json" }))).toEqual([]);
    expect(readRecent(memoryStorage({ [RECENT_KEY]: JSON.stringify([1, "ok", ""]) }))).toEqual(["ok"]);
    expect(readRecent(null)).toEqual([]);
    const throwing = { ...memoryStorage(), getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); }, removeItem: () => { throw new Error("blocked"); } } as Storage;
    expect(readRecent(throwing)).toEqual([]);
    expect(addRecent("lagos", throwing)).toEqual(["lagos"]);
    expect(() => clearRecent(throwing)).not.toThrow();
  });
  it("clears", () => {
    const store = memoryStorage();
    addRecent("lagos", store);
    clearRecent(store);
    expect(readRecent(store)).toEqual([]);
  });
});

describe("shortcuts", () => {
  const key = (k: string, mods: Partial<KeyboardEvent> = {}, target: EventTarget | null = null) =>
    ({ key: k, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, isComposing: false, target, ...mods }) as KeyboardEvent;
  const field = { tagName: "INPUT", isContentEditable: false } as unknown as EventTarget;
  const div = { tagName: "DIV", isContentEditable: false } as unknown as EventTarget;
  const editable = { tagName: "DIV", isContentEditable: true } as unknown as EventTarget;

  it("opens on ⌘K, Ctrl+K and / outside fields", () => {
    expect(isOpenShortcut(key("k", { metaKey: true }))).toBe(true);
    expect(isOpenShortcut(key("K", { ctrlKey: true }))).toBe(true);
    expect(isOpenShortcut(key("k", { ctrlKey: true }, field))).toBe(true);
    expect(isOpenShortcut(key("/", {}, div))).toBe(true);
  });
  it("leaves typing alone", () => {
    expect(isOpenShortcut(key("/", {}, field))).toBe(false);
    expect(isOpenShortcut(key("/", {}, editable))).toBe(false);
    expect(isOpenShortcut(key("k"))).toBe(false);
    expect(isOpenShortcut(key("k", { metaKey: true, shiftKey: true }))).toBe(false);
    expect(isOpenShortcut(key("k", { metaKey: true, isComposing: true }))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
  it("shows ⌘ on Apple devices", () => {
    expect(isApplePlatform({ platform: "MacIntel" })).toBe(true);
    expect(isApplePlatform({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" })).toBe(true);
    expect(isApplePlatform({ platform: "Win32", userAgent: "Windows NT 10.0" })).toBe(false);
    expect(isApplePlatform(undefined)).toBe(false);
  });
});

describe("palette rows", () => {
  const results = { events: [event], hosts: [host], categories: [{ key: "Music", count: 2 }, { key: "Unknown", count: 1 }], cities: [{ city: "Lagos", country: "Nigeria", count: 1 }] };

  it("shows recent searches when nothing is typed", () => {
    expect(buildGroups({ query: "", results: null, recent: ["lagos"], lang: "en" })).toEqual([
      { key: "recent", options: [{ kind: "recent", id: "pal-recent-0", query: "lagos" }] },
    ]);
    expect(buildGroups({ query: "", results: null, recent: [], lang: "en" })).toEqual([]);
  });

  it("groups Events, Hosts, Categories, Cities, then Search all, with localized links", () => {
    const groups = buildGroups({ query: "la", results, recent: ["x"], lang: "fr" });
    expect(groups.map((g) => g.key)).toEqual(["events", "hosts", "categories", "cities", "all"]);
    const hrefs = groups.flatMap((g) => g.options).map((o) => ("href" in o ? o.href : null));
    expect(hrefs).toEqual(["/fr/e/afro-night", "/fr/h/gather-house", "/fr/discover?category=Music", "/fr/discover?q=Lagos", "/fr/discover?q=la"]);
  });

  it("offers Search all while results are loading or empty", () => {
    expect(buildGroups({ query: "zz", results: null, recent: [], lang: "en" }).map((g) => g.key)).toEqual(["all"]);
    expect(buildGroups({ query: "zz", results: NO_RESULTS, recent: [], lang: "en" }).map((g) => g.key)).toEqual(["all"]);
  });

  it("gives every row a unique id (aria-activedescendant)", () => {
    const ids = buildGroups({ query: "la", results, recent: [], lang: "en" }).flatMap((g) => g.options.map((o) => o.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("encodes the query in Discover links", () => {
    expect(discoverHref("en", { q: "a&b c" })).toBe("/discover?q=a%26b+c");
    expect(discoverHref("ar", { q: "لاغوس" })).toMatch(/^\/ar\/discover\?q=%D9/);
  });

  it("arrow keys wrap and stay in range (PBT)", () => {
    fc.assert(fc.property(fc.integer({ min: -1, max: 30 }), fc.integer({ min: 0, max: 30 }), fc.constantFrom(1 as const, -1 as const), (current, count, delta) => {
      const next = moveActive(Math.min(current, count - 1), count, delta);
      if (count === 0) expect(next).toBe(-1);
      else expect(next >= 0 && next < count).toBe(true);
    }));
    expect(moveActive(-1, 3, 1)).toBe(0);
    expect(moveActive(-1, 3, -1)).toBe(2);
    expect(moveActive(2, 3, 1)).toBe(0);
    expect(moveActive(0, 3, -1)).toBe(2);
  });
});
