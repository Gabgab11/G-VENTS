"use client";

import { useEffect, useRef, useState } from "react";

// Tilt game for the home page cards. Tilt the phone left or right and the cards
// slide along the line and pile up on the low side, like coins in a tray. They
// only ever move sideways along the line, so they still never pass it.
//
// Android: starts on its own. iPhone/iPad: Safari only shares motion after a tap,
// so a "Tilt to play" button asks once. Computers and visitors who prefer
// reduced motion get nothing extra.

const SETTLE_MS = 4200;   // the opening fall finishes before the game starts
const GRAVITY = 2600;     // px/s² at a 90° tilt
const DEADZONE = 3;       // degrees of tilt ignored, so a phone held "flat" stays still
const FRICTION = 2.4;     // how quickly sliding slows down (per second)
const OVERLAP = 0.62;     // neighbours may overlap by 38% of a card, like a heap (less room → more overlap)

type Body = { el: HTMLElement; base: number; w: number; x: number; v: number };

type Mode = "off" | "ask" | "hint" | "on";

function tiltFrom(e: DeviceOrientationEvent): number {
  const angle = (screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0) as number;
  const beta = e.beta ?? 0;
  const gamma = e.gamma ?? 0;
  if (angle === 90) return beta;
  if (angle === -90 || angle === 270) return -beta;
  if (angle === 180) return -gamma;
  return gamma;
}

export default function HeroTilt() {
  const [mode, setMode] = useState<Mode>("off");
  const anchor = useRef<HTMLSpanElement>(null);
  const tilt = useRef(0);
  const listening = useRef(false);
  const ready = useRef(false);

  function listen() {
    if (listening.current) return;
    listening.current = true;
    window.addEventListener("deviceorientation", (e) => {
      if (e.gamma === null && e.beta === null) return;
      tilt.current = tiltFrom(e);
      if (!ready.current) return;
      const tilted = Math.abs(tilt.current) > 8;
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
    stage.classList.add("hp-tilting");

    const bodies: Body[] = [...stage.querySelectorAll<HTMLElement>(".hp-fall")]
      .filter((el) => getComputedStyle(el).display !== "none")
      .map((el) => ({ el, base: el.offsetLeft, w: el.offsetWidth, x: 0, v: 0 }));

    // Measured once and again after a resize or rotation, not every frame.
    let width = stage.clientWidth;
    let spacing = OVERLAP;
    const measure = () => {
      width = stage.clientWidth;
      for (const b of bodies) { b.base = b.el.offsetLeft; b.w = b.el.offsetWidth; }
      const total = bodies.reduce((sum, b) => sum + b.w, 0);
      spacing = Math.min(OVERLAP, (width * 0.95) / Math.max(1, total));
    };
    measure();
    window.addEventListener("resize", measure);

    let visible = true;
    const seen = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    seen.observe(stage);

    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      frame = requestAnimationFrame(step);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) return;

      const deg = Math.abs(tilt.current) < DEADZONE ? 0 : tilt.current;
      const accel = Math.sin((Math.max(-90, Math.min(90, deg)) * Math.PI) / 180) * GRAVITY;

      for (const b of bodies) {
        b.v += accel * dt;
        b.v *= Math.exp(-FRICTION * dt);
        b.x += b.v * dt;
        // Walls: each card stays on screen and bumps softly off the edges.
        const min = -b.base - b.w * 0.08;
        const max = width - b.base - b.w * 0.92;
        if (b.x < min) { b.x = min; b.v = -b.v * 0.2; }
        if (b.x > max) { b.x = max; b.v = -b.v * 0.2; }
      }

      // Cards rest against their neighbours instead of passing through them, so they heap up
      // from the wall they slide towards. Corrections are capped per frame so the heap
      // shifts smoothly instead of jumping.
      const leftward = accel <= 0;
      const order = [...bodies].sort((a, c) => (a.base + a.x - (c.base + c.x)) * (leftward ? 1 : -1));
      for (let i = 1; i < order.length; i++) {
        const prev = order[i - 1];
        const b = order[i];
        const pos = b.base + b.x;
        const prevPos = prev.base + prev.x;
        if (leftward) {
          const minPos = prevPos + prev.w * spacing;
          if (pos < minPos) { b.x += Math.min(minPos - pos, 30); b.v = Math.max(b.v, prev.v); }
        } else {
          const maxPos = prevPos - b.w * spacing;
          if (pos > maxPos) { b.x -= Math.min(pos - maxPos, 30); b.v = Math.min(b.v, prev.v); }
        }
        b.x = Math.max(-b.base - b.w * 0.08, Math.min(width - b.base - b.w * 0.92, b.x));
      }

      for (const b of bodies) {
        b.el.style.translate = `${b.x.toFixed(1)}px 0`;
        b.el.style.rotate = `${Math.max(-10, Math.min(10, b.v * 0.012)).toFixed(2)}deg`;
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
