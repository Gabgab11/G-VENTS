import { describe, expect, it } from "vitest";
import { deltaOf, periodOf, stepsDone } from "./host-format";

describe("periodOf", () => {
  it("accepts the four periods", () => {
    expect(periodOf("7d")).toBe("7d");
    expect(periodOf("12m")).toBe("12m");
  });
  it("falls back to 30 days", () => {
    expect(periodOf(undefined)).toBe("30d");
    expect(periodOf("1y")).toBe("30d");
  });
});

describe("deltaOf", () => {
  it("gives the trend and the size without a sign", () => {
    expect(deltaOf(25.5, 10)).toEqual({ trend: "up", percent: "25.5" });
    expect(deltaOf(-4, 10)).toEqual({ trend: "down", percent: "4" });
    expect(deltaOf(0, 10)).toEqual({ trend: "flat", percent: "0" });
  });
  it("has no comparison when the previous period was zero and this one isn't", () => {
    expect(deltaOf(null, 3)).toBeNull();
    expect(deltaOf(null, 0)).toEqual({ trend: "flat", percent: "0" });
  });
});

describe("stepsDone", () => {
  it("counts the finished steps", () => {
    expect(stepsDone({ createdEvent: true, sharedEvent: false, payoutReady: true, twoStep: false })).toBe(2);
  });
});
