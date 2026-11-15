import { describe, expect, it } from "vitest";
import en from "../../messages/en/shared.json";
import { CATEGORIES, categoryLabelKey } from "./categories";

describe("category label ids (Change 3)", () => {
  it("every category has an English label equal to its value", () => {
    for (const c of CATEGORIES) {
      const [area, group, id] = categoryLabelKey(c).split(".");
      expect(area).toBe("shared");
      expect((en as unknown as Record<string, Record<string, string>>)[group!]![id!]).toBe(c);
    }
  });
});
