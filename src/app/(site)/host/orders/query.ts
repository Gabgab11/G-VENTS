export const ORDER_STATUSES = ["completed", "pending_approval", "waitlisted", "declined", "cancelled", "awaiting_payment", "expired", "failed", "partially_refunded", "refunded", "disputed"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The orders list's filters from the address; anything unknown is dropped rather than sent to the API. */
export function ordersQuery(sp: { page?: string; event?: string; status?: string }) {
  const page = Math.max(1, Math.floor(Number(sp.page) || 1));
  const eventId = sp.event && UUID.test(sp.event) ? sp.event : undefined;
  const status = (ORDER_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as OrderStatus) : undefined;
  return { page, eventId, status };
}

/** The address of another page of the same list. */
export function ordersHref(q: { page: number; eventId?: string; status?: string }): string {
  const p = new URLSearchParams();
  if (q.eventId) p.set("event", q.eventId);
  if (q.status) p.set("status", q.status);
  if (q.page > 1) p.set("page", String(q.page));
  const s = p.toString();
  return s ? `/host/orders?${s}` : "/host/orders";
}

/** Badge tone for an order status. */
export function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "completed") return "success";
  if (status === "pending_approval" || status === "awaiting_payment" || status === "waitlisted") return "warning";
  if (status === "disputed" || status === "failed") return "danger";
  if (status === "refunded" || status === "partially_refunded") return "info";
  return "neutral";
}
