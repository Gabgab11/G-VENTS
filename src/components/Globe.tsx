"use client";

import { useEffect, useRef } from "react";

type Pin = { name: string; lat: number; lon: number; events: number };

// Sample pins for launch. Later these come from the database (events grouped by city).
export const CITY_PINS: Pin[] = [
  { name: "Lagos", lat: 6.5244, lon: 3.3792, events: 42 },
  { name: "London", lat: 51.5072, lon: -0.1276, events: 31 },
  { name: "New York", lat: 40.7128, lon: -74.006, events: 27 },
  { name: "Nairobi", lat: -1.2921, lon: 36.8219, events: 19 },
  { name: "Accra", lat: 5.6037, lon: -0.187, events: 14 },
  { name: "São Paulo", lat: -23.5505, lon: -46.6333, events: 16 },
  { name: "Cairo", lat: 30.0444, lon: 31.2357, events: 12 },
  { name: "Mumbai", lat: 19.076, lon: 72.8777, events: 13 },
  { name: "Dubai", lat: 25.2048, lon: 55.2708, events: 11 },
  { name: "Tokyo", lat: 35.6762, lon: 139.6503, events: 9 },
  { name: "Toronto", lat: 43.6532, lon: -79.3832, events: 8 },
  { name: "Sydney", lat: -33.8688, lon: 151.2093, events: 7 },
];

function toXYZ(lat: number, lon: number): [number, number, number] {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
}

function rotate(p: [number, number, number], rotY: number, rotX: number): [number, number, number] {
  const cy = Math.cos(rotY), sy = Math.sin(rotY);
  const x = p[0] * cy + p[2] * sy;
  const z = -p[0] * sy + p[2] * cy;
  const cx = Math.cos(rotX), sx = Math.sin(rotX);
  const y2 = p[1] * cx - z * sx;
  const z2 = p[1] * sx + z * cx;
  return [x, y2, z2];
}

export default function Globe({ onPinSelect }: { onPinSelect?: (pin: Pin) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const N = 900;
    const dots: [number, number, number][] = [];
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = i * Math.PI * (3 - Math.sqrt(5));
      dots.push([Math.cos(t) * r, y, Math.sin(t) * r]);
    }

    let w = 0, h = 0;
    let rotY = 0.6, rotX = 0.35;
    let dragging = false, lastX = 0, lastY = 0;
    let view: { sx: number; sy: number; pin: Pin; r: number }[] = [];
    let raf = 0;

    function size() {
      const rect = canvas!.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas!.width = w * dpr; canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(t: number) {
      ctx!.clearRect(0, 0, w, h);
      const R = Math.min(w, h) * 0.42;
      const cx = w / 2, cy = h / 2;

      const g = ctx!.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.25);
      g.addColorStop(0, "rgba(224,67,143,0.10)");
      g.addColorStop(0.6, "rgba(242,163,58,0.05)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, w, h);

      for (const d of dots) {
        const p = rotate(d, rotY, rotX);
        if (p[2] < -0.05) continue;
        ctx!.beginPath();
        ctx!.arc(cx + p[0] * R, cy + p[1] * R, 1.1 + p[2] * 0.6, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(200,200,210,${(0.12 + p[2] * 0.55).toFixed(3)})`;
        ctx!.fill();
      }

      view = [];
      CITY_PINS.forEach((pin, i) => {
        const p = rotate(toXYZ(pin.lat, pin.lon), rotY, rotX);
        if (p[2] < 0) return;
        const sx = cx + p[0] * R, sy = cy + p[1] * R;
        const size = 3 + Math.min(pin.events, 40) / 12;
        const phase = ((t / 1200) + i * 0.17) % 1;
        ctx!.beginPath();
        ctx!.arc(sx, sy, size + phase * 14, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(242,163,58,${(0.6 * (1 - phase)).toFixed(3)})`;
        ctx!.lineWidth = 1.5;
        ctx!.stroke();

        const pg = ctx!.createLinearGradient(sx - size, sy, sx + size, sy);
        pg.addColorStop(0, "#e0438f");
        pg.addColorStop(0.5, "#f0604f");
        pg.addColorStop(1, "#f2a33a");
        ctx!.beginPath();
        ctx!.arc(sx, sy, size, 0, Math.PI * 2);
        ctx!.fillStyle = pg;
        ctx!.fill();

        view.push({ sx, sy, pin, r: Math.max(size, 14) });
      });
    }

    function loop(t: number) {
      if (!dragging && !reduce) rotY += 0.0025;
      draw(t);
      raf = requestAnimationFrame(loop);
    }

    function onDown(e: PointerEvent) {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      canvas!.setPointerCapture(e.pointerId);
    }
    function onMove(e: PointerEvent) {
      if (!dragging) return;
      rotY += (e.clientX - lastX) * 0.008;
      rotX = Math.max(-0.9, Math.min(0.9, rotX + (e.clientY - lastY) * 0.005));
      lastX = e.clientX; lastY = e.clientY;
    }
    function onUp(e: PointerEvent) {
      const moved = Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
      dragging = false;
      const r = canvas!.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      let best: (typeof view)[number] | null = null;
      let bd = Infinity;
      for (const v of view) {
        const d = Math.hypot(v.sx - px, v.sy - py);
        if (d < v.r && d < bd) { best = v; bd = d; }
      }
      if (best && moved < 6 && onPinSelect) onPinSelect(best.pin);
    }

    // Only animate while the globe is on screen and the tab is visible.
    let onScreen = true;
    function sync() {
      cancelAnimationFrame(raf);
      if (onScreen && !document.hidden) raf = requestAnimationFrame(loop);
    }
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    window.addEventListener("resize", size);
    document.addEventListener("visibilitychange", sync);
    observer.observe(canvas);
    size();
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", size);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [onPinSelect]);

  return (
    <div className="globe-wrap">
      <canvas ref={canvasRef} role="img" aria-label="Globe showing where G-vents events are happening" />
    </div>
  );
}
