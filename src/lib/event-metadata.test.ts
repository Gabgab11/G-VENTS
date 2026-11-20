import { describe, expect, it } from "vitest";
import { buildEventMetadata, clip, eventDescription, firstLine, metaDate, ogLocale } from "./event-metadata";

const event = {
  slug: "paid-jazz-night-2pxql",
  title: "Paid Jazz Night",
  description: "An evening of live jazz on the island.\nDoors open at 7pm.",
  // 17:00 UTC is 18:00 in Lagos and 19:00 in Johannesburg.
  startsAt: "2026-12-05T17:00:00.000Z",
  timeZone: "Africa/Lagos",
  visibility: "public" as const,
  location: { kind: "venue" as const, city: "Lagos" },
};

const base = {
  event,
  lang: "en" as const,
  url: "https://g-ventz.com/e/paid-jazz-night-2pxql",
  imageUrl: "https://g-ventz.com/api/og/e/paid-jazz-night-2pxql?v=2026-11-01T10%3A00%3A00.000Z&lang=en",
  price: "From ₦5,000.00",
  online: "Online",
  imageAlt: "Paid Jazz Night",
};

describe("event metadata", () => {
  it("titles the page with the event name and the brand", () => {
    expect(buildEventMetadata(base).title).toBe("Paid Jazz Night · G-ventZ");
  });

  it("describes date in the event's zone, city, price and the description's first line", () => {
    expect(eventDescription(base)).toBe("Sat 5 Dec, 18:00 · Lagos · From ₦5,000.00 · An evening of live jazz on the island.");
  });

  it("uses the event's own time zone, not Lagos", () => {
    expect(metaDate(event.startsAt, "Africa/Johannesburg", "en")).toBe("Sat 5 Dec, 19:00");
  });

  it("writes the date in the page's language", () => {
    expect(metaDate(event.startsAt, "Africa/Lagos", "fr")).toMatch(/déc/);
  });

  it("says Online for online events", () => {
    expect(eventDescription({ ...base, event: { ...event, location: { kind: "online" } } })).toContain("· Online ·");
  });

  it("leaves out an empty description", () => {
    expect(eventDescription({ ...base, event: { ...event, description: null } })).toBe("Sat 5 Dec, 18:00 · Lagos · From ₦5,000.00");
  });

  it("keeps the description to 160 characters", () => {
    const long = { ...event, description: "word ".repeat(100) };
    const d = eventDescription({ ...base, event: long });
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d.endsWith("…")).toBe(true);
  });

  it("has a 1200×630 share card with alt text for Open Graph and Twitter", () => {
    const m = buildEventMetadata(base);
    const image = { url: base.imageUrl, width: 1200, height: 630, alt: "Paid Jazz Night" };
    expect(m.openGraph).toMatchObject({ type: "website", url: base.url, siteName: "G-ventZ", locale: "en", images: [image] });
    expect(m.twitter).toMatchObject({ card: "summary_large_image", images: [image] });
  });

  it("is indexable when public and noindex when private", () => {
    expect(buildEventMetadata(base).robots).toBeUndefined();
    expect(buildEventMetadata({ ...base, event: { ...event, visibility: "private" } }).robots).toEqual({ index: false, follow: false });
  });

  it("keeps the language alternates it is given", () => {
    const alternates = { canonical: base.url, languages: { fr: "https://g-ventz.com/fr/e/x" } };
    expect(buildEventMetadata({ ...base, alternates }).alternates).toEqual(alternates);
  });
});

describe("helpers", () => {
  it("firstLine skips blank lines", () => {
    expect(firstLine("\n\n  Hello \nworld")).toBe("Hello");
    expect(firstLine(null)).toBe("");
  });
  it("clip leaves short text alone", () => {
    expect(clip("short")).toBe("short");
  });
  it("ogLocale uses underscores", () => {
    expect(ogLocale("pt")).toBe("pt_BR");
    expect(ogLocale("ar")).toBe("ar");
  });
});
