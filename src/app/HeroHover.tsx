"use client";

import { useEffect } from "react";

// Mouse effect for the home page cards (computers only). As the pointer comes near a card, the card
// leans towards it, lifts a little and grows slightly; moving away lets it settle back. It works
// on the inner .hp-card, so the drop animation and the phone tilt game (which move .hp-fall) are
// untouched. Touch screens and visitors who prefer reduced motion get nothing.

const RADIUS = 260;   // px around the pointer that a card responds within
const LEAN_DEG = 7;   // most a card leans towards the pointer
const LIFT_PX = 16;   // most a card rises
const PULL = 0.07;    // share of the distance a card moves towards the pointer
const GROW = 0.05;    // most a card grows

const ease = (t: number) => t * t * (3 - 2 * t); // smoothstep: soft at both ends

export default function HeroHover() {
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stage = document.querySelector<HTMLElement>(".hp-stage");
    if (!stage || !fine.matches || calm.matches) return;

    const cards = [...stage.querySelectorAll<HTMLElement>(".hp-fall")].map((fall) => ({
      fall,
      card: fall.querySelector<HTMLElement>(".hp-card"),
      landed: false,
    }));
    // A card joins in once its drop has finished, so the effect never fights the fall.
    const onLanded = (e: AnimationEvent) => {
      const c = cards.find((x) => x.fall === e.target);
      if (c) c.landed = true;
    };
    stage.addEventListener("animationend", onLanded);
    const fallback = window.setTimeout(() => cards.forEach((c) => (c.landed = true)), 5000);

    let pointer: { x: number; y: number } | null = null;
    let frame = 0;

    const render = () => {
      frame = 0;
      for (const { fall, card, landed } of cards) {
        if (!card || !landed) continue;
        // Playing the tilt game: leave the cards to it.
        if (stage.classList.contains("hp-tilting") || !pointer) {
          card.style.transform = "";
          card.classList.remove("hp-near");
          continue;
        }
        const r = fall.getBoundingClientRect();
        const dx = pointer.x - (r.left + r.width / 2);
        const dy = pointer.y - (r.top + r.height / 2);
        const t = ease(Math.max(0, 1 - Math.hypot(dx, dy) / RADIUS));
        if (t <= 0) {
          card.style.transform = "";
          card.classList.remove("hp-near");
          continue;
        }
        const lean = Math.max(-1, Math.min(1, dx / RADIUS)) * LEAN_DEG * t;
        card.style.transform =
          `translate(${(dx * PULL * t).toFixed(1)}px, ${(-LIFT_PX * t + dy * PULL * t * 0.5).toFixed(1)}px) ` +
          `rotate(${lean.toFixed(2)}deg) scale(${(1 + GROW * t).toFixed(3)})`;
        card.classList.toggle("hp-near", t > 0.5);
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      const s = stage.getBoundingClientRect();
      const inside = e.clientX >= s.left && e.clientX <= s.right && e.clientY >= s.top - 40 && e.clientY <= s.bottom;
      pointer = inside ? { x: e.clientX, y: e.clientY } : null;
      schedule();
    };
    const onLeave = () => { pointer = null; schedule(); };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      window.clearTimeout(fallback);
      cancelAnimationFrame(frame);
      stage.removeEventListener("animationend", onLanded);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", schedule);
      for (const { card } of cards) { if (card) { card.style.transform = ""; card.classList.remove("hp-near"); } }
    };
  }, []);

  return null;
}
