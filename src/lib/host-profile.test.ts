import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  cardVersion,
  followReducer,
  handleProblem,
  initialFollow,
  normalizeHandle,
  profileCardPath,
  profileOutcome,
  socialDisplay,
  socialInput,
} from "./host-profile";

describe("handles (FR-32, D83)", () => {
  it("normalises as the API does: NFKC, trim, one @, lower case", () => {
    expect(normalizeHandle("  @Ada-Events ")).toBe("ada-events");
    expect(normalizeHandle("ＡＤＡ")).toBe("ada"); // full-width letters
    expect(normalizeHandle("@@ada")).toBe("@ada");
  });

  it("is idempotent", () => {
    fc.assert(fc.property(fc.string(), (s) => normalizeHandle(normalizeHandle(s)) === normalizeHandle(s)));
  });

  it("accepts 3 to 30 letters and digits with single inner hyphens", () => {
    for (const ok of ["ada", "ada-events", "a1b2", "x".repeat(30), "@GatherHouse"]) expect(handleProblem(ok), ok).toBeNull();
    for (const bad of ["ab", "x".repeat(31), "-ada", "ada-", "ada--events", "ada_events", "ada.events", "adá", "", "a b c"]) expect(handleProblem(bad), bad).toBe("invalid");
  });

  it("refuses reserved words, whatever the case", () => {
    for (const r of ["admin", "Discover", "@sign-in", "G-ventZ", "settings"]) expect(handleProblem(r), r).toBe("reserved");
  });
});

describe("profile addresses", () => {
  it("is a 404 for an unknown host or one without a handle", () => {
    expect(profileOutcome(null, "ada")).toEqual({ kind: "notFound" });
    expect(profileOutcome({ handle: "", movedTo: null }, "ada")).toEqual({ kind: "notFound" });
  });

  it("moves an old handle to the new one", () => {
    expect(profileOutcome({ handle: "new-name", movedTo: "new-name" }, "old-name")).toEqual({ kind: "redirect", handle: "new-name" });
  });

  it("moves another spelling to the stored handle, and shows the stored one", () => {
    expect(profileOutcome({ handle: "ada-events", movedTo: null }, "Ada-Events")).toEqual({ kind: "redirect", handle: "ada-events" });
    expect(profileOutcome({ handle: "ada-events", movedTo: null }, "%40ada-events")).toEqual({ kind: "redirect", handle: "ada-events" });
    expect(profileOutcome({ handle: "ada-events", movedTo: null }, "ada-events")).toEqual({ kind: "show" });
  });

  it("versions the share card by what it shows", () => {
    expect(cardVersion(["Ada", null, true])).toBe(cardVersion(["Ada", null, true]));
    expect(cardVersion(["Ada", null, true])).not.toBe(cardVersion(["Ada", null, false]));
    expect(profileCardPath("ada-events", "abc", "fr")).toBe("/api/og/h/ada-events?v=abc&lang=fr");
  });
});

describe("social links", () => {
  it("turns a bare handle into the network's link", () => {
    expect(socialInput("instagram", "@adaevents")).toBe("https://instagram.com/adaevents");
    expect(socialInput("instagram", "ada.events")).toBe("https://instagram.com/ada.events");
    expect(socialInput("x", "adaevents")).toBe("https://x.com/adaevents");
    expect(socialInput("facebook", " adaevents ")).toBe("https://facebook.com/adaevents");
  });

  it("leaves links and websites for the API to check, and clears empty fields", () => {
    expect(socialInput("instagram", "instagram.com/adaevents")).toBe("instagram.com/adaevents");
    expect(socialInput("instagram", "instagram.com")).toBe("instagram.com");
    expect(socialInput("facebook", "https://fb.com/ada")).toBe("https://fb.com/ada");
    expect(socialInput("website", "adaevents")).toBe("adaevents");
    expect(socialInput("x", "   ")).toBeNull();
  });

  it("shows a short name for each stored link", () => {
    expect(socialDisplay("instagram", "https://instagram.com/adaevents")).toBe("@adaevents");
    expect(socialDisplay("x", "https://x.com/adaevents")).toBe("@adaevents");
    expect(socialDisplay("facebook", "https://facebook.com/adaevents")).toBe("adaevents");
    expect(socialDisplay("facebook", "https://facebook.com/profile.php?id=1")).toBeNull();
    expect(socialDisplay("website", "https://www.adaevents.com/")).toBe("adaevents.com");
    expect(socialDisplay("website", "https://adaevents.com/about/")).toBe("adaevents.com/about");
    expect(socialDisplay("website", `https://a.com/${"x".repeat(60)}`)).toHaveLength(40);
    expect(socialDisplay("website", "javascript:alert(1)")).toBeNull();
    expect(socialDisplay("website", "not a link")).toBeNull();
  });
});

describe("the Follow button", () => {
  it("follows at once, then takes the API's answer", () => {
    let s = initialFollow(false, 4);
    s = followReducer(s, { type: "toggle" });
    expect(s).toMatchObject({ following: true, count: 5, pending: true });
    s = followReducer(s, { type: "settled", following: true, count: 9 });
    expect(s).toEqual({ following: true, count: 9, pending: false, previous: null });
  });

  it("unfollows, and puts things back when the call fails", () => {
    let s = initialFollow(true, 1);
    s = followReducer(s, { type: "toggle" });
    expect(s).toMatchObject({ following: false, count: 0, pending: true });
    s = followReducer(s, { type: "failed" });
    expect(s).toEqual({ following: true, count: 1, pending: false, previous: null });
  });

  it("ignores clicks while a change is on its way, and never counts below zero", () => {
    const pending = followReducer(initialFollow(false, 0), { type: "toggle" });
    expect(followReducer(pending, { type: "toggle" })).toBe(pending);
    expect(followReducer(initialFollow(true, 0), { type: "toggle" }).count).toBe(0);
  });
});
