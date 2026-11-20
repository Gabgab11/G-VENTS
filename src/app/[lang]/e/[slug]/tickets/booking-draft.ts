// What a buyer has typed on the booking page, kept for a moment in this tab's sessionStorage while
// the inline email code signs them in (Change 4 chunk 3d, D88). The page refreshes after sign-in;
// if that remounts the forms, the draft puts back the quantities, names, answers, ticks and the
// discount code. Pure parts here (unit-tested); use-booking-draft.ts does the storage and the DOM.

export type BookingDraft = {
  qty: Record<string, number>;
  /** Field name → value as the form would send it (a ticked box is "on"). */
  fields: Record<string, string>;
  /** An applied discount code (paid form). */
  code?: string;
  savedAt: number;
};

/** A draft older than this is ignored: it is only meant to bridge one refresh. */
export const DRAFT_TTL_MS = 30 * 60_000;

/** Window event asking every booking form on the page to save ("save") or drop ("clear") its draft. */
export const DRAFT_EVENT = "gv:booking-draft";
export type DraftCommand = "save" | "clear";

export const draftKey = (eventId: string, form: "free" | "paid") => `gv:booking:${eventId}:${form}`;

const QTY = /^qty_(.+)$/;
/** Not the buyer's input: set by the page, or kept in the form's own state. */
const SKIP = new Set(["event_id", "join_waitlist", "code"]);
const MAX_FIELDS = 80;
const MAX_VALUE = 1000;

export function draftFromEntries(entries: Iterable<[string, FormDataEntryValue]>, now: number, code?: string | null): BookingDraft {
  const qty: Record<string, number> = {};
  const fields: Record<string, string> = {};
  for (const [name, value] of entries) {
    if (typeof value !== "string" || SKIP.has(name)) continue;
    const q = QTY.exec(name);
    if (q) {
      const n = Number(value);
      if (Number.isInteger(n) && n > 0) qty[q[1]!] = n;
      continue;
    }
    if (Object.keys(fields).length < MAX_FIELDS) fields[name] = value.slice(0, MAX_VALUE);
  }
  return { qty, fields, ...(code ? { code } : {}), savedAt: now };
}

/** A stored draft, or null when there is none, it is too old, or it isn't one. */
export function readDraft(raw: string | null, now: number): BookingDraft | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const d = parsed as Partial<BookingDraft>;
  if (typeof d.savedAt !== "number" || now - d.savedAt > DRAFT_TTL_MS || now < d.savedAt - 60_000) return null;
  const qty: Record<string, number> = {};
  for (const [id, n] of Object.entries(d.qty ?? {})) if (Number.isInteger(n) && n > 0 && n <= 10) qty[id] = n;
  const fields: Record<string, string> = {};
  for (const [name, v] of Object.entries(d.fields ?? {})) if (typeof v === "string") fields[name] = v.slice(0, MAX_VALUE);
  return { qty, fields, ...(typeof d.code === "string" && d.code ? { code: d.code } : {}), savedAt: d.savedAt };
}
