import type { components } from "@/lib/api/schema";

// Words for Paystack payments (M5), shared by the host, guest and admin screens. Pure.

export type PayoutCountry = NonNullable<components["schemas"]["CallerPaidSalesDto"]["country"]>;
export type SellReason = NonNullable<components["schemas"]["CallerPaidSalesDto"]["reason"]>;
export type FeeChoice = "host_absorbs" | "guest_pays";
/** The payment providers with an adapter (Change 5 chunk 4, D96). */
export type ProviderId = components["schemas"]["FeeQuoteDto"]["provider"];

/**
 * Payout countries (business rules PR1, PS9): each with its currency. Paystack has the first four
 * (each its own Paystack account); Flutterwave has all of them (one account). English names for the
 * admin dashboard; other pages use countryLabel() in the reader's language.
 */
export const PAYOUT_COUNTRIES: Record<PayoutCountry, { name: string; currency: string }> = {
  NG: { name: "Nigeria", currency: "NGN" },
  GH: { name: "Ghana", currency: "GHS" },
  KE: { name: "Kenya", currency: "KES" },
  ZA: { name: "South Africa", currency: "ZAR" },
  UG: { name: "Uganda", currency: "UGX" },
  TZ: { name: "Tanzania", currency: "TZS" },
  RW: { name: "Rwanda", currency: "RWF" },
  ZM: { name: "Zambia", currency: "ZMW" },
  CM: { name: "Cameroon", currency: "XAF" },
  CI: { name: "Côte d'Ivoire", currency: "XOF" },
  SN: { name: "Senegal", currency: "XOF" },
};

/** Paystack's countries (PR1): the countries of `paystackCountries` in the admin settings. */
export const PAYSTACK_COUNTRIES = ["NG", "GH", "KE", "ZA"] as const satisfies readonly PayoutCountry[];

/** The provider's name as people read it (a brand: never translated). */
export const PROVIDER_NAMES: Record<ProviderId, string> = { paystack: "Paystack", flutterwave: "Flutterwave" };
export const PROVIDER_IDS = Object.keys(PROVIDER_NAMES) as ProviderId[];

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && Object.hasOwn(PROVIDER_NAMES, value);
}

/** The provider's name, or a plain fallback for anything unknown (older quotes are Paystack's). */
export function providerName(provider: string | null | undefined): string {
  return isProviderId(provider) ? PROVIDER_NAMES[provider] : PROVIDER_NAMES.paystack;
}

export type PaymentMethod = "card" | "bankTransfer" | "applePay" | "googlePay" | "mobileMoney";

/**
 * How a guest can pay on the provider's page (PS20): card, bank transfer and Apple Pay on both;
 * Google Pay and mobile money on Flutterwave only. Ids under event.paid.methods.
 */
export const PROVIDER_METHODS: Record<ProviderId, readonly PaymentMethod[]> = {
  paystack: ["card", "bankTransfer", "applePay"],
  flutterwave: ["card", "bankTransfer", "applePay", "googlePay", "mobileMoney"],
};

export function isPayoutCountry(value: unknown): value is PayoutCountry {
  return typeof value === "string" && Object.hasOwn(PAYOUT_COUNTRIES, value);
}

/** Why a host can't sell paid tickets yet, and what they can do about it. */
export const SELL_REASONS: Record<SellReason, { text: string; action?: string }> = {
  payments_off: { text: "Paid tickets aren't open on G-ventZ yet. Every ticket is free for now." },
  not_applied: { text: "To sell paid tickets, tell us who gets paid and where.", action: "Apply to sell paid tickets" },
  application_submitted: { text: "We're reviewing your application to sell paid tickets. We'll email you when it's decided.", action: "See your application" },
  application_declined: { text: "Your application to sell paid tickets wasn't approved. You can see why and apply again.", action: "See why" },
  approval_revoked: { text: "Your approval to sell paid tickets was withdrawn. Tickets already sold still work.", action: "See details" },
  payout_account_pending: { text: "You're approved. We're setting up your payout account with the payment provider; you can sell paid tickets once it's ready.", action: "See payout details" },
  country_off: { text: "Paid tickets are paused for your payout country right now. Free tickets still work." },
  owes_money: { text: "You owe G-ventZ money from refunds or chargebacks, so you can't publish new paid events. Your existing events keep selling, which pays it back.", action: "See what you owe" },
  suspended: { text: "Your account is suspended, so you can't sell paid tickets." },
};

export function sellReasonText(reason: string | null | undefined): { text: string; action?: string } {
  return reason && Object.hasOwn(SELL_REASONS, reason) ? SELL_REASONS[reason as SellReason] : SELL_REASONS.payments_off;
}

export const FEE_CHOICES: Record<FeeChoice, { label: string; hint: string }> = {
  host_absorbs: { label: "I absorb the fees", hint: "Guests pay the ticket price. G-ventZ's fee, VAT on it and the payment provider's charge come out of what you receive." },
  guest_pays: { label: "Guests pay the fees", hint: "Fees are added on top of the price, so you receive the full ticket price." },
};

/** CK3: shown next to the tick box before every paid order, word for word. */
export const NON_REFUNDABLE_TEXT = "I understand tickets are non-refundable, except if the event is cancelled";
export const ORGANIZER_TEXT = "The organizer, not G-ventZ, is responsible for this event.";

type PaymentStatus = components["schemas"]["OrderPaymentDto"]["status"];

/** Payment states that can still change on their own (the order page keeps checking). */
export function paymentIsFinal(status: PaymentStatus): boolean {
  return status !== "awaiting_payment";
}

export const REFUND_STATUS: Record<string, string> = {
  queued: "Refund queued",
  processing: "Refund processing",
  refunded: "Refunded",
  failed: "Refund failed",
};

export const APPLICATION_STATUS: Record<string, string> = {
  none: "Not applied",
  submitted: "In review",
  approved: "Approved",
  declined: "Declined",
  revoked: "Approval withdrawn",
  payout_pending: "Payout account pending",
};

// Message ids for the wording above (Change 3), for pages in the reader's language. The constants
// above stay English for the admin dashboard. Ids are full (area included).

const SELL_REASON_IDS: Record<SellReason, string> = {
  payments_off: "paymentsOff",
  not_applied: "notApplied",
  application_submitted: "applicationSubmitted",
  application_declined: "applicationDeclined",
  approval_revoked: "approvalRevoked",
  payout_account_pending: "payoutAccountPending",
  country_off: "countryOff",
  owes_money: "owesMoney",
  suspended: "suspended",
};

/** Ids for sellReasonText(reason); a page calls t(key) with useTranslations()/getTranslations() at the root (no namespace). */
export function sellReasonKey(reason: string | null | undefined): { key: string; actionKey?: string } {
  const r: SellReason = reason && Object.hasOwn(SELL_REASONS, reason) ? (reason as SellReason) : "payments_off";
  const id = `shared.sellReason.${SELL_REASON_IDS[r]}`;
  return SELL_REASONS[r].action ? { key: id, actionKey: `${id}Action` } : { key: id };
}

const FEE_CHOICE_IDS: Record<FeeChoice, string> = { host_absorbs: "hostAbsorbs", guest_pays: "guestPays" };

/** Ids for FEE_CHOICES[choice]; a page calls t(labelKey) / t(hintKey) with useTranslations()/getTranslations() at the root (no namespace). */
export function feeChoiceKey(choice: FeeChoice): { labelKey: string; hintKey: string } {
  const id = `shared.fees.${FEE_CHOICE_IDS[choice]}`;
  return { labelKey: `${id}.label`, hintKey: `${id}.hint` };
}

/** Id for NON_REFUNDABLE_TEXT; a page calls t(NON_REFUNDABLE_KEY) with useTranslations()/getTranslations() at the root (no namespace). */
export const NON_REFUNDABLE_KEY = "shared.payment.nonRefundable";
/** Id for ORGANIZER_TEXT; a page calls t(ORGANIZER_KEY) with useTranslations()/getTranslations() at the root (no namespace). */
export const ORGANIZER_KEY = "shared.payment.organizer";

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** Id for REFUND_STATUS[status], or null when unknown; a page calls t(key) with useTranslations()/getTranslations() at the root (no namespace). */
export function refundStatusKey(status: string): string | null {
  return Object.hasOwn(REFUND_STATUS, status) ? `shared.refundStatus.${camel(status)}` : null;
}

/** Id for APPLICATION_STATUS[status], or null when unknown; a page calls t(key) with useTranslations()/getTranslations() at the root (no namespace). */
export function applicationStatusKey(status: string): string | null {
  return Object.hasOwn(APPLICATION_STATUS, status) ? `shared.applicationStatus.${camel(status)}` : null;
}
