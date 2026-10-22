"use client";

import { useEffect, useRef, useState } from "react";

// Tilt game for the home page cards. Tilt the phone and the cards roll around the
// top of the page: left/right slides them sideways, tipping the top of the phone
// away from you floats them up, tipping it back drops them onto the line. They
// bump into each other and pile up. They stay inside the hero: never below the
// line above the name ticker, never off the top or sides of the screen.
//
// Android: starts on its own. iPhone/iPad: Safari only shares motion after a tap,
// so a "Tilt to play" button asks once. Computers and visitors who prefer
// reduced motion get nothing extra.

const SETTLE_MS = 4200;   // the opening fall finishes before the game starts
const GRAVITY = 2600;     // px/s² at a 90° tilt
const REST_PULL = 0.12;   // a little pull towards the line, so a phone held still lets cards settle
const DEADZONE = 3;       // degrees of tilt ignored
const FRICTION = 2.2;     // how quickly movement slows down (per second)
const BOUNCE = 0.2;       // how much speed survives hitting an edge
const PUSH_CAP = 12;      // px per frame cards may push each other apart (keeps it smooth)

type Body = {
  el: HTMLElement;
  left: number; top: number; // resting position inside the stage
  w: number; h: number; r: number;
  x: number; y: number;      // offset from the resting position (y < 0 is up)
  vx: number; vy: number;
};

type Mode = "off" | "ask" | "hint" | "on";
type Tilt = { x: number; y: number };

// Left-right and front-back tilt in screen terms, whichever way the phone is turned.
function tiltFrom(e: DeviceOrientationEvent): Tilt {
  const angle = (screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0) as number;
  const beta = e.beta ?? 0;
  const gamma = e.gamma ?? 0;
  if (angle === 90) return { x: beta, y: -gamma };
  if (angle === -90 || angle === 270) return { x: -beta, y: gamma };
  if (angle === 180) return { x: -gamma, y: -beta };
  return { x: gamma, y: beta };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const toRad = (deg: number) => (deg * Math.PI) / 180;

export default function HeroTilt() {
  const [mode, setMode] = useState<Mode>("off");
  const anchor = useRef<HTMLSpanElement>(null);
  const tilt = useRef<Tilt | null>(null);
  const firstY = useRef<number | null>(null);
  const listening = useRef(false);
  const ready = useRef(false);

  function listen() {
    if (listening.current) return;
    listening.current = true;
    window.addEventListener("deviceorientation", (e) => {
      if (e.gamma === null && e.beta === null) return;
      const t = tiltFrom(e);
      tilt.current = t;
      if (firstY.current === null) firstY.current = t.y;
      if (!ready.current) return;
      const tilted = Math.abs(t.x) > 8 || Math.abs(t.y - firstY.current) > 10;
      setMode((m) => (m === "on" || tilted ? "on" : m === "off" ? "hint" : m));
    });
  }

  // Decide what this device gets once the cards have landed.
  useEffect(() => {
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!touch || calm || typeof DeviceOrientationEvent === "undefined") return;

    const needsPermission = typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === "function";
    const timer = setTimeout(() => {
      ready.current = true;
      if (needsPermission) setMode("ask");
      else listen(); // the hint appears once the sensor reports, so phones without one see nothing
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, []);

  // The physics: runs only while the game is on and the cards are on screen.
  useEffect(() => {
    if (mode !== "on") return;
    const stage = anchor.current?.closest<HTMLElement>(".hp-stage");
    if (!stage) return;
    stage.classList.add("hp-tilting"); // every card drops onto the line first

    const bodies: Body[] = [...stage.querySelectorAll<HTMLElement>(".hp-fall")]
      .filter((el) => getComputedStyle(el).display !== "none")
      .map((el) => ({ el, left: 0, top: 0, w: 0, h: 0, r: 0, x: 0, y: 0, vx: 0, vy: 0 }));

    // Sizes are measured once, and again after a resize or rotation, not every frame.
    let width = 0;
    const measure = () => {
      width = stage.clientWidth;
      const height = stage.clientHeight;
      const scale = parseFloat(getComputedStyle(stage).getPropertyValue("--s")) || 1;
      for (const b of bodies) {
        const lift = (parseFloat(getComputedStyle(b.el).getPropertyValue("--lift")) || 0) * scale;
        b.left = b.el.offsetLeft;
        b.w = b.el.offsetWidth;
        b.h = b.el.offsetHeight;
        b.top = height - b.h - lift;              // resting on the line
        b.r = 0.42 * Math.sqrt(b.w * b.h);        // cards overlap a little, like a real heap
      }
    };
    measure();
    window.addEventListener("resize", measure);

    let visible = true;
    const seen = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    seen.observe(stage);

    // However the phone is held when the game starts counts as level
    // (set from the first sensor reading, which can arrive a moment later).
    let neutral: number | null = tilt.current ? clamp(tilt.current.y, 10, 80) : null;

    const keepInside = (b: Body, bounce: boolean) => {
      const minX = -b.left - b.w * 0.08;
      const maxX = width - b.left - b.w * 0.92;
      const minY = -b.top;                      // top of the page
      if (b.x < minX) { b.x = minX; if (bounce) b.vx = -b.vx * BOUNCE; }
      if (b.x > maxX) { b.x = maxX; if (bounce) b.vx = -b.vx * BOUNCE; }
      if (b.y > 0) { b.y = 0; if (bounce) b.vy = -b.vy * BOUNCE; }   // the line
      if (b.y < minY) { b.y = minY; if (bounce) b.vy = -b.vy * BOUNCE; }
    };

    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      frame = requestAnimationFrame(step);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) return;

      if (neutral === null) {
        if (!tilt.current) return;
        neutral = clamp(tilt.current.y, 10, 80);
      }
      const t = tilt.current ?? { x: 0, y: neutral };
      const tx = Math.abs(t.x) < DEADZONE ? 0 : clamp(t.x, -90, 90);
      const ty = Math.abs(t.y - neutral) < DEADZONE ? 0 : clamp(t.y - neutral, -90, 90);
      const ax = Math.sin(toRad(tx)) * GRAVITY;
      const ay = (Math.sin(toRad(ty)) + REST_PULL) * GRAVITY;

      const slow = Math.exp(-FRICTION * dt);
      for (const b of bodies) {
        b.vx = (b.vx + ax * dt) * slow;
        b.vy = (b.vy + ay * dt) * slow;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        keepInside(b, true);
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
        for (const b of bodies) keepInside(b, false);
      }

      for (const b of bodies) {
        b.el.style.translate = `${b.x.toFixed(1)}px ${b.y.toFixed(1)}px`;
        b.el.style.rotate = `${clamp(b.vx * 0.012, -12, 12).toFixed(2)}deg`;
      }
    };
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      seen.disconnect();
      window.removeEventListener("resize", measure);
      stage.classList.remove("hp-tilting");
    };
  }, [mode]);

  async function askPermission() {
    try {
      const request = (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission;
      const answer = await request();
      if (answer === "granted") { listen(); setMode("on"); }
      else setMode("off");
    } catch {
      setMode("off");
    }
  }

  return (
    <span ref={anchor} className="hp-tilt">
      {mode === "ask" && (
        <button type="button" className="hp-tilt-btn" onClick={askPermission}>Tilt to play ✨</button>
      )}
      {mode === "hint" && <span className="hp-tilt-hint">Tilt your phone ✨</span>}
    </span>
  );
}
