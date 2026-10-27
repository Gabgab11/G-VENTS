import { describe, expect, it } from "vitest";
import { createEventBody } from "./create-event-input";

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
    expect(createEventBody(form([...base, ["end_date", "2026-12-05"]]))).toEqual({ error: "Add both an end date and an end time, or leave both empty." });
    expect(createEventBody(form(base.filter(([k]) => k !== "country_code")))).toEqual({ error: "Choose a country from the list." });
    expect(createEventBody(form([...base.filter(([k]) => k !== "tier_qty"), ["tier_qty", "0"]]))).toMatchObject({ error: expect.stringContaining("whole number") });
    expect(createEventBody(form([...base, ["per_buyer_limit", "11"]]))).toEqual({ error: "Choose a limit from 1 to 10 tickets per person." });
  });
});
