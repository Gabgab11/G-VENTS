import Link from "next/link";
import type { CSSProperties } from "react";
import { SHAPES, type ShapeName } from "./hero-shapes";

// Cards that drift down from the top of the screen when the home page opens and
// settle in a pile on the line above the name ticker. The layer is clipped at that
// line, so nothing ever falls or floats past it. The fall is pure CSS; the optional
// tilt game on phones (HeroTilt.tsx) moves the cards afterwards.

type Tone = "sun" | "coral" | "mint" | "sky" | "rose" | "ink" | "paper" | "lilac";

const TONES: Record<Tone, { fill: string; text: string; border?: string }> = {
  sun: { fill: "#ffc23d", text: "#121212" },
  coral: { fill: "#ff5a3c", text: "#ffffff" },
  mint: { fill: "#7ee0b6", text: "#121212" },
  sky: { fill: "#8ec5ff", text: "#121212" },
  rose: { fill: "#ffb3c7", text: "#121212" },
  ink: { fill: "#121212", text: "#ffffff" },
  paper: { fill: "#fffdf8", text: "#121212", border: "#e2d9c6" },
  lilac: { fill: "#cdbde8", text: "#121212" },
};

type Card = {
  shape: ShapeName;
  words: [string] | [string, string];
  meta: string;
  tone: Tone;
  category: string; // Discover filter the card opens
  left: number;     // % across the page
  bottom: number;   // px above the line at full size (0 = resting on the line)
  tilt: number;     // resting angle, degrees
  delay: number;    // seconds before it starts falling
  row: 1 | 2 | 3;   // 2 and 3 rest on cards below; hidden on phones
  phoneLeft?: number; // % across on phones, so the six phone cards sit fully on screen
};

// Bottom row first (they land first), then the cards that land on top of them.
const CARDS: Card[] = [
  { shape: "ticket", words: ["Traditional", "Engagement"], meta: "Enugu · December", tone: "lilac", category: "Family", left: -1, bottom: 0, tilt: -4, delay: 0.1, row: 1, phoneLeft: 2 },
  { shape: "burst", words: ["Owambe"], meta: "Lagos · Saturday", tone: "sun", category: "Community", left: 12, bottom: 0, tilt: 8, delay: 0.5, row: 1, phoneLeft: 22 },
  { shape: "pill", words: ["Outdooring"], meta: "Kumasi", tone: "mint", category: "Family", left: 23.5, bottom: 0, tilt: -6, delay: 0.9, row: 1 },
  { shape: "folder", words: ["Afrobeats", "Night"], meta: "Lagos · Island", tone: "paper", category: "Music", left: 33, bottom: 0, tilt: 3, delay: 0.3, row: 1 },
  { shape: "disc", words: ["Braai", "Day"], meta: "Cape Town", tone: "coral", category: "Food", left: 47, bottom: 0, tilt: -10, delay: 1.1, row: 1, phoneLeft: 41 },
  { shape: "arch", words: ["Sangeet", "Night"], meta: "Mumbai", tone: "rose", category: "Music", left: 57, bottom: 0, tilt: 4, delay: 0.6, row: 1 },
  { shape: "bubble", words: ["Moji's", "Birthday"], meta: "Lekki · 8pm", tone: "ink", category: "Nightlife", left: 67, bottom: 0, tilt: -3, delay: 0.2, row: 1, phoneLeft: 55 },
  { shape: "shield", words: ["Quince-", "añera"], meta: "Mexico City", tone: "sky", category: "Family", left: 80, bottom: 0, tilt: 6, delay: 0.8, row: 1, phoneLeft: 69 },
  { shape: "hex", words: ["Detty", "December"], meta: "Accra", tone: "sun", category: "Nightlife", left: 90.5, bottom: 0, tilt: -5, delay: 0.4, row: 1, phoneLeft: 79.5 },
  { shape: "leaf", words: ["Festa", "Junina"], meta: "São Paulo", tone: "mint", category: "Food", left: 51, bottom: 140, tilt: 9, delay: 2.0, row: 2 },
  { shape: "tag", words: ["Send-Off"], meta: "Abuja · Friday", tone: "paper", category: "Community", left: 61.5, bottom: 150, tilt: -8, delay: 2.3, row: 2 },
  { shape: "squircle", words: ["Iftar", "Night"], meta: "Cairo", tone: "coral", category: "Faith", left: 74, bottom: 148, tilt: -7, delay: 1.8, row: 2 },
  { shape: "card", words: ["Naming", "Ceremony"], meta: "Ibadan · Sunday", tone: "lilac", category: "Faith", left: 86, bottom: 150, tilt: 5, delay: 2.1, row: 2 },
  { shape: "stamp", words: ["Mehndi"], meta: "Dubai", tone: "rose", category: "Arts", left: 79, bottom: 290, tilt: -4, delay: 2.9, row: 3 },
];

// Shrink a word until it fits the card (Bricolage 800 is about 0.6 em per character).
function fitSize(base: number, words: string[], width: number): number {
  const longest = Math.max(...words.map((w) => w.length));
  return Math.min(base, Math.floor((width / (longest * 0.6)) * 10) / 10);
}

function CardSvg({ card }: { card: Card }) {
  const s = SHAPES[card.shape];
  const tone = TONES[card.tone];
  const room = s.anchor === "middle" ? s.w * 0.72 : s.w - s.x - 16;
  const size = fitSize(s.wordSize, card.words, room);
  // A one-line word in a two-line slot sits on the lower line, so it lines up with the meta text.
  const firstY = card.words.length === 1 && s.wordLines === 2 ? s.wordY + s.lineGap / 2 : s.wordY;

  return (
    <svg viewBox={`0 0 ${s.w} ${s.h}`} width={s.w} height={s.h} aria-hidden="true">
      <path
        d={s.d}
        fill={tone.fill}
        stroke={tone.border ?? (s.grow ? tone.fill : "none")}
        strokeWidth={tone.border ? 1.5 : s.grow}
        strokeLinejoin="round"
      />
      {s.hole && <circle cx={s.hole.cx} cy={s.hole.cy} r={s.hole.r} fill="#fff" stroke="#e2d9c6" strokeWidth={1.5} />}
      <text x={s.x} y={firstY} textAnchor={s.anchor} style={{ fontFamily: "var(--display)" }} fontWeight={800} fontSize={size} fill={tone.text} letterSpacing={-0.3}>
        {card.words.map((w, i) => (
          <tspan key={i} x={s.x} dy={i === 0 ? 0 : s.lineGap * (size / s.wordSize)}>{w}</tspan>
        ))}
      </text>
      <text x={s.x} y={s.metaY} textAnchor={s.anchor} style={{ fontFamily: "var(--body)" }} fontWeight={600} fontSize={s.metaSize} fill={tone.text} fillOpacity={0.8}>
        {card.meta}
      </text>
    </svg>
  );
}

export default function HeroCards() {
  return (
    <div className="hp-drop">
      {CARDS.map((card, i) => {
        const s = SHAPES[card.shape];
        const name = card.words.join(" ").replace("- ", "");
        // Each card sways a little differently on the way down.
        const sway = (i % 2 ? 1 : -1) * (18 + (i * 7) % 26);
        const spin = (i % 3 === 0 ? -1 : 1) * (14 + (i * 5) % 18);
        // A tilted card rests on its lowest corner, so lift it by the height that corner drops.
        const lift = Math.round((s.w / 2) * Math.sin((Math.abs(card.tilt) * Math.PI) / 180));
        const style = {
          "--left": `${card.left}%`,
          "--left-phone": `${card.phoneLeft ?? card.left}%`,
          "--bottom": card.bottom + lift,
          "--lift": lift, // resting height when the tilt game drops every card onto the line
          "--w": s.w,
          "--h": s.h,
          "--tilt": `${card.tilt}deg`,
          "--sway": `${sway}px`,
          "--spin": `${spin}deg`,
          "--delay": `${card.delay}s`,
          "--dur": `${2.6 + (i % 4) * 0.25}s`,
        } as CSSProperties;
        return (
          <div key={`${card.shape}-${i}`} className={`hp-fall hp-row${card.row}`} style={style}>
            <Link href={`/discover?category=${encodeURIComponent(card.category)}`} className="hp-card" aria-label={`${name} events`}>
              <CardSvg card={card} />
            </Link>
          </div>
        );
      })}
    </div>
  );
}
