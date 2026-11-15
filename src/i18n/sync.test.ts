import { describe, expect, it } from "vitest";
import { languageSyncPlan } from "./sync-plan";

const ON = ["en", "fr", "ar"] as const;

describe("language sync after sign-in (S2.3, FR-23.4)", () => {
  it("the profile's language wins and is copied to this browser", () => {
    expect(languageSyncPlan("fr", "ar", ON)).toEqual({ setCookie: "fr" });
    expect(languageSyncPlan("fr", undefined, ON)).toEqual({ setCookie: "fr" });
    expect(languageSyncPlan("fr", "fr", ON)).toEqual({});
  });

  it("without a saved language, this browser's choice is saved to the profile", () => {
    expect(languageSyncPlan(null, "ar", ON)).toEqual({ saveProfile: "ar" });
    expect(languageSyncPlan(null, undefined, ON)).toEqual({});
  });

  it("ignores languages that are switched off, unknown, or the pseudo-language", () => {
    expect(languageSyncPlan("de", "fr", ON)).toEqual({});
    expect(languageSyncPlan(null, "de", ON)).toEqual({});
    expect(languageSyncPlan(null, "en-XA", [...ON, "en-XA"])).toEqual({});
    expect(languageSyncPlan("xx", "fr", ON)).toEqual({ saveProfile: "fr" });
  });
});
