import { describe, expect, it } from "vitest";
import { emailPreferencesFrom, isEmailPreference, readProfileForm } from "./account-input";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("account profile form (FR-35)", () => {
  it("reads name, phone in E.164 and gender", () => {
    expect(readProfileForm(form({ fullName: "  Ada   Lovelace ", phoneCountry: "ng", phone: "0803 123 4567", gender: "female" }))).toEqual({
      ok: true,
      value: { fullName: "Ada Lovelace", phone: "+2348031234567", gender: "female" },
    });
  });

  it("clears an empty phone and gender", () => {
    expect(readProfileForm(form({ fullName: "Ada", phoneCountry: "NG", phone: " ", gender: "" }))).toEqual({
      ok: true,
      value: { fullName: "Ada", phone: null, gender: null },
    });
  });

  it("keeps a number typed with its own country code", () => {
    const read = readProfileForm(form({ fullName: "Ada", phoneCountry: "NG", phone: "+44 20 7946 0958", gender: "unspecified" }));
    expect(read).toEqual({ ok: true, value: { fullName: "Ada", phone: "+442079460958", gender: "unspecified" } });
  });

  it("reports each bad field", () => {
    expect(readProfileForm(form({ fullName: "A", phoneCountry: "NG", phone: "12", gender: "other" }))).toEqual({
      ok: false,
      fields: { fullName: "nameShort", phone: "phoneInvalid", gender: "genderInvalid" },
    });
    expect(readProfileForm(form({ fullName: "x".repeat(121) }))).toEqual({ ok: false, fields: { fullName: "nameLong" } });
  });
});

describe("email preferences", () => {
  it("are on unless turned off", () => {
    expect(emailPreferencesFrom(undefined)).toEqual({ announcements: true, followedHosts: true, product: true });
    expect(emailPreferencesFrom({ product: false })).toEqual({ announcements: true, followedHosts: true, product: false });
  });
  it("only the three known keys are accepted", () => {
    expect(isEmailPreference("followedHosts")).toBe(true);
    expect(isEmailPreference("tickets")).toBe(false);
  });
});
