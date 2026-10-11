"use client";

import { useEffect, useRef } from "react";
import { THEMES } from "@/lib/themes";

type P = { x: number; y: number; vx: number; vy: number; r: number; ph: number; c: string };


// A small Santa running across the bottom of the screen, with snow falling around him.
function drawSantaRun(c: CanvasRenderingContext2D, w: number, h: number, k: number) {
  const speed = w / 12;                       // pixels per second
  const x = ((k * speed) % (w + 200)) - 100;  // runs left to right, then loops
  const y = h * 0.86;
  const step = Math.sin(k * 12);
  c.save();
  c.translate(x, y);
  c.lineCap = "round";
  // legs
  c.strokeStyle = "#b71c1c"; c.lineWidth = 7;
  c.beginPath(); c.moveTo(-6, -22); c.lineTo(-6 + step * 10, -2); c.stroke();
  c.beginPath(); c.moveTo(6, -22); c.lineTo(6 - step * 10, -2); c.stroke();
  // boots
  c.fillStyle = "#2b1b17";
  c.fillRect(-12 + step * 10, -4, 10, 5);
  c.fillRect(2 - step * 10, -4, 10, 5);
  // body
  c.fillStyle = "#d62828";
  c.beginPath(); c.ellipse(0, -38, 16, 18, 0, 0, Math.PI * 2); c.fill();
  // belt and buckle
  c.fillStyle = "#1b1b1b"; c.fillRect(-15, -38, 30, 5);
  c.fillStyle = "#f2c230"; c.fillRect(-3, -39, 6, 7);
  // waving arm
  c.strokeStyle = "#d62828"; c.lineWidth = 6;
  c.beginPath(); c.moveTo(12, -44); c.lineTo(24, -56 + step * 6); c.stroke();
  // head and beard
  c.fillStyle = "#f5c9a0";
  c.beginPath(); c.arc(0, -62, 11, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#ffffff";
  c.beginPath(); c.ellipse(0, -56, 11, 8, 0, 0, Math.PI); c.fill();
  // hat with pom-pom
  c.fillStyle = "#d62828";
  c.beginPath(); c.moveTo(-11, -68); c.lineTo(10, -68); c.lineTo(-4, -92); c.closePath(); c.fill();
  c.fillStyle = "#ffffff";
  c.fillRect(-13, -71, 26, 6);
  c.beginPath(); c.arc(-4, -92, 4, 0, Math.PI * 2); c.fill();
  c.restore();
}

// Applies the chosen style to the whole page and draws its motion layer.
export default function ThemeStage({ theme }: { theme: string }) {
  const t = THEMES[theme] ?? THEMES.minimal;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 1) Recolour the whole page (CSS variables on <html>).
  useEffect(() => {
    const style = document.documentElement.style;
    const vars: Record<string, string> = {
      "--bg": t.bg, "--surface": t.surface, "--surface-hi": t.surfaceHi,
      "--line": t.line, "--text": t.text, "--muted": t.muted, "--grad": t.grad,
    };
    Object.entries(vars).forEach(([k, v]) => style.setProperty(k, v));
    return () => Object.keys(vars).forEach((k) => style.removeProperty(k));
  }, [t]);

  // 2) Motion layer for this style.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || t.effect === "none") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf = 0, particles: P[] = [];

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const pick = () => t.accents[Math.floor(Math.random() * t.accents.length)];
    const count = t.effect === "stars" ? 140 : t.effect === "waves" ? 0 : 60;

    function resize() {
      const r = canvas!.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas!.width = w * dpr; canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = Array.from({ length: count }, () => ({
        x: rnd(0, w), y: rnd(0, h), vx: rnd(-0.3, 0.3), vy: rnd(0.3, 0.9),
        r: rnd(1.5, 6), ph: rnd(0, Math.PI * 2), c: pick(),
      }));
    }

    function draw(time: number) {
      ctx!.clearRect(0, 0, w, h);
      const k = time / 1000;

      if (t.effect === "waves") {
        for (let i = 0; i < 6; i++) {
          ctx!.beginPath();
          const base = h * (0.15 + i * 0.14);
          for (let x = 0; x <= w; x += 8) {
            const y = base + Math.sin(x / 90 + k * (0.6 + i * 0.1)) * 26 + Math.sin(x / 40 - k) * 8;
            if (x === 0) ctx!.moveTo(x, y); else ctx!.lineTo(x, y);
          }
          ctx!.strokeStyle = t.accents[i % t.accents.length];
          ctx!.globalAlpha = 0.16;
          ctx!.lineWidth = 2;
          ctx!.stroke();
        }
        ctx!.globalAlpha = 1;
        return;
      }

      for (const p of particles) {
        if (!reduce) {
          p.ph += 0.02;
          if (t.effect === "petals") { p.x += Math.sin(p.ph) * 0.6 + p.vx; p.y += p.vy; }
          if (t.effect === "fireflies") { p.x += Math.cos(p.ph) * 0.4; p.y += Math.sin(p.ph * 0.7) * 0.4; }
          if (t.effect === "sparks") { p.x += Math.sin(p.ph) * 0.3; p.y -= p.vy * 1.4; }
          if (t.effect === "santa") { p.x += Math.sin(p.ph) * 0.4; p.y += p.vy * 0.8; }
        }
        // wrap around the screen
        if (p.y > h + 12) { p.y = -12; p.x = rnd(0, w); }
        if (p.y < -12) { p.y = h + 12; p.x = rnd(0, w); }
        if (p.x > w + 12) p.x = -12;
        if (p.x < -12) p.x = w + 12;

        if (t.effect === "petals") {
          ctx!.save();
          ctx!.translate(p.x, p.y);
          ctx!.rotate(p.ph);
          ctx!.globalAlpha = 0.5;
          ctx!.fillStyle = p.c;
          ctx!.beginPath();
          ctx!.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.restore();
        } else if (t.effect === "fireflies") {
          const a = 0.25 + (Math.sin(p.ph * 2) + 1) * 0.35;
          const g = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
          g.addColorStop(0, p.c);
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx!.globalAlpha = a;
          ctx!.fillStyle = g;
          ctx!.fillRect(p.x - p.r * 4, p.y - p.r * 4, p.r * 8, p.r * 8);
        } else if (t.effect === "sparks") {
          ctx!.globalAlpha = 0.25 + (Math.sin(p.ph * 3) + 1) * 0.35;
          ctx!.fillStyle = p.c;
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.r * 0.35, 0, Math.PI * 2);
          ctx!.fill();
        } else if (t.effect === "santa") {
          ctx!.globalAlpha = 0.85;
          ctx!.fillStyle = "#ffffff";
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.r * 0.45, 0, Math.PI * 2);
          ctx!.fill();
        } else if (t.effect === "stars") {
          ctx!.globalAlpha = 0.3 + (Math.sin(p.ph * 2) + 1) * 0.35;
          ctx!.fillStyle = p.c;
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.r * 0.3, 0, Math.PI * 2);
          ctx!.fill();
        }
      }
      ctx!.globalAlpha = 1;
      if (t.effect === "santa") drawSantaRun(ctx!, w, h, k);
    }

    function loop(time: number) {
      draw(time);
      raf = requestAnimationFrame(loop);
    }

    resize();
    window.addEventListener("resize", resize);
    if (reduce) draw(0);
    else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [t]);

  if (t.effect === "none") return null;
  return <canvas ref={canvasRef} className="stage-canvas" aria-hidden="true" />;
}
