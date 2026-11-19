// The share card drawings (D81). Rendered to PNG by next/og (Satori), not by the browser, so they
// use inline styles with literal colours and sizes (this folder is allow-listed in
// scripts/check-design-tokens.mjs). Satori supports flexbox only: every element with more than
// one child sets display: flex.
import type { CSSProperties } from "react";
import { CARD_HEIGHT, CARD_PADDING, CARD_WIDTH, FLYER_WIDTH, TITLE_LINE_HEIGHT, TITLE_MAX_LINES, bidiPieces } from "@/lib/og-card";

export const INK = "#141414";
const TEXT = "#ffffff";
const MUTED = "#a9a9ae";
const SOFT = "#d6d6da";
const CORAL = "#ff5a3c";
const SUN = "#ffc23d";
const MINT = "#7ee0b6";
const SKY = "#8ec5ff";
const ROSE = "#ffb3c7";
const LILAC = "#cdbde8";
const TONE_INK = "#121212";

// Each subset is its own family, so a glyph missing from one (₦ and ₵ are only in Bricolage's
// latin-ext, Arabic only in the Arabic font) is found in the next.
const SANS = "Manrope, Manrope Ext, Bricolage Ext, Arabic";
const DISPLAY = "Bricolage, Bricolage Ext, Arabic";

/**
 * A line (or wrapping paragraph) of text. Text with Arabic is laid out piece by piece (bidiPieces),
 * right to left when the paragraph is right-to-left, because the renderer has no bidi algorithm.
 */
function Line({ text, style, align }: { text: string; style: CSSProperties; align: "start" | "end" }) {
  const { rtl, pieces } = bidiPieces(text);
  const size = typeof style.fontSize === "number" ? style.fontSize : 24;
  const justify = (align === "end") !== rtl ? "flex-end" : "flex-start";
  if (pieces.length <= 1 && !rtl) {
    return <div style={{ display: "flex", justifyContent: align === "end" ? "flex-end" : "flex-start", textAlign: align === "end" ? "right" : "left", ...style }}>{pieces[0] ?? ""}</div>;
  }
  // Arabic letters join: no negative letter spacing on them.
  return (
    <div style={{ ...style, display: "flex", flexDirection: rtl ? "row-reverse" : "row", flexWrap: "wrap", justifyContent: justify, alignContent: "flex-start", letterSpacing: 0 }}>
      {pieces.map((piece, i) => (
        <span key={i} style={{ display: "flex", marginLeft: rtl ? size * 0.24 : 0, marginRight: rtl ? 0 : size * 0.24 }}>
          {piece}
        </span>
      ))}
    </div>
  );
}

export function Wordmark({ size }: { size: number }) {
  return (
    <div style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 800, fontSize: size, color: TEXT, letterSpacing: -0.02 * size, lineHeight: 1 }}>
      <span>G-vent</span>
      <span style={{ color: CORAL }}>Z</span>
    </div>
  );
}

export type EventCardProps = {
  title: { text: string; size: number };
  dateLine: string;
  place: string;
  price: string;
  /** "Hosted by" in the page's language, and the host's name; null without a name. */
  host: { label: string; name: string } | null;
  flyer: string | null;
  cover: { background: string; grad: string };
  rtl: boolean;
};

function CoverPanel({ cover }: { cover: EventCardProps["cover"] }) {
  // The event's cover style, with a few soft rings so it doesn't read as an empty box.
  return (
    <div style={{ display: "flex", position: "relative", width: FLYER_WIDTH, height: CARD_HEIGHT, backgroundImage: cover.background, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: -120, top: -80, width: 420, height: 420, borderRadius: 420, border: "2px solid rgba(255,255,255,0.18)" }} />
      <div style={{ position: "absolute", right: -160, bottom: -160, width: 480, height: 480, borderRadius: 480, backgroundColor: "rgba(255,255,255,0.08)" }} />
      <div style={{ position: "absolute", left: 56, bottom: 56, width: 160, height: 12, borderRadius: 12, backgroundImage: cover.grad }} />
    </div>
  );
}

export function EventCard(p: EventCardProps) {
  const align = p.rtl ? "end" : "start";
  const items = p.rtl ? "flex-end" : "flex-start";
  const titleBox = p.title.size * TITLE_LINE_HEIGHT * TITLE_MAX_LINES + 4;
  return (
    <div style={{ display: "flex", flexDirection: p.rtl ? "row-reverse" : "row", width: CARD_WIDTH, height: CARD_HEIGHT, backgroundColor: INK, fontFamily: SANS, color: TEXT }}>
      {p.flyer ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori draws <img>, not next/image
        <img src={p.flyer} alt="" width={FLYER_WIDTH} height={CARD_HEIGHT} style={{ width: FLYER_WIDTH, height: CARD_HEIGHT, objectFit: "cover" }} />
      ) : (
        <CoverPanel cover={p.cover} />
      )}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: items, flex: 1, padding: CARD_PADDING, paddingTop: 56, paddingBottom: 52 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: items, width: "100%" }}>
          <Line text={p.dateLine} align={align} style={{ fontSize: 26, fontWeight: 700, color: SUN, marginBottom: 20, width: "100%" }} />
          <Line
            text={p.title.text}
            align={align}
            style={{
              fontFamily: DISPLAY,
              fontWeight: 800,
              fontSize: p.title.size,
              lineHeight: TITLE_LINE_HEIGHT,
              letterSpacing: -0.02 * p.title.size,
              maxHeight: titleBox,
              overflow: "hidden",
              width: "100%",
            }}
          />
          {p.place ? <Line text={p.place} align={align} style={{ fontSize: 28, color: MUTED, marginTop: 22, width: "100%" }} /> : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: items, width: "100%" }}>
          <div style={{ display: "flex", flexDirection: p.rtl ? "row-reverse" : "row", alignItems: "center", marginBottom: 28 }}>
            <Line text={p.price} align={align} style={{ backgroundColor: CORAL, color: TONE_INK, fontFamily: DISPLAY, fontSize: 30, fontWeight: 800, padding: "10px 24px", borderRadius: 999 }} />
            {p.host ? (
              <div style={{ display: "flex", flexDirection: p.rtl ? "row-reverse" : "row", fontSize: 24, color: MUTED, marginLeft: p.rtl ? 0 : 22, marginRight: p.rtl ? 22 : 0, maxWidth: 330 }}>
                <Line text={p.host.label} align={align} style={{ fontSize: 24, marginLeft: p.rtl ? 7 : 0, marginRight: p.rtl ? 0 : 7 }} />
                <Line text={p.host.name} align={align} style={{ fontSize: 24, fontWeight: 700, color: SOFT }} />
              </div>
            ) : null}
          </div>
          <Wordmark size={40} />
        </div>
      </div>
    </div>
  );
}

/** The site's own card (home page, Discover): the wordmark, the tagline and the tone shapes. */
export function SiteCard({ tagline, rtl }: { tagline: string; rtl: boolean }) {
  const shapes: { color: string; left: number; top: number; w: number; h: number; r: number; rotate: number }[] = [
    { color: CORAL, left: 760, top: -40, w: 300, h: 300, r: 300, rotate: 0 },
    { color: SUN, left: 980, top: 220, w: 260, h: 150, r: 40, rotate: -12 },
    { color: MINT, left: 820, top: 330, w: 190, h: 190, r: 48, rotate: 14 },
    { color: SKY, left: 1040, top: 470, w: 220, h: 220, r: 220, rotate: 0 },
    { color: ROSE, left: 700, top: 500, w: 180, h: 110, r: 55, rotate: 8 },
    { color: LILAC, left: 1080, top: 40, w: 120, h: 120, r: 20, rotate: 20 },
  ];
  return (
    <div style={{ display: "flex", position: "relative", width: CARD_WIDTH, height: CARD_HEIGHT, backgroundColor: INK, fontFamily: SANS, color: TEXT, overflow: "hidden" }}>
      {shapes.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: rtl ? CARD_WIDTH - s.left - s.w : s.left,
            top: s.top,
            width: s.w,
            height: s.h,
            borderRadius: s.r,
            backgroundColor: s.color,
            transform: `rotate(${rtl ? -s.rotate : s.rotate}deg)`,
          }}
        />
      ))}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: rtl ? "flex-end" : "flex-start", position: "absolute", left: rtl ? 540 : 80, top: 0, width: 580, height: CARD_HEIGHT }}>
        <Wordmark size={112} />
        <Line text={tagline} align={rtl ? "end" : "start"} style={{ fontSize: 34, lineHeight: 1.35, color: SOFT, marginTop: 32, width: "100%" }} />
      </div>
    </div>
  );
}
