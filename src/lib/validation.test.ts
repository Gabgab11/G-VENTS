import { describe, expect, it } from "vitest";
import { getTheme, isThemeKey, THEMES } from "./themes";
import { CATEGORIES, CATEGORY_COLORS, isCategory } from "./categories";
import { field, isUuid } from "./forms";

describe("themes", () => {
  it("accepts every defined theme", () => {
    for (const key of Object.keys(THEMES)) expect(isThemeKey(key)).toBe(true);
  });

  it("rejects inherited object keys that `in` would accept", () => {
    for (const key of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(isThemeKey(key)).toBe(false);
      expect(getTheme(key)).toBe(THEMES.minimal);
    }
  });
});

describe("categories", () => {
  it("has a colour for every category", () => {
    for (const c of CATEGORIES) expect(CATEGORY_COLORS[c]).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("only accepts the canonical names", () => {
    expect(isCategory("Faith")).toBe(true);
    expect(isCategory("Faith and worship")).toBe(false);
    expect(isCategory(undefined)).toBe(false);
  });
});

describe("forms", () => {
  it("validates UUIDs", () => {
    expect(isUuid("3f1c2a9e-8b7d-4c6e-9f10-2a3b4c5d6e7f")).toBe(true);
    expect(isUuid("3f1c2a9e")).toBe(false);
    expect(isUuid("'; drop table events; --")).toBe(false);
  });

  it("trims and caps text fields", () => {
    const fd = new FormData();
    fd.set("title", "  Hello  ");
    fd.set("long", "x".repeat(50));
    expect(field(fd, "title")).toBe("Hello");
    expect(field(fd, "long", 10)).toHaveLength(10);
    expect(field(fd, "missing")).toBe("");
  });
});
