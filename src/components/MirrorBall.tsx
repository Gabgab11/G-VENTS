"use client";

import { useEffect, useRef } from "react";

// A mirror ball drawn from small lit tiles on a canvas. It drops in, bounces once, then turns slowly.
// Reduced motion: drawn once, still. No JavaScript: the golden fallback ball shows.

type Tile = { lat0: number; lat1: number; lon0: number; lon1: number; shade: number; glint: number; speed: number };
type Pt = { x: number; y: number; z: number; nx: number; ny: number; nz: number };

function normalize(v: number[]): number[] {
  const m = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return [v[0] / m, v[1] / m, v[2] / m];
}

export default function MirrorBall() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let R = 0, CX = 0, CY = 0, raf = 0, last = 0, t = 0, yaw = 0;

    // Tiles: rows of latitude, more tiles near the equator
    const ROWS = 18;
    const tiles: Tile[] = [];
    for (let r = 0; r < ROWS; r++) {
      const lat0 = Math.PI * (r / ROWS - 0.5);
      const lat1 = Math.PI * ((r + 1) / ROWS - 0.5);
      const cols = Math.max(6, Math.round(ROWS * 2 * Math.cos((lat0 + lat1) / 2)));
      for (let c = 0; c < cols; c++) {
        tiles.push({
          lat0, lat1,
          lon0: (2 * Math.PI * c) / cols,
          lon1: (2 * Math.PI * (c + 1)) / cols,
          shade: 0.35 + Math.random() * 0.65,
          glint: Math.random() * Math.PI * 2,
          speed: 0.8 + Math.random() * 1.6,
        });
      }
    }

    const L = normalize([-0.55, 0.65, 0.55]); // warm key light from top-left
    const H = normalize([-0.2, 0.3, 1]);      // highlight direction

    const point = (lat: number, lon: number) => [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];

    function view(p: number[], tilt: number): Pt {
      const x = p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw);
      let z = -p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw);
      const y = p[1] * Math.cos(tilt) - z * Math.sin(tilt);
      z = p[1] * Math.sin(tilt) + z * Math.cos(tilt);
      return { x: CX + x * R, y: CY - y * R, z, nx: x, ny: y, nz: z };
    }

    const dot = (p: Pt, v: number[]) => p.nx * v[0] + p.ny * v[1] + p.nz * v[2];

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(rect.width * dpr);
      canvas!.height = Math.round(rect.height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      CX = rect.width / 2;
      CY = rect.height / 2;
      R = (rect.width / 2) * 0.98;
    }

    function draw(now: number) {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      t += dt;
      if (!reduce) yaw += dt * 0.35;

      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      const tilt = -0.28;

      for (const tl of tiles) {
        const a = view(point(tl.lat0, tl.lon0), tilt);
        const b = view(point(tl.lat0, tl.lon1), tilt);
        const c = view(point(tl.lat1, tl.lon1), tilt);
        const d = view(point(tl.lat1, tl.lon0), tilt);
        const mid = view(point((tl.lat0 + tl.lat1) / 2, (tl.lon0 + tl.lon1) / 2), tilt);
        if (mid.z <= 0.02) continue; // back side is hidden

        const diff = Math.max(0, dot(mid, L));
        const spec = Math.pow(Math.max(0, dot(mid, H)), 18);
        const glint = Math.pow(Math.max(0, Math.sin(tl.glint + t * tl.speed)), 22);
        const base = tl.shade * (0.12 + 0.88 * diff);

        const rr = Math.min(255, 255 * base * 0.95 + 255 * (spec * 0.5 + glint));
        const gg = Math.min(255, 205 * base * 0.9 + 230 * (spec * 0.5 + glint));
        const bb = Math.min(255, 120 * base * 0.7 + 190 * (spec * 0.4 + glint));

        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.lineTo(c.x, c.y);
        ctx!.lineTo(d.x, d.y);
        ctx!.closePath();
        ctx!.fillStyle = `rgb(${rr | 0},${gg | 0},${bb | 0})`;
        ctx!.fill();
        ctx!.lineWidth = 0.6;
        ctx!.strokeStyle = "rgba(20,12,4,0.55)";
        ctx!.stroke();
      }

      // Edge shading so the sphere reads as round
      const g = ctx!.createRadialGradient(CX - R * 0.35, CY - R * 0.4, R * 0.1, CX, CY, R);
      g.addColorStop(0, "rgba(255,240,200,0.18)");
      g.addColorStop(0.7, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.75)");
      ctx!.fillStyle = g;
      ctx!.beginPath();
      ctx!.arc(CX, CY, R, 0, Math.PI * 2);
      ctx!.fill();

      if (!reduce) raf = requestAnimationFrame(draw);
    }

    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
      } else if (!reduce && !raf) {
        raf = requestAnimationFrame(draw);
      }
    }

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    if (reduce) draw(0);
    else raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="ball-stage" aria-hidden="true">
      <div className="ball-drop">
        <div className="ball-string" />
        <div className="ball-wrap">
          <canvas ref={canvasRef} />
        </div>
      </div>
      <div className="ball-glow" />
    </div>
  );
}
