import { describe, expect, it } from "vitest";
import { maskEmail } from "./mask";

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("ada@gmail.com")).toBe("a•••@gmail.com");
    expect(maskEmail("ada.lovelace@gmail.com")).toBe("a" + "•".repeat(11) + "@gmail.com");
  });

  it("handles malformed input without throwing", () => {
    expect(maskEmail("not-an-email")).toBe("your email address");
    expect(maskEmail("@gmail.com")).toBe("your email address");
  });
});
