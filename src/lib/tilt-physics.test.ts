import { describe, expect, it } from "vitest";
import { acceleration, step, type Body } from "./tilt-physics";

const card = (left: number, over: Partial<Body> = {}): Body => ({
  left, top: 200, w: 60, h: 80, r: 0.42 * Math.sqrt(60 * 80), x: 0, y: 0, vx: 0, vy: 0, ...over,
});

const run = (bodies: Body[], tilt: { x: number; y: number }, seconds: number) => {
  let moving = true;
  for (let i = 0; i < seconds * 60; i++) moving = step(bodies, acceleration(tilt, 30), 400, 1 / 60);
  return moving;
};

describe("acceleration", () => {
  it("ignores small tilts except for the pull towards the line", () => {
    const { ax, ay } = acceleration({ x: 2, y: 32 }, 30);
    expect(ax).toBe(0);
    expect(ay).toBeGreaterThan(0);
  });

  it("pushes cards the way the phone is tilted", () => {
    expect(acceleration({ x: 30, y: 30 }, 30).ax).toBeGreaterThan(0);
    expect(acceleration({ x: -30, y: 30 }, 30).ax).toBeLessThan(0);
    expect(acceleration({ x: 0, y: 0 }, 30).ay).toBeLessThan(0); // tipped away: cards float up
  });
});

describe("step", () => {
  it("keeps cards inside the stage", () => {
    const bodies = [card(10), card(150), card(300)];
    run(bodies, { x: 60, y: 0 }, 3);
    for (const b of bodies) {
      expect(b.left + b.x).toBeLessThanOrEqual(400 - b.w * 0.92 + 0.001);
      expect(b.y).toBeLessThanOrEqual(0);
      expect(b.top + b.y).toBeGreaterThanOrEqual(-0.001);
    }
  });

  it("settles when the phone is held still, so the loop can sleep", () => {
    const bodies = [card(10, { vx: 400 }), card(150), card(300, { vy: -300 })];
    expect(run(bodies, { x: 0, y: 30 }, 6)).toBe(false);
  });

  it("keeps moving while the phone is tilted", () => {
    const bodies = [card(150)];
    expect(step(bodies, acceleration({ x: 40, y: 30 }, 30), 400, 1 / 60)).toBe(true);
  });
});
