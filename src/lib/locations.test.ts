import { describe, expect, it } from "vitest";
import { COUNTRIES, countryName, fold, orderedCountries } from "./locations";

describe("event location data", () => {
  it("lists 30 countries, each once", () => {
    expect(COUNTRIES).toHaveLength(30);
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(30);
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
