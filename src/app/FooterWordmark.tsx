"use client";

import { useEffect, useRef } from "react";

const LETTERS = ["G", "-", "v", "e", "n", "t", "Z"];
const STAGGER = 0.08; // how far behind the previous letter each one starts, as a share of the scroll

const clamp = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// The big footer wordmark. The letters rise into place as you scroll down to the footer, one after
// another, and sink back as you scroll up: the scroll position drives them, not a timer. They are
// fully in place by the time the page can't scroll any further. Without JavaScript, or with
// reduced motion, the wordmark simply shows.
export default function FooterWordmark() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const letters = Array.from(el.querySelectorAll<HTMLElement>("span"));
    const window_ = 1 - STAGGER * (letters.length - 1);
    let frame = 0;

    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      const top = el.getBoundingClientRect().top;
      // Where the wordmark's top will be at the very bottom of the page, so the rise always finishes.
      const maxScroll = document.documentElement.scrollHeight - vh;
      const topAtEnd = top - (maxScroll - window.scrollY);
      const endTop = Math.max(topAtEnd, vh * 0.2);
      const progress = clamp((vh - top) / Math.max(1, vh - endTop));
      letters.forEach((letter, i) => {
        const t = easeOut(clamp((progress - i * STAGGER) / window_));
        const tilt = letter.classList.contains("wm-z") ? ` rotate(${(1 - t) * -14}deg)` : "";
        letter.style.transform = `translateY(${(1 - t) * 105}%)${tilt}`;
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div ref={ref} className="hp-footer-wordmark" aria-hidden="true">
      {LETTERS.map((letter, i) => (
        <span key={i} className={letter === "Z" ? "wm-z" : undefined}>{letter}</span>
      ))}
    </div>
  );
}
