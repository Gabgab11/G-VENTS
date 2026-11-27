import { describe, expect, it } from "vitest";
import { LATE_WINDOW_MS, pollDelay, watchUntil } from "./polling";

describe("payment polling (late bank transfers)", () => {
  it("checks often at first, then backs off", () => {
    expect(pollDelay(0)).toBe(3_000);
    expect(pollDelay(119_999)).toBe(3_000);
    expect(pollDelay(2 * 60_000)).toBe(10_000);
    expect(pollDelay(10 * 60_000)).toBe(30_000);
    expect(pollDelay(29 * 60_000)).toBe(30_000);
  });

  it("keeps watching for 30 minutes after the hold ends", () => {
    expect(watchUntil(1_000, 0)).toBe(1_000 + LATE_WINDOW_MS);
    expect(watchUntil(null, 5_000)).toBe(5_000 + LATE_WINDOW_MS);
    expect(LATE_WINDOW_MS).toBe(30 * 60_000);
  });
});
