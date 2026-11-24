import { describe, expect, it } from "vitest";
import { firstName, roleOf } from "./use-session";

describe("account pill", () => {
  it("shows Staff, then Host, then Guest", () => {
    expect(roleOf({ isStaff: true, isHost: true })).toBe("staff");
    expect(roleOf({ isStaff: false, isHost: true })).toBe("host");
    expect(roleOf({ isStaff: false, isHost: false })).toBe("guest");
  });
  it("uses the first word of the name", () => {
    expect(firstName("Ada Lovelace")).toBe("Ada");
    expect(firstName("  Chiamaka  ")).toBe("Chiamaka");
    expect(firstName(undefined)).toBe("");
  });
});
