import { describe, expect, it } from "vitest";
import { MAX_THUMBS, frameRatio, swipeStep, thumbStrip, wrap } from "./gallery-index";

describe("wrap", () => {
  it("moves forward and back, wrapping round both ends", () => {
    expect(wrap(0, 1, 4)).toBe(1);
    expect(wrap(3, 1, 4)).toBe(0);
    expect(wrap(0, -1, 4)).toBe(3);
    expect(wrap(2, -1, 4)).toBe(1);
  });
  it("stays on the only picture", () => {
    expect(wrap(0, 1, 1)).toBe(0);
    expect(wrap(0, -1, 1)).toBe(0);
  });
  it("is safe with no pictures", () => {
    expect(wrap(0, 1, 0)).toBe(0);
  });
});

describe("thumbStrip", () => {
  it("has no strip for one picture (the page looks as it did)", () => {
    expect(thumbStrip(1, 0)).toEqual([]);
    expect(thumbStrip(0, 0)).toEqual([]);
  });
  it("shows every picture when they fit, the active one outlined", () => {
    const strip = thumbStrip(4, 2);
    expect(strip.map((t) => t.index)).toEqual([0, 1, 2, 3]);
    expect(strip.every((t) => t.more === 0)).toBe(true);
    expect(strip.filter((t) => t.active).map((t) => t.index)).toEqual([2]);
  });
  it("puts +N on the last thumbnail when there are more than fit", () => {
    const strip = thumbStrip(5, 0);
    expect(strip).toHaveLength(MAX_THUMBS);
    expect(strip.map((t) => [t.index, t.more])).toEqual([[0, 0], [1, 0], [2, 0], [3, 2]]);
  });
  it("outlines the +N thumbnail for any picture it holds", () => {
    expect(thumbStrip(5, 3).at(-1)!.active).toBe(true);
    expect(thumbStrip(5, 4).at(-1)!.active).toBe(true);
    expect(thumbStrip(5, 2).at(-1)!.active).toBe(false);
    expect(thumbStrip(5, 4).filter((t) => t.active)).toHaveLength(1);
  });
  it("counts what's left for a smaller strip", () => {
    expect(thumbStrip(5, 0, 3).at(-1)).toEqual({ index: 2, more: 3, active: false });
  });
});

describe("frameRatio", () => {
  it("follows the main picture within limits, square when unknown", () => {
    expect(frameRatio(800, 1000)).toBe(0.8);
    expect(frameRatio(400, 2000)).toBe(0.75);
    expect(frameRatio(3000, 1000)).toBe(1.5);
    expect(frameRatio(null, 500)).toBe(1);
  });
});

describe("swipeStep", () => {
  it("swiping left shows the next picture, right the previous", () => {
    expect(swipeStep(-80, 5, false)).toBe(1);
    expect(swipeStep(80, 5, false)).toBe(-1);
  });
  it("is mirrored in right-to-left languages", () => {
    expect(swipeStep(80, 5, true)).toBe(1);
    expect(swipeStep(-80, 5, true)).toBe(-1);
  });
  it("ignores short or mostly vertical movements", () => {
    expect(swipeStep(-20, 0, false)).toBe(0);
    expect(swipeStep(-60, 120, false)).toBe(0);
  });
});
