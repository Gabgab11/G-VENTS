import Link from "next/link";
import type { ReactNode } from "react";
import { CATEGORIES, CATEGORY_COLORS, type Category } from "@/lib/categories";
import { SHAPES, type ShapeName } from "@/app/hero-shapes";

// Category tiles for Discover: each category gets one of the home page's card shapes in its own
// colour, with a simple line icon. "All events" leads.

const SHAPE_FOR: Record<Category | "All", ShapeName> = {
  All: "burst", Music: "disc", Conferences: "ticket", Tech: "squircle", Faith: "arch", Arts: "leaf",
  Food: "bubble", Sports: "hex", Business: "folder", Nightlife: "stamp", Education: "shield",
  Community: "pill", Charity: "tag", Family: "card", Other: "squircle",
};

const ICON: Record<Category | "All", ReactNode> = {
  All: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  Music: <><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>,
  Conferences: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" /></>,
  Tech: <><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></>,
  Faith: <><path d="M12 3v18M7 8h10" /><path d="M5 21h14" /></>,
  Arts: <><path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-1.4-1.2-1.7-1.2-2.9 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.4 17 3 12 3z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="15" cy="7.5" r="1" /></>,
  Food: <><path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5" /><path d="M17 21V3c-2 1.5-3 4-3 7v3h3" /></>,
  Sports: <><circle cx="12" cy="12" r="9" /><path d="M12 7l4 3-1.5 4.5h-5L8 10z" /><path d="M12 3v4M21 10.5l-5-.5M18 19l-3.5-4.5M6 19l3.5-4.5M3 10.5l5-.5" /></>,
  Business: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></>,
  Nightlife: <><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /><path d="M17 3l.6 1.4L19 5l-1.4.6L17 7l-.6-1.4L15 5l1.4-.6z" /></>,
  Education: <><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M22 9v6" /></>,
  Community: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.5c3 0 6 2 6 5.5" /></>,
  Charity: <path d="M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9z" />,
  Family: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></>,
  Other: <><circle cx="6" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18" cy="12" r="1.6" /></>,
};

function Tile({ name, label, href, color, on }: { name: Category | "All"; label: string; href: string; color: string; on: boolean }) {
  const shape = SHAPES[SHAPE_FOR[name]];
  const size = Math.max(shape.w, shape.h);
  return (
    <Link href={href} className={`dc-cat ${on ? "on" : ""}`} aria-current={on ? "page" : undefined} scroll={false}>
      <span className="dc-cat-art" aria-hidden="true">
        <svg viewBox={`${(shape.w - size) / 2} ${(shape.h - size) / 2} ${size} ${size}`} className="dc-cat-shape">
          <path d={shape.d} fill={color} stroke={color} strokeWidth={shape.grow || 0} strokeLinejoin="round" />
        </svg>
        <svg viewBox="0 0 24 24" className="dc-cat-icon" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          {ICON[name]}
        </svg>
      </span>
      <span className="dc-cat-label">{label}</span>
    </Link>
  );
}

export default function CategoryTiles({ active }: { active?: Category }) {
  return (
    <nav className="dc-cats" aria-label="Event categories">
      <Tile name="All" label="All events" href="/discover" color="#ffc23d" on={!active} />
      {CATEGORIES.map((c) => (
        <Tile key={c} name={c} label={c} href={`/discover?category=${encodeURIComponent(c)}`} color={CATEGORY_COLORS[c]} on={active === c} />
      ))}
    </nav>
  );
}
