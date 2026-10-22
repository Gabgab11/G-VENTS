// Physics for the home page tilt game (src/app/HeroTilt.tsx). Kept free of the
// DOM so it can be unit tested: the component measures the cards, calls step()
// once per animation frame and writes the resulting offsets back to the page.

export const GRAVITY = 2600;     // px/s² at a 90° tilt
export const REST_PULL = 0.12;   // a little pull towards the line, so a phone held still lets cards settle
export const DEADZONE = 3;       // degrees of tilt ignored
export const FRICTION = 2.2;     // how quickly movement slows down (per second)
export const BOUNCE = 0.2;       // how much speed survives hitting an edge
export const PUSH_CAP = 12;      // px per frame cards may push each other apart (keeps it smooth)
export const REST_SPEED = 4;     // px/s below which a card counts as still

export type Body = {
  left: number; top: number; // resting position inside the stage
  w: number; h: number; r: number;
  x: number; y: number;      // offset from the resting position (y < 0 is up)
  vx: number; vy: number;
};

export type Tilt = { x: number; y: number };

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const toRad = (deg: number) => (deg * Math.PI) / 180;

// Tilt in degrees (x: left-right, y: front-back relative to how the phone was
// held when the game started) to acceleration in px/s², with the dead zone applied.
export function acceleration(t: Tilt, neutral: number): { ax: number; ay: number } {
  const tx = Math.abs(t.x) < DEADZONE ? 0 : clamp(t.x, -90, 90);
  const ty = Math.abs(t.y - neutral) < DEADZONE ? 0 : clamp(t.y - neutral, -90, 90);
  return { ax: Math.sin(toRad(tx)) * GRAVITY, ay: (Math.sin(toRad(ty)) + REST_PULL) * GRAVITY };
}

// Keeps a card inside the stage: never below the line, off the top or past the sides.
export function keepInside(b: Body, width: number, bounce: boolean): void {
  const minX = -b.left - b.w * 0.08;
  const maxX = width - b.left - b.w * 0.92;
  const minY = -b.top;
  if (b.x < minX) { b.x = minX; if (bounce) b.vx = -b.vx * BOUNCE; }
  if (b.x > maxX) { b.x = maxX; if (bounce) b.vx = -b.vx * BOUNCE; }
  if (b.y > 0) { b.y = 0; if (bounce) b.vy = -b.vy * BOUNCE; }
  if (b.y < minY) { b.y = minY; if (bounce) b.vy = -b.vy * BOUNCE; }
}

export const isMoving = (b: Body) => Math.hypot(b.vx, b.vy) > REST_SPEED;

// Advances every card by dt seconds. Returns true while any card is still moving,
// so the caller can stop the animation loop once the heap has settled.
export function step(bodies: Body[], accel: { ax: number; ay: number }, width: number, dt: number): boolean {
  const slow = Math.exp(-FRICTION * dt);
  for (const b of bodies) {
    b.vx = (b.vx + accel.ax * dt) * slow;
    b.vy = (b.vy + accel.ay * dt) * slow;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    keepInside(b, width, true);
  }

  // Cards bump into each other and share their speed, so they pile up.
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const c = bodies[j];
        const dx = c.left + c.x + c.w / 2 - (a.left + a.x + a.w / 2);
        const dy = c.top + c.y + c.h / 2 - (a.top + a.y + a.h / 2);
        const dist = Math.hypot(dx, dy) || 0.01;
        const overlap = a.r + c.r - dist;
        if (overlap <= 0) continue;
        const nx = dx / dist;
        const ny = dy / dist;
        const push = Math.min(overlap / 2, PUSH_CAP);
        a.x -= nx * push; a.y -= ny * push;
        c.x += nx * push; c.y += ny * push;
        const closing = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
        if (closing < 0) {
          const impulse = (-(1 + BOUNCE) * closing) / 2;
          a.vx -= impulse * nx; a.vy -= impulse * ny;
          c.vx += impulse * nx; c.vy += impulse * ny;
        }
      }
    }
    for (const b of bodies) keepInside(b, width, false);
  }

  return bodies.some(isMoving);
}
