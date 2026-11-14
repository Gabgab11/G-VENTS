import { describe, expect, it } from "vitest";
import { mainZones, zoneCity, zoneLabel, zoneOptions } from "./time-zones";

const JAN = new Date("2026-01-15T12:00:00Z");

describe("time zone names", () => {
  it("reads like a place and a clock, not an IANA id", () => {
    expect(zoneLabel("Africa/Lagos", JAN)).toBe("Lagos · West Africa Time (GMT+1)");
    expect(zoneLabel("America/New_York", JAN)).toBe("New York · Eastern Time (GMT-5)");
    expect(zoneCity("America/Argentina/Buenos_Aires")).toBe("Buenos Aires");
  });

  it("falls back to the city for zones Intl doesn't know", () => {
    expect(zoneLabel("Not/A_Zone", JAN)).toBe("A Zone");
  });

  it("lists the country's zones first, each zone once", () => {
    const list = zoneOptions(["America/Chicago", "America/New_York"], ["Africa/Lagos", "America/New_York", "America/Chicago"]);
    expect(list).toEqual(["America/Chicago", "America/New_York", "Africa/Lagos"]);
  });

  it("shows a country's zones once per clock, west to east, by a well-known city", () => {
    const us = ["America/Adak", "America/Anchorage", "America/Boise", "America/Chicago", "America/Denver", "America/Detroit", "America/Indiana/Vevay",
      "America/Indiana/Knox", "America/Los_Angeles", "America/New_York", "America/Phoenix", "America/Juneau", "Pacific/Honolulu"];
    expect(mainZones(us, JAN)).toEqual(["America/Adak", "Pacific/Honolulu", "America/Anchorage", "America/Los_Angeles", "America/Denver", "America/Phoenix", "America/Chicago", "America/New_York"]);
    expect(mainZones(["Africa/Lagos"], JAN)).toEqual(["Africa/Lagos"]);
  });
});
