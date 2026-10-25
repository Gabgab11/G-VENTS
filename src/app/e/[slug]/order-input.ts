import type { components } from "@/lib/api/schema";
import { field, isUuid } from "@/lib/forms";

export type PlaceOrderBody = components["schemas"]["PlaceOrderDto"];

const QUESTION_FIELD = /^q_([0-9a-f-]{36})$/i;
const QUANTITY_FIELD = /^qty_([0-9a-f-]{36})$/i;
const MAX_TICKETS = 10;

/**
 * The order form → the API's PlaceOrderDto (U4 business-rules §1): one line per ticket type with a
 * quantity, optional names for tickets 2..n, the event's questions once, the buyer's name.
 */
export function placeOrderBody(formData: FormData): PlaceOrderBody | { error: string } {
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
  if (total < 1) return { error: "Choose at least one ticket." };
  if (total > MAX_TICKETS) return { error: "Choose between 1 and 10 tickets." };

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
