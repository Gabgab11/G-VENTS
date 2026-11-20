import { describe, expect, it } from "vitest";
import { THEMES } from "@/lib/themes";
import { isLightColour } from "./ThemeStage";

describe("isLightColour", () => {
  it("tells light page backgrounds from dark ones", () => {
    expect(isLightColour("#ffffff")).toBe(true);
    expect(isLightColour("#141414")).toBe(false);
    expect(isLightColour("nope")).toBe(false);
  });
  it("puts every dashboard style on one side", () => {
    const light = Object.entries(THEMES).filter(([, t]) => isLightColour(t.bg)).map(([k]) => k);
    expect(light).toEqual(expect.arrayContaining(["sunset", "blush", "mint", "lavender"]));
    expect(light).not.toContain("minimal");
  });
});
