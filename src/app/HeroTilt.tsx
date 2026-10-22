"use client";

import { useEffect, useRef, useState } from "react";
import { acceleration, clamp, isMoving, step, type Body, type Tilt } from "@/lib/tilt-physics";

// Tilt game for the home page cards. Tilt the phone and the cards roll around the
// top of the page: left/right slides them sideways, tipping the top of the phone
// away from you floats them up, tipping it back drops them onto the line. They
// bump into each other and pile up. They stay inside the hero: never below the
// line above the name ticker, never off the top or sides of the screen.
//
// The game only starts when the visitor taps "Tilt to play" (and can be stopped
// again), so moving content never starts on its own. On Android the button only
// appears once the motion sensor reports; iPhone/iPad ask for permission on that
// tap. Computers and visitors who prefer reduced motion get nothing extra.
// The choice is remembered for the browser session.
//
// Battery: the animation loop sleeps once the cards have settled or the hero is
// off screen, and wakes when the phone is tilted again.

const SETTLE_MS = 4200;   // the opening fall finishes before the game is offered
const WAKE_DEG = 1.5;     // a sleeping heap wakes when the tilt changes by this much
const STILL_FRAMES = 20;  // frames with no visible movement before the loop sleeps
const STORE_KEY = "gv-tilt";

type Mode = "off" | "ask" | "on";
type Card = Body & { el: HTMLElement };

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

function remembered(): boolean {
  try { return sessionStorage.getItem(STORE_KEY) === "on"; } catch { return false; }
}
function remember(on: boolean) {
  try { sessionStorage.setItem(STORE_KEY, on ? "on" : "off"); } catch { /* storage blocked: not remembered */ }
}

const needsPermission = () =>
  typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === "function";

export default function HeroTilt() {
  const [mode, setMode] = useState<Mode>("off");
  const anchor = useRef<HTMLSpanElement>(null);
  const tilt = useRef<Tilt | null>(null);
  const wake = useRef<(() => void) | null>(null); // set by the physics loop while it sleeps

  // Once the cards have landed: listen to the sensor (removed again on unmount)
  // and offer the game. The handler only stores the reading; React state changes
  // at most once, on the first reading.
  useEffect(() => {
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!touch || calm || typeof DeviceOrientationEvent === "undefined") return;

    const ask = needsPermission();
    let offered = false;
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma === null && e.beta === null) return;
      tilt.current = tiltFrom(e);
      wake.current?.();
      if (!offered && !ask) {
        offered = true;
        setMode(remembered() ? "on" : "ask");
      }
    };

    const timer = setTimeout(() => {
      window.addEventListener("deviceorientation", onOrientation);
      if (ask) setMode("ask"); // Safari shares no readings until the visitor allows it
    }, SETTLE_MS);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("deviceorientation", onOrientation);
    };
  }, []);

  // The physics: runs only while the game is on.
  useEffect(() => {
    if (mode !== "on") return;
    const stage = anchor.current?.closest<HTMLElement>(".hp-stage");
    if (!stage) return;
    stage.classList.add("hp-tilting"); // every card drops onto the line first

    // Which cards are shown depends on the screen width, so the list is rebuilt
    // on every resize or rotation (keeping each card's current offset).
    let cards: Card[] = [];
    let width = 0;
    const measure = () => {
      const old = new Map(cards.map((c) => [c.el, c]));
      width = stage.clientWidth;
      const height = stage.clientHeight;
      const scale = parseFloat(getComputedStyle(stage).getPropertyValue("--s")) || 1;
      cards = [...stage.querySelectorAll<HTMLElement>(".hp-fall")]
        .filter((el) => getComputedStyle(el).display !== "none")
        .map((el) => {
          const c = old.get(el) ?? { el, left: 0, top: 0, w: 0, h: 0, r: 0, x: 0, y: 0, vx: 0, vy: 0 };
          const lift = (parseFloat(getComputedStyle(el).getPropertyValue("--lift")) || 0) * scale;
          c.left = el.offsetLeft;
          c.w = el.offsetWidth;
          c.h = el.offsetHeight;
          c.top = height - c.h - lift;          // resting on the line
          c.r = 0.42 * Math.sqrt(c.w * c.h);    // cards overlap a little, like a real heap
          return c;
        });
    };
    measure();

    // However the phone is held when the game starts counts as level
    // (set from the first sensor reading, which can arrive a moment later).
    let neutral: number | null = tilt.current ? clamp(tilt.current.y, 10, 80) : null;

    let frame = 0;
    let running = false;
    let visible = true;
    let still = 0;
    let sleptAt: Tilt | null = null;
    let last = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) { running = false; return; }

      if (neutral === null) {
        if (!tilt.current) { running = false; return; } // woken by the first reading
        neutral = clamp(tilt.current.y, 10, 80);
      }
      const t = tilt.current ?? { x: 0, y: neutral };
      const before = cards.map((c) => [c.x, c.y]);
      const moving = step(cards, acceleration(t, neutral), width, dt);

      let shift = 0;
      cards.forEach((c, i) => {
        shift = Math.max(shift, Math.abs(c.x - before[i][0]), Math.abs(c.y - before[i][1]));
        c.el.style.translate = `${c.x.toFixed(1)}px ${c.y.toFixed(1)}px`;
        c.el.style.rotate = `${clamp(c.vx * 0.012, -12, 12).toFixed(2)}deg`;
      });

      // Sleep once nothing visibly moves (also covers cards pressed against an edge).
      still = !moving || shift < 0.1 ? still + 1 : 0;
      if (still >= STILL_FRAMES) {
        running = false;
        sleptAt = { ...t };
        return;
      }
      frame = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running || !visible) return;
      running = true;
      still = 0;
      last = performance.now();
      frame = requestAnimationFrame(loop);
    };

    wake.current = () => {
      if (running) return;
      const t = tilt.current;
      if (sleptAt && t && Math.abs(t.x - sleptAt.x) < WAKE_DEG && Math.abs(t.y - sleptAt.y) < WAKE_DEG) return;
      sleptAt = null;
      start();
    };

    const onResize = () => { measure(); sleptAt = null; start(); };
    window.addEventListener("resize", onResize);

    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) { sleptAt = null; start(); }
    });
    seen.observe(stage);

    // A card that is still sliding doesn't open its link: taps on moving cards
    // are almost always accidental.
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>(".hp-fall");
      const card = el && cards.find((c) => c.el === el);
      if (card && isMoving(card)) { e.preventDefault(); e.stopPropagation(); }
    };
    stage.addEventListener("click", onClick, true);

    start();

    return () => {
      cancelAnimationFrame(frame);
      wake.current = null;
      seen.disconnect();
      window.removeEventListener("resize", onResize);
      stage.removeEventListener("click", onClick, true);
      stage.classList.remove("hp-tilting");
      for (const c of cards) { c.el.style.translate = ""; c.el.style.rotate = ""; }
    };
  }, [mode]);

  async function play() {
    if (needsPermission()) {
      try {
        const request = (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission;
        if ((await request()) !== "granted") { setMode("off"); return; }
      } catch {
        setMode("off");
        return;
      }
    }
    remember(true);
    setMode("on");
  }

  function stop() {
    remember(false);
    setMode("ask");
  }

  return (
    <span ref={anchor} className="hp-tilt">
      {mode === "ask" && (
        <button type="button" className="hp-tilt-btn" onClick={play}>Tilt to play <span aria-hidden="true">✨</span></button>
      )}
      {mode === "on" && (
        <button type="button" className="hp-tilt-btn" onClick={stop}>Stop tilting</button>
      )}
    </span>
  );
}
