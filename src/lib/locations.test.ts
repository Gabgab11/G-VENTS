import { describe, expect, it } from "vitest";
import { COUNTRIES, REGIONS, countryName, fold, orderedCountries, regionsFor } from "./locations";

describe("event location data", () => {
  it("lists 30 countries, each with its own regions", () => {
    expect(COUNTRIES).toHaveLength(30);
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(30);
    for (const c of COUNTRIES) expect(REGIONS[c.code]?.regions.length).toBeGreaterThan(0);
  });

  it("has Nigeria's 36 states plus FCT Abuja", () => {
    const ng = regionsFor("NG")!;
    expect(ng.label).toBe("State");
    expect(ng.regions).toHaveLength(37);
    expect(ng.regions).toContain("FCT Abuja");
    expect(ng.regions).toContain("Lagos");
  });

  it("has the right counts for other countries", () => {
    expect(regionsFor("US")!.regions).toHaveLength(51); // 50 states + DC
    expect(regionsFor("CA")!.regions).toHaveLength(13);
    expect(regionsFor("EG")!.regions).toHaveLength(27);
    expect(regionsFor("GH")!.regions).toHaveLength(16);
    expect(regionsFor("KE")!.regions).toHaveLength(47);
  });

  it("puts the detected country first and falls back to Nigeria", () => {
    expect(orderedCountries("EG")[0].code).toBe("EG");
    expect(orderedCountries("EG")).toHaveLength(30);
    expect(orderedCountries(null)[0].code).toBe("NG");
    expect(orderedCountries("XX")[0].code).toBe("NG");
    // A country outside the list is added on top, not dropped.
    const qatar = orderedCountries("QA");
    expect(qatar[0]).toEqual({ code: "QA", name: "Qatar" });
    expect(qatar).toHaveLength(31);
    expect(countryName("NG")).toBe("Nigeria");
  });

  it("searches without caring about accents or case", () => {
    expect(fold("Côte d'Ivoire").includes(fold("COTE"))).toBe(true);
  });
});
