import type { components } from "@/lib/api/schema";

// Words for Paystack payments (M5), shared by the host, guest and admin screens. Pure.

export type PayoutCountry = "NG" | "GH" | "KE" | "ZA";
export type SellReason = NonNullable<components["schemas"]["CallerPaidSalesDto"]["reason"]>;
export type FeeChoice = "host_absorbs" | "guest_pays";

/** Paystack countries (business rules PR1): each its own Paystack account and currency. */
export const PAYOUT_COUNTRIES: Record<PayoutCountry, { name: string; currency: string }> = {
  NG: { name: "Nigeria", currency: "NGN" },
  GH: { name: "Ghana", currency: "GHS" },
  KE: { name: "Kenya", currency: "KES" },
  ZA: { name: "South Africa", currency: "ZAR" },
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
  payout_account_pending: { text: "You're approved. We're setting up your payout account with Paystack; you can sell paid tickets once it's ready.", action: "See payout details" },
  country_off: { text: "Paystack is paused for your payout country right now. Free tickets still work." },
  owes_money: { text: "You owe G-ventZ money from refunds or chargebacks, so you can't publish new paid events. Your existing events keep selling, which pays it back.", action: "See what you owe" },
  suspended: { text: "Your account is suspended, so you can't sell paid tickets." },
};

export function sellReasonText(reason: string | null | undefined): { text: string; action?: string } {
  return reason && Object.hasOwn(SELL_REASONS, reason) ? SELL_REASONS[reason as SellReason] : SELL_REASONS.payments_off;
}

export const FEE_CHOICES: Record<FeeChoice, { label: string; hint: string }> = {
  host_absorbs: { label: "I absorb the fees", hint: "Guests pay the ticket price. G-ventZ's fee, VAT on it and Paystack's charge come out of what you receive." },
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
