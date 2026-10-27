import { describe, expect, it } from "vitest";
import { directionsUrl, mapEmbedUrl } from "./VenueMap";

const venue = { kind: "venue", venueName: "Eko Hotel", address: "Plot 1415 Adetokunbo Ademola", city: "Lagos", region: "Lagos", country: "Nigeria", countryCode: "NG", place: { placeId: "ChIJabc", lat: 6.4269, lng: 3.4227 } } as const;

describe("venue map", () => {
  it("uses the Google place with a key, and coordinates without one", () => {
    expect(mapEmbedUrl(venue, "k1")).toBe("https://www.google.com/maps/embed/v1/place?key=k1&q=place_id%3AChIJabc&zoom=15");
    expect(mapEmbedUrl(venue, "")).toBe("https://www.google.com/maps?q=6.4269%2C3.4227&z=15&output=embed");
    expect(directionsUrl(venue)).toBe("https://www.google.com/maps/dir/?api=1&destination=6.4269%2C3.4227&destination_place_id=ChIJabc");
  });

  it("falls back to the typed address, and shows nothing for online events", () => {
    const typed = { ...venue, place: null };
    expect(mapEmbedUrl(typed, "")).toContain("q=Eko%20Hotel%2C%20Plot%201415%20Adetokunbo%20Ademola%2C%20Lagos%2C%20Lagos%2C%20Nigeria");
    expect(mapEmbedUrl({ kind: "online" } as never, "k1")).toBeNull();
    expect(directionsUrl({ kind: "online" } as never)).toBeNull();
  });
});
