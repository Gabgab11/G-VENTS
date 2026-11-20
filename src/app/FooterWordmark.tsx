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
  const fitRef = useRef<HTMLSpanElement>(null);

  // Edge to edge: the G starts at the left edge and the Z ends at the right, at any width. The
  // font size is scaled so the word exactly fills the footer (the CSS size is only the first guess).
  useEffect(() => {
    const el = ref.current;
    const word = fitRef.current;
    if (!el || !word) return;
    let frame = 0;
    const fit = () => {
      frame = 0;
      el.style.fontSize = "";
      const style = getComputedStyle(el);
      const room = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const width = word.getBoundingClientRect().width;
      if (room > 0 && width > 0) el.style.fontSize = `${(parseFloat(style.fontSize) * room) / width}px`;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(fit); };
    fit();
    document.fonts?.ready.then(schedule).catch(() => {});
    window.addEventListener("resize", schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", schedule); };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const letters = Array.from(el.querySelectorAll<HTMLElement>(".wm-fit > span"));
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
    <div ref={ref} className="hp-footer-wordmark" aria-hidden="true" dir="ltr">
      <span ref={fitRef} className="wm-fit">
        {LETTERS.map((letter, i) => (
          <span key={i} className={letter === "Z" ? "wm-z" : undefined}>{letter}</span>
        ))}
      </span>
    </div>
  );
}
