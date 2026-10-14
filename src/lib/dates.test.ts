import { describe, expect, it } from "vitest";
import { formatEventDate, timezoneLabel, zonedTimeToUtc } from "./dates";

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
