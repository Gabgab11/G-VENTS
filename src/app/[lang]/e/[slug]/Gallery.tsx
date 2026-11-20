"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "@/design";
import { frameRatio, swipeStep, thumbStrip, wrap } from "./gallery";
import s from "./Gallery.module.css";

type Picture = { url: string; width: number | null; height: number | null };

// The event page's pictures when there are two or more (chunk 3c): the main picture large with
// arrows, thumbnails below (dots and swipe on phones), Left/Right keys while it has focus. Only the
// first picture loads with the page; the others once someone reaches for the gallery.
export default function Gallery({ pictures, title }: { pictures: Picture[]; title: string }) {
  const t = useTranslations("event.page.gallery");
  const [active, setActive] = useState(0);
  // Set on the first hover, focus or touch: the other pictures start loading before they're shown.
  const [warm, setWarm] = useState(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const total = pictures.length;
  const rtl = () => !!root.current && getComputedStyle(root.current).direction === "rtl";
  const go = (index: number) => { setWarm(true); setActive(wrap(index, 0, total)); };
  const move = (delta: number) => go(active + delta);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const towardsEnd = (e.key === "ArrowRight") !== rtl();
    move(towardsEnd ? 1 : -1);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    setWarm(true);
    if (e.pointerType === "mouse") return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const from = start.current;
    start.current = null;
    if (!from || from.id !== e.pointerId) return;
    const step = swipeStep(e.clientX - from.x, e.clientY - from.y, rtl());
    if (step) move(step);
  }

  const first = pictures[0]!;
  const position = (i: number) => t("position", { number: i + 1, total });

  return (
    <div
      ref={root}
      className={s.gallery}
      role="region"
      aria-roledescription={t("roleDescription")}
      aria-label={t("label", { title })}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onFocus={() => setWarm(true)}
      onPointerEnter={() => setWarm(true)}
    >
      <div
        className={s.frame}
        style={{ aspectRatio: String(frameRatio(first.width, first.height)) }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { start.current = null; }}
      >
        <div className={s.track} style={{ "--gallery-index": active } as React.CSSProperties}>
          {pictures.map((p, i) => (
            <div key={p.url} className={s.slide} aria-hidden={i !== active || undefined}>
              {/* eslint-disable-next-line @next/next/no-img-element -- pictures come from storage at arbitrary sizes */}
              <img
                src={p.url}
                alt={t("alt", { number: i + 1, total, title })}
                loading={i === 0 || warm ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "low"}
                decoding="async"
                draggable={false}
                width={p.width ?? undefined}
                height={p.height ?? undefined}
              />
            </div>
          ))}
        </div>
        <button type="button" className={cx(s.arrow, s.prev)} onClick={() => move(-1)} aria-label={t("previous")}>
          <ChevronLeft size={20} strokeWidth={1.75} aria-hidden />
        </button>
        <button type="button" className={cx(s.arrow, s.next)} onClick={() => move(1)} aria-label={t("next")}>
          <ChevronRight size={20} strokeWidth={1.75} aria-hidden />
        </button>
        <p className="sr-only" aria-live="polite">{position(active)}</p>
      </div>

      <div className={s.thumbs}>
        {thumbStrip(total, active).map((th) => (
          <button
            key={th.index}
            type="button"
            className={cx(s.thumb, th.active && s.thumbActive)}
            onClick={() => go(th.index)}
            aria-label={th.more ? t("showMore", { number: th.index + 1, total, count: th.more }) : t("show", { number: th.index + 1, total })}
            aria-current={th.active || undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a small copy of the picture above */}
            <img src={pictures[th.index]!.url} alt="" loading="lazy" decoding="async" draggable={false} />
            {th.more > 0 && <span className={s.more} aria-hidden>{`+${th.more}`}</span>}
          </button>
        ))}
      </div>

      <div className={s.dots}>
        {pictures.map((p, i) => (
          <button key={p.url} type="button" className={cx(s.dot, i === active && s.dotActive)} onClick={() => go(i)}
            aria-label={t("show", { number: i + 1, total })} aria-current={i === active || undefined} />
        ))}
      </div>
    </div>
  );
}
