"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "gvents-category-order";

// Category cards filter the events. Visitors can drag them, or use the arrows on touch screens.
export default function CategoryBrowser({ categories, active }: { categories: readonly string[]; active?: string }) {
  const [order, setOrder] = useState<string[]>([...categories]);
  const [dragging, setDragging] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as string[] | null;
      if (Array.isArray(saved)) {
        const kept = saved.filter((c) => categories.includes(c));
        const missing = categories.filter((c) => !kept.includes(c));
        setOrder([...kept, ...missing]);
      }
    } catch {
      // Storage unavailable: keep the default order.
    }
  }, [categories]);

  function save(next: string[]) {
    setOrder(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors.
    }
  }

  function move(cat: string, dir: -1 | 1) {
    const i = order.indexOf(cat);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  }

  function drop(target: string) {
    if (!dragging || dragging === target) return;
    const next = order.filter((c) => c !== dragging);
    next.splice(next.indexOf(target), 0, dragging);
    save(next);
    setDragging(null);
  }

  return (
    <section className="cat-section">
      <div className="cat-head">
        <h2>Browse by category</h2>
        <span className="muted small">Drag to reorder</span>
      </div>
      <div className="cat-grid">
        {order.map((c, i) => (
          <div
            key={c}
            className={`cat-card ${active === c ? "on" : ""} ${dragging === c ? "dragging" : ""}`}
            draggable
            onDragStart={() => setDragging(c)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => drop(c)}
            onDragEnd={() => setDragging(null)}
          >
            <Link href={active === c ? "/discover" : `/discover?category=${encodeURIComponent(c)}`} className="cat-link">
              {c}
            </Link>
            <div className="cat-move">
              <button type="button" aria-label={`Move ${c} earlier`} onClick={() => move(c, -1)} disabled={i === 0}>←</button>
              <button type="button" aria-label={`Move ${c} later`} onClick={() => move(c, 1)} disabled={i === order.length - 1}>→</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
