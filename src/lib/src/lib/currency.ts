// Prices for each currency. Edit these numbers to set your own prices.
// Starter is always free, so it has no entry here.
export const CURRENCY_CODES = ["USD", "NGN", "GBP", "EUR", "GHS", "KES", "ZAR"] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const CURRENCY_INFO: Record<CurrencyCode, { label: string; locale: string }> = {
  USD: { label: "USD", locale: "en-US" },
  NGN: { label: "Naira", locale: "en-NG" },
  GBP: { label: "GBP", locale: "en-GB" },
  EUR: { label: "EUR", locale: "de-DE" },
  GHS: { label: "Cedi", locale: "en-GH" },
  KES: { label: "Shilling", locale: "en-KE" },
  ZAR: { label: "Rand", locale: "en-ZA" },
};

// Monthly subscription prices per currency.
export const PRICES: Record<CurrencyCode, { pro: number; business: number }> = {
  USD: { pro: 19, business: 49 },
  NGN: { pro: 30000, business: 75000 },
  GBP: { pro: 15, business: 39 },
  EUR: { pro: 18, business: 45 },
  GHS: { pro: 250, business: 650 },
  KES: { pro: 2500, business: 6500 },
  ZAR: { pro: 350, business: 900 },
};

// Ticket price used in the fee example, per currency.
export const EXAMPLE_TICKET: Record<CurrencyCode, number> = {
  USD: 20,
  NGN: 30000,
  GBP: 16,
  EUR: 18,
  GHS: 250,
  KES: 2600,
  ZAR: 350,
};

export const EXAMPLE_QUANTITY = 500;

export function money(amount: number, code: CurrencyCode): string {
  return new Intl.NumberFormat(CURRENCY_INFO[code].locale, {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
  }).format(amount);
}
