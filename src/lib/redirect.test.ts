import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("keeps same-site paths, including query and hash", () => {
    expect(safeNextPath("/e/lagos-tech-abc12")).toBe("/e/lagos-tech-abc12");
    expect(safeNextPath("/dashboard/1?tab=guests#top")).toBe("/dashboard/1?tab=guests#top");
  });

  it("falls back when there is no value", () => {
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
    expect(safeNextPath(undefined, "/")).toBe("/");
  });

  it.each([
    "javascript:alert(document.cookie)",
    "JavaScript:alert(1)",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "/\t/evil.example",
    "data:text/html,hi",
    "dashboard",
  ])("rejects %s", (input) => {
    expect(safeNextPath(input)).toBe("/dashboard");
  });
});
