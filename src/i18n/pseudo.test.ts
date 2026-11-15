import { describe, expect, it } from "vitest";
import { shapeOf } from "./catalogue";
import { pseudo } from "./pseudo";

describe("pseudo-language (W12)", () => {
  it("accents and lengthens text but keeps ICU syntax intact", () => {
    expect(pseudo("Sign in")).toBe("[Šîgñ îñ~~~]");
    for (const m of ["Hello {name}", "{count, plural, one {# ticket} other {# tickets}}", "<b>Bold</b> and {x}"]) {
      expect(shapeOf(pseudo(m))).toEqual(shapeOf(m));
    }
  });
});
