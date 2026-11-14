"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

// A titled row of cards that scrolls sideways: swipe or trackpad, or the arrow buttons, which
// move one screenful and switch off at either end.
export default function Rail({ title, id, more, children }: { title: string; id: string; more?: { href: string; label: string }; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [ends, setEnds] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEnds({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    measure();
    const el = track.current;
    if (!el) return;
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    return () => resize.disconnect();
  }, [measure]);

  function move(direction: 1 | -1) {
    const el = track.current;
    if (!el) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: smooth ? "smooth" : "auto" });
  }

  return (
    <section className="dc-rail" aria-labelledby={id}>
      <div className="dc-rail-head">
        <h2 id={id}>{title}</h2>
        <div className="dc-rail-side">
        {more && <Link href={more.href} className="dc-link">{more.label}</Link>}
        {!(ends.start && ends.end) && (
          <div className="dc-rail-arrows">
            <button type="button" aria-label={`Previous: ${title}`} onClick={() => move(-1)} disabled={ends.start}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <button type="button" aria-label={`Next: ${title}`} onClick={() => move(1)} disabled={ends.end}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
        )}
        </div>
      </div>
      <div className="dc-rail-track" ref={track} onScroll={measure}>
        {children}
      </div>
    </section>
  );
}
