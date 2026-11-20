import type { components } from "@/lib/api/schema";
import { field, isUuid } from "@/lib/forms";
import { cleanCode } from "./tickets/discount-code";

export type PlaceOrderBody = components["schemas"]["PlaceOrderDto"];

const QUESTION_FIELD = /^q_([0-9a-f-]{36})$/i;
const QUANTITY_FIELD = /^qty_([0-9a-f-]{36})$/i;
const MAX_TICKETS = 10;

/** Why a form can't be sent: a message id under event.errors (Change 3); the action shows it in the reader's language. */
export type OrderInputError = "chooseTicket" | "ticketRange" | "nonRefundable";

/**
 * The order form → the API's PlaceOrderDto (U4 business-rules §1): one line per ticket type with a
 * quantity, optional names for tickets 2..n, the event's questions once, the buyer's name.
 */
export function placeOrderBody(formData: FormData): PlaceOrderBody | { error: OrderInputError } {
  const lines: PlaceOrderBody["lines"] = [];
  const answers: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    const qty = QUANTITY_FIELD.exec(key);
    if (qty && isUuid(qty[1])) {
      const quantity = Number(value);
      if (Number.isInteger(quantity) && quantity > 0) lines.push({ ticketTypeId: qty[1]!.toLowerCase(), quantity });
    }
    const question = QUESTION_FIELD.exec(key);
    if (question) answers[question[1]!.toLowerCase()] = value.trim().slice(0, 1000);
  }
  const total = lines.reduce((sum, l) => sum + l.quantity, 0);
  if (total < 1) return { error: "chooseTicket" };
  if (total > MAX_TICKETS) return { error: "ticketRange" };

  // guest_2 … guest_n name tickets 2..n; ticket 1 is the buyer's.
  const guestNames = Array.from({ length: total }, (_, i) => (i === 0 ? "" : field(formData, `guest_${i + 1}`, 120)));
  const buyerName = field(formData, "buyer_name", 120);
  return {
    lines,
    ...(guestNames.some(Boolean) ? { guestNames } : {}),
    ...(Object.keys(answers).length > 0 ? { answers } : {}),
    ...(buyerName ? { buyerName } : {}),
  };
}

export type PaidOrderBody = components["schemas"]["PaidOrderDto"];

/**
 * The paid order form → PaidOrderDto (M5, CK1–CK3): the same lines, names and answers as a free
 * order, plus the guest's tick on "non-refundable, except if the event is cancelled", and whether
 * to join the waiting list when a chosen ticket type is sold out (WL1), and the discount code the
 * buyer applied (D91; the API checks it again).
 */
export function paidOrderBody(formData: FormData): PaidOrderBody | { error: OrderInputError } {
  const base = placeOrderBody(formData);
  if ("error" in base) return base;
  if (formData.get("non_refundable") !== "on") {
    return { error: "nonRefundable" };
  }
  const waitlist = formData.get("join_waitlist") === "true";
  const code = waitlist ? null : cleanCode(formData.get("code"));
  return { ...base, nonRefundableAccepted: true, ...(waitlist ? { joinWaitlist: true } : {}), ...(code ? { code } : {}) };
}

/**
 * Paystack's hosted checkout only (CK4): https, or http on this machine for the local fake. Anything
 * else is not followed; the guest lands on their order page, which can open checkout again.
 */
export function isCheckoutUrl(raw: string | null | undefined): raw is string {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1"));
  } catch {
    return false;
  }
}
