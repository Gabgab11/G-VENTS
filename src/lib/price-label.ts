// "Free" or "From ₦5,000" for an event (Change 4, FR-29/30): on event pages, Discover cards and share
// cards. Money stays integer minor units until it is formatted in the page's language.
import { formatMoney } from "@/lib/format";
import type { Locale } from "@/i18n/languages";

type TicketLike = { priceMinor: number; currency: string; remaining?: number | null };

/** The lowest price among ticket types still available; null when every one is free (or there are none). */
export function lowestPrice(ticketTypes: readonly TicketLike[]): { minor: number; currency: string } | null {
  const paid = ticketTypes.filter((t) => t.priceMinor > 0 && (t.remaining == null || t.remaining > 0));
  if (!paid.length) return null;
  const min = paid.reduce((a, b) => (b.priceMinor < a.priceMinor ? b : a));
  return { minor: min.priceMinor, currency: min.currency };
}

/**
 * The label: `free` when there is no price, else `from` with the formatted amount.
 * `t` is next-intl's translator for the `shared` area (keys price.free, price.from).
 */
export function priceLabel(
  price: { minor: number; currency: string } | null,
  lang: Locale,
  t: (key: "price.free" | "price.from", values?: { price: string }) => string,
): string {
  if (!price || price.minor <= 0) return t("price.free");
  return t("price.from", { price: formatMoney(price.minor, price.currency, lang, true) });
}
