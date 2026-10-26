import { describe, expect, it } from "vitest";
import { formatEventDate, timezoneLabel, zonedTimeToUtc, eventDateParts } from "./dates";

describe("zonedTimeToUtc", () => {
  it("converts Lagos wall-clock time (UTC+1, no DST)", () => {
    expect(zonedTimeToUtc("2026-11-07", "18:00", "Africa/Lagos")?.toISOString()).toBe("2026-11-07T17:00:00.000Z");
  });

  it("handles zones with daylight saving", () => {
    expect(zonedTimeToUtc("2026-07-01", "12:00", "Europe/London")?.toISOString()).toBe("2026-07-01T11:00:00.000Z");
    expect(zonedTimeToUtc("2026-12-01", "12:00", "Europe/London")?.toISOString()).toBe("2026-12-01T12:00:00.000Z");
  });

  it.each([
    ["2026-02-31", "10:00"],
    ["2026-13-01", "10:00"],
    ["2026-01-01", "25:00"],
    ["not-a-date", "10:00"],
    ["2026-01-01", "10am"],
  ])("rejects %s %s", (date, time) => {
    expect(zonedTimeToUtc(date, time, "Africa/Lagos")).toBeNull();
  });

  it("rejects unknown zones", () => {
    expect(zonedTimeToUtc("2026-01-01", "10:00", "Mars/Olympus")).toBeNull();
  });
});

describe("formatEventDate", () => {
  it("formats in the event's zone", () => {
    expect(formatEventDate("2026-11-07T17:00:00Z", "Africa/Lagos", "compact")).toBe("7 Nov, 18:00");
    expect(formatEventDate("2026-11-07T17:00:00Z", "Europe/London", "compact")).toBe("7 Nov, 17:00");
  });

  it("falls back to Lagos for a missing or unknown zone", () => {
    expect(formatEventDate("2026-11-07T17:00:00Z", null, "compact")).toBe("7 Nov, 18:00");
    expect(formatEventDate("2026-11-07T17:00:00Z", "Mars/Olympus", "compact")).toBe("7 Nov, 18:00");
  });

  it("returns an empty string for an invalid date", () => {
    expect(formatEventDate("nope")).toBe("");
  });
});

describe("timezoneLabel", () => {
  it("uses the city part of the zone", () => {
    expect(timezoneLabel("Africa/Lagos")).toBe("Lagos");
    expect(timezoneLabel("America/New_York")).toBe("New York");
    expect(timezoneLabel(null)).toBe("Lagos");
  });
});

describe("eventDateParts (event page date block)", () => {
  it("shows the calendar tile, the day and the time range in the event's zone", () => {
    const p = eventDateParts("2027-02-20T17:00:00.000Z", "2027-02-20T22:00:00.000Z", "Africa/Lagos");
    expect(p).toEqual({ month: "FEB", day: "20", dateLine: "Saturday, 20 February 2027", timeLine: "18:00 – 23:00 · Lagos time" });
  });

  it("names both days when the event runs past midnight, and copes with no end or an unknown zone", () => {
    expect(eventDateParts("2027-02-20T21:00:00.000Z", "2027-02-21T01:00:00.000Z", "Africa/Lagos").timeLine).toBe("20 Feb 22:00 – 21 Feb 02:00 · Lagos time");
    expect(eventDateParts("2027-02-20T17:00:00.000Z", null, "Not/AZone").timeLine).toBe("18:00 · Lagos time");
  });
});
