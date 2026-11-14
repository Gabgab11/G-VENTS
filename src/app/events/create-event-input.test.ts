import { describe, expect, it } from "vitest";
import { createEventBody, locationInput } from "./create-event-input";
import { MAPS_URL_HINT, isGoogleMapsUrl } from "@/lib/maps-url";

function form(entries: [string, string][]): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

const base: [string, string][] = [
  ["title", "Lagos Jazz Night"],
  ["category", "Music"],
  ["date", "2026-12-05"],
  ["time", "18:00"],
  ["end_date", "2026-12-05"],
  ["end_time", "23:00"],
  ["country_code", "ng"],
  ["region", "Lagos"],
  ["venue", "Eko Hotel"],
  ["tier_name", "Regular"],
  ["tier_qty", ""],
  ["tier_name", "VIP"],
  ["tier_qty", "50"],
  ["intent", "publish"],
  ["show_attendee_count", "on"],
  ["cover_theme", "ocean"],
];

describe("createEventBody", () => {
  it("maps the form to the API: local times, venue, free ticket types, options", () => {
    expect(createEventBody(form([...base, ["per_buyer_limit", "4"], ["place_id", "ChIJ1234567890"], ["lat", "6.42"], ["lng", "3.43"], ["city", "Victoria Island"], ["address", "Adetokunbo Ademola"]]))).toEqual({
      title: "Lagos Jazz Night",
      category: "Music",
      startsAt: "2026-12-05T18:00",
      endsAt: "2026-12-05T23:00",
      location: { kind: "venue", venueName: "Eko Hotel", countryCode: "NG", region: "Lagos", city: "Victoria Island", address: "Adetokunbo Ademola", place: { placeId: "ChIJ1234567890", lat: 6.42, lng: 3.43 } },
      ticketTypes: [{ name: "Regular", priceMinor: 0 }, { name: "VIP", priceMinor: 0, quantity: 50 }],
      visibility: "public",
      showAttendeeCount: true,
      requireApproval: false,
      coverTheme: "ocean",
      perBuyerLimit: 4,
      publish: true,
    });
  });

  it("drops place details that didn't come together, and the city/address that came with them", () => {
    const body = createEventBody(form([...base, ["place_id", "ChIJ1234567890"], ["city", "Ikeja"]]));
    expect("error" in body ? body : body.location).toEqual({ kind: "venue", venueName: "Eko Hotel", countryCode: "NG", region: "Lagos" });
  });

  it("online events need a time zone and send no venue", () => {
    const online = base.filter(([k]) => !["country_code", "region", "venue"].includes(k));
    expect(createEventBody(form([...online, ["is_online", "on"]]))).toEqual({ error: "Choose the event's time zone." });
    const body = createEventBody(form([...online, ["is_online", "on"], ["time_zone", "Europe/London"]]));
    expect("error" in body ? body : [body.location, body.timeZone]).toEqual([{ kind: "online" }, "Europe/London"]);
  });

  it("refuses what the form must get right", () => {
    expect(createEventBody(form([["title", "Hi"]]))).toEqual({ error: "Event name must be 3 to 140 characters." });
    expect(createEventBody(form(base.filter(([k]) => k !== "time")))).toEqual({ error: "Add a start date and time." });
    const noEnd = base.filter(([k]) => k !== "end_date" && k !== "end_time");
    expect(createEventBody(form(noEnd))).toEqual({ error: "Add an end date and time." });
    expect(createEventBody(form([...noEnd, ["end_date", "2026-12-05"]]))).toEqual({ error: "Add an end date and time." });
    expect(createEventBody(form([...noEnd, ["end_date", "2026-12-05"], ["end_time", "18:00"]]))).toEqual({ error: "The end must be after the start." });
    expect(createEventBody(form([...noEnd, ["end_date", "2026-12-04"], ["end_time", "23:00"]]))).toEqual({ error: "The end must be after the start." });
    expect(createEventBody(form(base.filter(([k]) => k !== "country_code")))).toEqual({ error: "Choose a country from the list." });
    expect(createEventBody(form([...base.filter(([k]) => k !== "tier_qty"), ["tier_qty", "0"]]))).toMatchObject({ error: expect.stringContaining("whole number") });
    expect(createEventBody(form([...base, ["per_buyer_limit", "11"]]))).toEqual({ error: "Choose a limit from 1 to 10 tickets per person." });
  });
});

describe("venue Google Maps link (LO6)", () => {
  const venue: [string, string][] = [["country_code", "NG"], ["venue", "Eko Hotel"]];
  it("sends a Google Maps link with the venue, and nothing when empty", () => {
    expect(locationInput(form([...venue, ["maps_url", " https://maps.app.goo.gl/AbC123 "]]))).toMatchObject({ kind: "venue", mapsUrl: "https://maps.app.goo.gl/AbC123" });
    expect(locationInput(form([...venue, ["maps_url", ""]]))).not.toHaveProperty("mapsUrl");
  });
  it("refuses links that aren't Google Maps, and drops the link for online events", () => {
    expect(locationInput(form([...venue, ["maps_url", "https://evil.example/maps"]]))).toEqual({ error: MAPS_URL_HINT });
    expect(locationInput(form([["is_online", "on"], ["maps_url", "https://maps.app.goo.gl/AbC123"]]))).toEqual({ kind: "online" });
  });
});

describe("isGoogleMapsUrl", () => {
  it("matches the API's rule", () => {
    for (const ok of ["https://share.google/lNKLSEZsLPTwPHfPZ", "https://maps.app.goo.gl/x1", "https://goo.gl/maps/x1", "https://www.google.com/maps/place/X", "https://google.com.ng/maps?q=1,2", "https://maps.google.co.uk/?q=x"]) expect(isGoogleMapsUrl(ok), ok).toBe(true);
    for (const bad of ["http://maps.app.goo.gl/x1", "https://www.google.com/search?q=x", "https://google.com.evil.com/maps", "https://maps.app.goo.gl.evil.com/x", "https://share.google/", "https://share.google.evil.com/x", "javascript:alert(1)", ""]) expect(isGoogleMapsUrl(bad), bad).toBe(false);
  });
});

describe("paid tickets while payments are off (D64)", () => {
  it("refuses a price instead of saving the ticket as free", () => {
    const paid = base.map(([k, v]) => [k, v] as [string, string]);
    paid.splice(paid.findIndex(([k]) => k === "tier_qty") + 1, 0, ["tier_price", "5000"]);
    expect(createEventBody(form(paid))).toEqual({ error: "Paid tickets aren't available yet. Make every ticket free for now." });
  });
  it("accepts free tickets with a 0 price", () => {
    const free = [...base, ["tier_price", "0"], ["tier_price", "0"]] as [string, string][];
    const body = createEventBody(form(free));
    expect("error" in body).toBe(false);
    if (!("error" in body)) expect(body.ticketTypes.every((t) => t.priceMinor === 0)).toBe(true);
  });
});
