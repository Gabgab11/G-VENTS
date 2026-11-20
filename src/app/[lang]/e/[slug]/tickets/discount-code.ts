// Discount codes on the booking page (Change 4 chunk 3d, D91). The API checks every code (quote and
// paid order); these only tidy what was typed or linked, carry `?code=` from the event page to the
// booking page, and tell a code's own errors from other quote errors. Pure, so unit-tested.

const CODE = /^[A-Za-z0-9_-]{3,32}$/;

/** A code as the API accepts it (3–32 letters, digits, - or _), upper-cased; null otherwise. */
export function cleanCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim();
  return CODE.test(code) ? code.toUpperCase() : null;
}

/** `?code=` from a page's search params (the first value when repeated). */
export function codeParam(raw: string | string[] | undefined): string | null {
  return cleanCode(Array.isArray(raw) ? raw[0] : raw);
}

/** A path with `?code=` added when there is a valid code. */
export function withCode(path: string, code: string | null | undefined): string {
  const clean = cleanCode(code);
  if (!clean) return path;
  return `${path}${path.includes("?") ? "&" : "?"}code=${encodeURIComponent(clean)}`;
}

/** Problems about the code itself (shown under the code box), not about the tickets or the service. */
export function isDiscountProblem(code: string | null | undefined): boolean {
  return !!code && (code.startsWith("discount.") || code === "rate_limit.exceeded");
}

export type QuoteLine = { ticketTypeId: string; quantity: number };

/** The chosen quantities as quote lines (types with none are left out), in a stable order. */
export function quoteLines(qty: Readonly<Record<string, number>>): QuoteLine[] {
  return Object.entries(qty)
    .filter(([, n]) => Number.isInteger(n) && n > 0)
    .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }));
}

/** One string per quote request, so the same request is never sent twice in a row. */
export const quoteKey = (lines: readonly QuoteLine[], code: string | null | undefined) => JSON.stringify([lines, code ?? ""]);
