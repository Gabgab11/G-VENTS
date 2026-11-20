import { describe, expect, it } from "vitest";
import { profileMetadata } from "./profile-metadata";

const base = {
  title: "Gather House (@gatherhouse)",
  bio: null,
  fallbackDescription: "Events by Gather House on G-ventZ.",
  lang: "fr" as const,
  url: "https://gventz.com/fr/h/gatherhouse",
  imageUrl: "https://gventz.com/api/og/h/gatherhouse?v=1&lang=fr",
  imageAlt: "Gather House",
};

describe("host profile metadata (FR-32, FR-24)", () => {
  it("uses the bio as the description, on one line, or the fallback", () => {
    expect(profileMetadata({ ...base, bio: "Jazz nights\nin Lagos " }).description).toBe("Jazz nights in Lagos");
    expect(profileMetadata(base).description).toBe("Events by Gather House on G-ventZ.");
    expect(profileMetadata({ ...base, bio: "   " }).description).toBe("Events by Gather House on G-ventZ.");
  });

  it("shares the profile's card in the page's language", () => {
    const m = profileMetadata(base);
    expect(m.title).toBe("Gather House (@gatherhouse) · G-ventZ");
    expect(m.openGraph).toMatchObject({ type: "profile", url: base.url, locale: "fr", images: [{ url: base.imageUrl, width: 1200, height: 630 }] });
    expect(m.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("is indexable, except for later pages of events", () => {
    expect(profileMetadata(base).robots).toBeUndefined();
    expect(profileMetadata({ ...base, pageOfMore: true }).robots).toEqual({ index: false, follow: true });
  });
});
