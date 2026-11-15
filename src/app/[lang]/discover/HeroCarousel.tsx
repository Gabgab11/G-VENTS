"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type HeroSlide = {
  slug: string;
  title: string;
  category: string;
  when: string;
  place: string;
  coverUrl: string | null;
  background: string;
  shareUrl: string;
};

const INTERVAL_MS = 7000;

function share(slide: HeroSlide) {
  const text = `${slide.title} on G-ventZ`;
  return [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${text} ${slide.shareUrl}`)}`, icon: <path d="M3 21l1.6-4.7A8.5 8.5 0 1 1 7.8 19.5zM8.5 9.5c0 3 3 6 6 6l1.4-1.4-2-1-1 .8a5 5 0 0 1-2.3-2.3l.8-1-1-2z" /> },
    { label: "X", href: `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(slide.shareUrl)}`, icon: <path d="M4 4l16 16M20 4L4 20" /> },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(slide.shareUrl)}`, icon: <path d="M14.5 21v-8h2.7l.4-3.2h-3.1V7.9c0-.9.3-1.6 1.6-1.6h1.6V3.5a21 21 0 0 0-2.4-.1c-2.4 0-4 1.4-4 4.1v2.3H8.6V13h2.7v8" /> },
  ];
}

// Full-width showcase of upcoming events. It moves on every few seconds, pauses while the pointer
// or keyboard focus is on it, and never moves on its own with reduced motion.
export default function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(true);
  const root = useRef<HTMLElement>(null);
  const count = slides.length;

  useEffect(() => setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused || still) return;
    const timer = window.setTimeout(() => go(index + 1), INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [index, paused, still, count, go]);

  return (
    <section
      ref={root}
      className="dc-hero"
      aria-roledescription="carousel"
      aria-label="Featured events"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false); }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
    >
      {slides.map((s, i) => (
        <article
          key={s.slug}
          className={`dc-slide ${i === index ? "on" : ""}`}
          aria-roledescription="slide"
          aria-label={`${i + 1} of ${count}: ${s.title}`}
          aria-hidden={i !== index}
          inert={i !== index}
          style={{ background: s.background }}
        >
          {/* Flyers are usually tall posters: shown whole on the right, over a blurred copy of themselves. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- flyers come from Supabase Storage at arbitrary sizes */}
          {s.coverUrl && <img className="dc-slide-bg" src={s.coverUrl} alt="" aria-hidden="true" loading={i === 0 ? "eager" : "lazy"} />}
          <div className="dc-slide-poster" style={{ background: s.background }} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
            {s.coverUrl ? <img src={s.coverUrl} alt="" loading={i === 0 ? "eager" : "lazy"} /> : <span>{s.title}</span>}
          </div>
          <div className="dc-slide-body">
            <span className="dc-slide-cat">{s.category}</span>
            <h2 className="dc-slide-title">{s.title}</h2>
            <p className="dc-slide-meta">{[s.when, s.place].filter(Boolean).join(" · ")}</p>
            <div className="dc-slide-actions">
              <Link href={`/e/${s.slug}`} className="dc-slide-cta">Get tickets</Link>
              <div className="dc-share" aria-label="Share">
                {share(s).map((x) => (
                  <a key={x.label} href={x.href} target="_blank" rel="noopener noreferrer" aria-label={`Share on ${x.label}`} title={`Share on ${x.label}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{x.icon}</svg>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </article>
      ))}
      {count > 1 && (
        <div className="dc-dots" role="group" aria-label="Choose a featured event">
          {slides.map((s, i) => (
            <button key={s.slug} type="button" className={i === index ? "on" : ""} aria-label={`Show ${s.title}`} aria-current={i === index}
              onClick={() => go(i)}>
              <span className={i === index && !paused && !still ? "run" : undefined} style={{ ["--dc-dur" as string]: `${INTERVAL_MS}ms` }} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
