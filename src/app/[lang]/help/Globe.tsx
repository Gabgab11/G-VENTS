"use client";

import { useEffect, useRef } from "react";
import styles from "./help.module.css";

// The Help page's globe: real land (Natural Earth, public domain) as dots on a turning 3D sphere,
// with a map pin hopping city to city across every continent and back to Lagos, on a loop.
// Drawn on a canvas; the land dots (public/globe-land.json, ~43 KB) load only once it's on screen.
// Reduced motion: one still frame centred on Lagos. Off screen or in a hidden tab, it pauses.

export type GlobeStop = { lon: number; lat: number; label: string };

type Vec = [number, number, number];
const RAD = Math.PI / 180;
const toVec = (lon: number, lat: number): Vec => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];
const toLonLat = ([x, y, z]: Vec): [number, number] => [Math.atan2(y, x) / RAD, Math.asin(Math.max(-1, Math.min(1, z))) / RAD];
/** Spherical interpolation between two unit vectors (the great-circle path). */
export function slerp(a: Vec, b: Vec, t: number): Vec {
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-6) return a;
  const s = Math.sin(omega);
  const ka = Math.sin((1 - t) * omega) / s, kb = Math.sin(t * omega) / s;
  return [ka * a[0] + kb * b[0], ka * a[1] + kb * b[1], ka * a[2] + kb * b[2]];
}
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** A CSS colour as [r, g, b], read back through a canvas (which normalises any CSS colour). */
function rgbOf(ctx: CanvasRenderingContext2D, css: string): [number, number, number] {
  ctx.fillStyle = "transparent";
  ctx.fillStyle = css;
  const v = String(ctx.fillStyle);
  if (v.startsWith("#")) return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)];
  const m = v.match(/[\d.]+/g) ?? ["0", "0", "0"];
  return [Number(m[0]), Number(m[1]), Number(m[2])];
}
/** `a` mixed into `b` by p (0..1), with alpha. */
export const mixRgb = (a: [number, number, number], b: [number, number, number], p: number, alpha = 1) =>
  `rgba(${Math.round(a[0] * p + b[0] * (1 - p))}, ${Math.round(a[1] * p + b[1] * (1 - p))}, ${Math.round(a[2] * p + b[2] * (1 - p))}, ${alpha})`;

const TRAVEL = 2600; // ms between cities
const DWELL = 1500; // ms the pin rests on a city

export default function Globe({ stops, label }: { stops: GlobeStop[]; label: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const tagRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = canvas.current, box = wrap.current;
    if (!el || !box || stops.length === 0) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let land: number[] | null = null, frame = 0, visible = false, started = 0, size = 0, dpr = 1, stopped = false;
    // The camera lags behind the pin a little, so you see the pin travel and the globe catch up.
    let cam: Vec = toVec(stops[0].lon, stops[0].lat);
    const colours = () => {
      const cs = getComputedStyle(box);
      const read = (name: string) => rgbOf(ctx, cs.getPropertyValue(name).trim());
      const accent = read("--color-accent"), muted = read("--color-text-muted"), border = read("--color-border"), surface = read("--color-surface");
      return {
        accentRgb: accent, mutedRgb: muted, surfaceRgb: surface,
        accent: mixRgb(accent, accent, 1), muted: mixRgb(muted, muted, 1), border: mixRgb(border, border, 1), surface: mixRgb(surface, surface, 1),
      };
    };
    let c = colours();

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = box.clientWidth;
      el.width = Math.round(size * dpr);
      el.height = Math.round(size * dpr);
    };

    function project(v: Vec, centre: Vec, r: number, cx: number, cy: number): [number, number, number] {
      const [lon0, lat0] = toLonLat(centre), [lon, lat] = toLonLat(v);
      const dl = (lon - lon0) * RAD, p = lat * RAD, p0 = lat0 * RAD;
      const depth = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(dl);
      const x = Math.cos(p) * Math.sin(dl), y = Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(dl);
      return [cx + r * x, cy - r * y, depth];
    }

    function draw(now: number) {
      if (!ctx || !size) return;
      const W = size * dpr, r = W * 0.42, cx = W / 2, cy = W / 2;
      // Where the pin is on its route.
      const leg = TRAVEL + DWELL, total = leg * stops.length;
      // A frame timestamp can be slightly earlier than the start time: never go below 0.
      const t = still ? 0 : Math.max(0, now - started) % total;
      const i = Math.min(stops.length - 1, Math.floor(t / leg)), into = t - i * leg;
      const from = stops[i], to = stops[(i + 1) % stops.length];
      const a = toVec(from.lon, from.lat), b = toVec(to.lon, to.lat);
      const travelling = into < TRAVEL && !still;
      const k = travelling ? ease(into / TRAVEL) : 1;
      const pin = travelling ? slerp(a, b, k) : b;
      const atCity = travelling ? null : to;
      if (still) cam = toVec(stops[0].lon, stops[0].lat);
      else cam = slerp(cam, pin, 0.045);

      ctx.clearRect(0, 0, W, W);
      // Atmosphere and sphere.
      const glow = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.18);
      glow.addColorStop(0, mixRgb(c.accentRgb, c.accentRgb, 1, 0.18));
      glow.addColorStop(1, mixRgb(c.accentRgb, c.accentRgb, 1, 0));
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.18, 0, Math.PI * 2); ctx.fill();
      const body = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
      body.addColorStop(0, mixRgb(c.accentRgb, c.surfaceRgb, 0.1));
      body.addColorStop(1, c.surface);
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = c.border; ctx.lineWidth = 1 * dpr; ctx.stroke();

      // Land dots: brighter facing you, warmer near the pin.
      if (land) {
        const dot = Math.max(1, r * 0.0105);
        for (let j = 0; j < land.length; j += 2) {
          const v = toVec(land[j], land[j + 1]);
          const [x, y, d] = project(v, cam, r, cx, cy);
          if (d <= 0) continue;
          const near = v[0] * pin[0] + v[1] * pin[1] + v[2] * pin[2]; // 1 at the pin
          const warm = Math.max(0, (near - 0.82) / 0.18);
          ctx.globalAlpha = 0.25 + 0.75 * d;
          ctx.fillStyle = warm > 0 ? mixRgb(c.accentRgb, c.mutedRgb, 0.45 + 0.55 * warm) : c.muted;
          ctx.beginPath(); ctx.arc(x, y, dot * (0.7 + 0.3 * d), 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // The route: a raised arc from the last city to the next, drawn up to the pin.
      if (travelling) {
        ctx.strokeStyle = c.accent; ctx.lineWidth = 1.6 * dpr; ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.beginPath();
        let started = false;
        for (let s = 0; s <= 40; s++) {
          const f = (s / 40) * k, lift = 1 + 0.12 * Math.sin(Math.PI * (s / 40));
          const [x, y, d] = project(slerp(a, b, f), cam, r * lift, cx, cy);
          if (d <= -0.1) { started = false; continue; }
          if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke(); ctx.setLineDash([]);
      }

      // The pin: a teardrop marker, lifted while it flies, with pulses when it lands.
      const lift = travelling ? 1 + 0.12 * Math.sin(Math.PI * k) : 1;
      const [px, py, pd] = project(pin, cam, r * lift, cx, cy);
      if (pd > 0) {
        if (!travelling) {
          const phase = still ? 0.4 : ((now - started) % 1400) / 1400;
          for (const off of [0, 0.5]) {
            const q = (phase + off) % 1;
            ctx.strokeStyle = c.accent; ctx.globalAlpha = 1 - q; ctx.lineWidth = 1.5 * dpr;
            ctx.beginPath(); ctx.ellipse(px, py, r * 0.02 + q * r * 0.09, (r * 0.02 + q * r * 0.09) * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
        const h = r * 0.11, w = h * 0.62, top = py - h;
        ctx.fillStyle = c.muted; ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.ellipse(px, py, w * 0.32, w * 0.12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = c.accent;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.bezierCurveTo(px - w * 0.15, py - h * 0.3, px - w / 2, top + w * 0.55, px - w / 2, top + w / 2);
        ctx.arc(px, top + w / 2, w / 2, Math.PI, 0);
        ctx.bezierCurveTo(px + w / 2, top + w * 0.55, px + w * 0.15, py - h * 0.3, px, py);
        ctx.fill();
        ctx.fillStyle = c.surface;
        ctx.beginPath(); ctx.arc(px, top + w / 2, w * 0.2, 0, Math.PI * 2); ctx.fill();
      }
      // The city's name in an HTML pill (crisp text, the page's language and direction).
      const tag = tagRef.current;
      if (tag) {
        const text = (atCity ?? from).label;
        if (tag.textContent !== text) tag.textContent = text;
        tag.style.transform = `translate(${(px / dpr).toFixed(1)}px, ${((py - r * 0.11) / dpr).toFixed(1)}px) translate(-50%, -130%)`;
        if (pd > 0 && !travelling) tag.dataset.shown = ""; else delete tag.dataset.shown;
      }
    }

    const loop = (now: number) => {
      if (stopped) return;
      draw(now);
      if (!still && visible && !document.hidden) frame = requestAnimationFrame(loop);
    };
    const start = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(loop); };

    resize();
    const ro = new ResizeObserver(() => { resize(); c = colours(); start(); });
    ro.observe(box);
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible && !land) {
        fetch("/globe-land.json").then((r) => r.json()).then((d: number[]) => { land = d; start(); }).catch(() => {});
      }
      if (visible) start();
    }, { rootMargin: "200px" });
    io.observe(box);
    const onVis = () => { if (!document.hidden) start(); };
    document.addEventListener("visibilitychange", onVis);
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => { c = colours(); start(); };
    scheme.addEventListener("change", onScheme);
    started = performance.now();
    start();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      ro.disconnect(); io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      scheme.removeEventListener("change", onScheme);
    };
  }, [stops]);

  return (
    <div ref={wrap} className={styles.globe} role="img" aria-label={label} dir="ltr">
      <canvas ref={canvas} className={styles.globeCanvas} aria-hidden="true" />
      <span ref={tagRef} className={styles.globeTag} aria-hidden="true">{stops[0]?.label}</span>
    </div>
  );
}
