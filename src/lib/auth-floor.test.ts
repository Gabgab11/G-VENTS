import { describe, expect, it } from "vitest";
import { backWouldLeaveSession } from "./auth-floor";

describe("back arrow floor after sign-in", () => {
  it("never goes back from the first page after sign-in (it would reach the sign-in or Google pages)", () => {
    // History: home(0) sign-in(1) google(2) dashboard(3) → floor 3, length 4.
    expect(backWouldLeaveSession(4, 3)).toBe(true);
  });
  it("goes back normally between pages visited after sign-in", () => {
    expect(backWouldLeaveSession(5, 3)).toBe(false);
  });
  it("uses the fallback when there's no history, and goes back normally without a floor", () => {
    expect(backWouldLeaveSession(1, null)).toBe(true);
    expect(backWouldLeaveSession(3, null)).toBe(false);
  });
});
