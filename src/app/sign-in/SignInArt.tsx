import type { CSSProperties } from "react";
import { CardSvg, type Card } from "@/app/HeroCards";
import { SHAPES } from "@/app/hero-shapes";

// The sign-in page's picture: the home page's event cards in a composed pile, so the brand
// carries over instead of a stock or generated photo. Purely decorative.

type Placed = Pick<Card, "shape" | "words" | "meta" | "tone"> & { left: number; top: number; tilt: number; scale: number; phone?: { left: number; top: number } };

const PILE: Placed[] = [
  { shape: "bubble", words: ["Moji's", "Birthday"], meta: "Lekki · 8pm", tone: "ink", left: 8, top: 44, tilt: -6, scale: 1, phone: { left: 2, top: 76 } },
  { shape: "burst", words: ["Owambe"], meta: "Lagos · Saturday", tone: "sun", left: 58, top: 38, tilt: 9, scale: 1.05, phone: { left: 66, top: 74 } },
  { shape: "folder", words: ["Afrobeats", "Night"], meta: "Lagos · Island", tone: "paper", left: 30, top: 55, tilt: 3, scale: 1, phone: { left: 34, top: 80 } },
  { shape: "disc", words: ["Braai", "Day"], meta: "Cape Town", tone: "coral", left: 2, top: 68, tilt: -12, scale: 0.95 },
  { shape: "card", words: ["Naming", "Ceremony"], meta: "Ibadan · Sunday", tone: "lilac", left: 60, top: 60, tilt: 6, scale: 1 },
  { shape: "hex", words: ["Detty", "December"], meta: "Accra", tone: "sun", left: 36, top: 77, tilt: -4, scale: 0.95 },
  { shape: "leaf", words: ["Festa", "Junina"], meta: "São Paulo", tone: "mint", left: 70, top: 80, tilt: 10, scale: 0.9 },
  { shape: "stamp", words: ["Mehndi"], meta: "Dubai", tone: "rose", left: 14, top: 86, tilt: 7, scale: 0.85 },
];

export default function SignInArt() {
  return (
    <aside className="si-art" aria-hidden="true">
      <div className="si-art-head">
        <p className="si-art-title">Every celebration, <span>one place.</span></p>
        <ul className="si-art-points">
          <li>Tickets in seconds, no passwords</li>
          <li>A QR code for every guest</li>
          <li>Host your own event in minutes</li>
        </ul>
      </div>
      <div className="si-pile">
        {PILE.map((c, i) => {
          const s = SHAPES[c.shape];
          const style = {
            "--l": `${c.left}%`, "--t": `${c.top}%`, "--w": `${s.w * c.scale}px`,
            "--pl": `${c.phone?.left ?? c.left}%`, "--pt": `${c.phone?.top ?? c.top}%`, "--pw": `${Math.round(s.w * 0.5)}px`,
            "--tilt": `${c.tilt}deg`, "--float-delay": `${(i % 4) * -1.3}s`,
          } as CSSProperties;
          return (
            <div key={i} className={`si-pile-card${c.phone ? " on-phone" : ""}`} style={style}>
              <CardSvg card={c} />
            </div>
          );
        })}
      </div>
    </aside>
  );
}
