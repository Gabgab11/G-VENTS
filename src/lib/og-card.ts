// The text on the share cards (Change 4, FR-29.1, D81): `/api/og/e/{slug}` for an event and
// `/api/og/site` for the home page and Discover. Pure helpers, so they can be unit-tested; the
// drawing is in src/app/api/og/.
import { enabledLanguages, isEnabled, DEFAULT_LANGUAGE, type Locale } from "@/i18n/languages";
import { formatDateTime } from "@/lib/format";
import { lowestPrice } from "@/lib/price-label";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;
/** The flyer panel on the left; the text column takes the rest. */
export const FLYER_WIDTH = 504;
export const CARD_PADDING = 64;
/** Width of the text column (right of the flyer, inside the padding). */
export const TEXT_WIDTH = CARD_WIDTH - FLYER_WIDTH - 2 * CARD_PADDING;

export const TITLE_SIZES = [76, 68, 60, 54, 48, 42] as const;
export const TITLE_MAX_LINES = 3;
export const TITLE_LINE_HEIGHT = 1.04;

/** The `lang` query parameter, if it is a switched-on language; otherwise English. */
export function cardLanguage(param: string | null, enabled: readonly Locale[] = enabledLanguages()): Locale {
  return param && isEnabled(param, enabled) ? param : DEFAULT_LANGUAGE;
}

/** A versioned address (`?v=updatedAt`) never changes, so it is cached for a year; otherwise for an hour. */
export function cardCacheControl(version: string | null): string {
  return version ? "public, max-age=31536000, immutable" : "public, max-age=3600";
}

/** "Saturday 21 November 2026 at 19:00", in the event's own zone and the page's language. */
export function cardDateLine(startsAt: string, timeZone: string | null | undefined, lang: Locale): string {
  return formatDateTime(startsAt, timeZone, lang, "long");
}

type CardLocation = { kind: "venue" | "online"; venueName?: string | null; city?: string | null; country?: string | null };

/** The city; without one, the venue and country; `online` for online events. */
export function cardPlace(location: CardLocation, online: string): string {
  if (location.kind === "online") return online;
  if (location.city) return location.city;
  return [location.venueName, location.country].filter(Boolean).join(" · ");
}

type TicketLike = { priceMinor: number; currency: string; remaining?: number | null };

/**
 * The price to show: the lowest on sale (lowestPrice). When every paid type is sold out and none is
 * free, the lowest paid price anyway, so a sold-out paid event never reads "Free".
 */
export function cardPrice(ticketTypes: readonly TicketLike[]): { minor: number; currency: string } | null {
  const onSale = lowestPrice(ticketTypes);
  if (onSale || ticketTypes.some((t) => t.priceMinor <= 0)) return onSale;
  return lowestPrice(ticketTypes.map((t) => ({ ...t, remaining: null })));
}

// Rough advance widths (in em) for Bricolage Grotesque ExtraBold, enough to pick a size that fits.
function charWidth(ch: string): number {
  if (ch === " ") return 0.24;
  if (/[⺀-鿿가-힯豈-﫿＀-￯]/.test(ch)) return 1;
  if (/[iljtfrI.,:;'!|()[\]]/.test(ch)) return 0.32;
  if (/[MW@mw]/.test(ch)) return 0.86;
  if (/[A-Z0-9]/.test(ch)) return 0.64;
  return 0.54;
}

function textWidth(text: string, size: number): number {
  let w = 0;
  for (const ch of text) w += charWidth(ch);
  return w * size;
}

/** Greedy word wrap with the estimated widths. Words longer than a line are split by character. */
export function wrapLines(text: string, size: number, width: number = TEXT_WIDTH): string[] {
  const lines: string[] = [];
  let line = "";
  const tokens = text.trim().split(/(\s+)/).filter((t) => t && !/^\s+$/.test(t));
  for (const word of tokens) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, size) <= width) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    // A word (or CJK run without spaces) wider than the line: break it by character.
    let rest = word;
    while (textWidth(rest, size) > width) {
      let cut = "";
      for (const ch of rest) {
        if (textWidth(cut + ch, size) > width) break;
        cut += ch;
      }
      if (!cut) cut = [...rest][0]!;
      lines.push(cut);
      rest = rest.slice(cut.length);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * The title's font size and text: the largest size at which it fits in three lines. A title too
 * long even at the smallest size is cut after three lines with an ellipsis.
 */
export function fitTitle(title: string, width: number = TEXT_WIDTH): { size: number; text: string; lines: number } {
  const clean = title.replace(/\s+/g, " ").trim();
  for (const size of TITLE_SIZES) {
    const lines = wrapLines(clean, size, width);
    if (lines.length <= TITLE_MAX_LINES) return { size, text: clean, lines: lines.length };
  }
  const size = TITLE_SIZES[TITLE_SIZES.length - 1];
  const lines = wrapLines(clean, size, width).slice(0, TITLE_MAX_LINES);
  let last = lines[TITLE_MAX_LINES - 1]!;
  while (last && textWidth(`${last}…`, size) > width) last = [...last].slice(0, -1).join("");
  lines[TITLE_MAX_LINES - 1] = `${last.replace(/[\s.,;:–-]+$/, "")}…`;
  return { size, text: lines.join(" "), lines: TITLE_MAX_LINES };
}

/** Whether any of the texts needs the Arabic font (the Latin fonts have no Arabic glyphs). */
export function needsArabic(...texts: (string | null | undefined)[]): boolean {
  return texts.some((t) => !!t && /\p{Script=Arabic}/u.test(t));
}

/** JPEG or PNG, by the file's first bytes: the only flyer formats the card renderer can draw. */
export function flyerType(bytes: Uint8Array): "image/jpeg" | "image/png" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return "image/png";
  return null;
}

/** A data: URL for the image bytes (the renderer draws data URLs without fetching again). */
export function dataUrl(bytes: Uint8Array, type: string): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return `data:${type};base64,${btoa(binary)}`;
}

const BIDI_CONTROLS = /[‎‏؜‪-‮⁦-⁩]/g;
const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const LTR_CHAR = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ⺀-鿿가-힯0-9]/;

/**
 * Text for the card renderer, split into the pieces to lay out in a row (Satori has no bidi
 * algorithm: it draws mixed Arabic and Latin text in the wrong order, and shows bidi control marks
 * as glyphs). `rtl` is the paragraph's direction, from its first strong character. In a right-to-
 * left paragraph every Arabic word is its own piece and each run of Latin words or numbers stays
 * one piece; the caller lays the pieces out right to left. Text without Arabic is one piece.
 */
export function bidiPieces(text: string): { rtl: boolean; pieces: string[] } {
  const clean = text.replace(BIDI_CONTROLS, "").replace(/\s+/g, " ").trim();
  if (!RTL_CHAR.test(clean)) return { rtl: false, pieces: clean ? [clean] : [] };
  const firstStrong = [...clean].find((ch) => RTL_CHAR.test(ch) || LTR_CHAR.test(ch));
  const rtl = !!firstStrong && RTL_CHAR.test(firstStrong);
  const pieces: string[] = [];
  let run: string[] = [];
  let runRtl: boolean | null = null;
  const flush = () => {
    if (run.length) pieces.push(run.join(" "));
    run = [];
  };
  for (const word of clean.split(" ")) {
    const wordRtl = RTL_CHAR.test(word) ? true : LTR_CHAR.test(word) ? false : null; // null: punctuation
    if (wordRtl === null) {
      if (run.length) run.push(word);
      else if (pieces.length) pieces[pieces.length - 1] += ` ${word}`;
      else run.push(word);
      continue;
    }
    // Words of the paragraph's own direction are separate pieces; the other direction's runs stay whole.
    if (wordRtl === rtl || wordRtl !== runRtl) flush();
    run.push(word);
    runRtl = wordRtl;
    if (wordRtl === rtl) flush();
  }
  flush();
  return { rtl, pieces };
}
