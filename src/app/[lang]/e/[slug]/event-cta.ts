// The one main button on the event page and what the booking page offers (Change 4 chunk 3b, step 1).
// Pure, so every state is unit-tested; the page turns the answer into a link, a banner or a disabled
// button. The API decides who may buy; this only chooses what to show.

type TicketTypeLike = { priceMinor: number; remaining: number | null };

export type EventCtaInput = {
  status: "draft" | "published" | "cancelled";
  registrationOpen: boolean;
  paidSalesOpen: boolean;
  canManage: boolean;
  viewerRole: string | null;
  perBuyerLimit: number;
  /** Tickets the viewer already holds for this event; null when signed out. */
  viewerTickets: number | null;
  signedIn: boolean;
  ticketTypes: readonly TicketTypeLike[];
};

export type EventCta =
  /** The event's team: "Manage event". */
  | { kind: "manage" }
  /** Get tickets (paid) or Register (all free); `signIn`: signed out, the email is confirmed on the booking page. */
  | { kind: "get"; label: "getTickets" | "register"; signIn: boolean }
  /** Only sold-out paid tickets left: the paid form can join their waiting list. */
  | { kind: "waitlist"; signIn: boolean }
  /** The viewer holds the most tickets allowed. */
  | { kind: "limit" }
  | { kind: "soldOut" }
  | { kind: "closed" }
  | { kind: "cancelled" }
  | { kind: "notOnSale" };

const isSoldOut = (t: TicketTypeLike) => t.remaining !== null && t.remaining <= 0;

/** Ticket types that can be ordered now: free ones, and paid ones while paid sales are open. */
export function orderableTypes<T extends TicketTypeLike>(input: Pick<EventCtaInput, "paidSalesOpen"> & { ticketTypes: readonly T[] }): { free: T[]; paid: T[] } {
  return {
    free: input.ticketTypes.filter((t) => t.priceMinor === 0),
    paid: input.paidSalesOpen ? input.ticketTypes.filter((t) => t.priceMinor > 0) : [],
  };
}

/** Tickets the viewer may still get (the per-person limit minus what they hold). */
export function ticketsLeft(input: Pick<EventCtaInput, "perBuyerLimit" | "viewerTickets">): number {
  return Math.max(0, input.perBuyerLimit - (input.viewerTickets ?? 0));
}

export function eventCta(input: EventCtaInput): EventCta {
  if (input.canManage || input.viewerRole) return { kind: "manage" };
  if (input.status === "cancelled") return { kind: "cancelled" };
  if (input.status !== "published") return { kind: "notOnSale" };
  if (!input.registrationOpen) return { kind: "closed" };
  if (input.signedIn && ticketsLeft(input) === 0) return { kind: "limit" };

  const { free, paid } = orderableTypes(input);
  const orderable = [...free, ...paid];
  if (orderable.length === 0) return { kind: "notOnSale" };
  const signIn = !input.signedIn;
  const available = orderable.filter((t) => !isSoldOut(t));
  if (available.length === 0) return paid.length > 0 ? { kind: "waitlist", signIn } : { kind: "soldOut" };
  return { kind: "get", label: available.some((t) => t.priceMinor > 0) ? "getTickets" : "register", signIn };
}

/** Whether the visitor goes on to the booking page (or to sign in for it). */
export function opensBooking(cta: EventCta): cta is Extract<EventCta, { kind: "get" | "waitlist" }> {
  return cta.kind === "get" || cta.kind === "waitlist";
}

/**
 * The most of one ticket type the booking form offers: what is left of the viewer's limit after the
 * other types chosen, and no more than the type has left. A sold-out paid type can still be chosen to
 * join its waiting list (`waitlist`), up to the limit.
 */
export function maxQuantity(type: { id: string; remaining: number | null }, chosen: Readonly<Record<string, number>>, limit: number, waitlist = false): number {
  const others = Object.entries(chosen).reduce((sum, [id, n]) => (id === type.id ? sum : sum + n), 0);
  const soldOut = type.remaining !== null && type.remaining <= 0;
  const room = soldOut && waitlist ? limit : type.remaining ?? limit;
  return Math.max(0, Math.min(limit - others, room));
}

/**
 * The chosen quantities cut down to what the viewer may still get, taking from the last types first
 * (after the inline sign-in, an account that already holds tickets may have less room). The same
 * object comes back when nothing changes, so a state update is skipped.
 */
export function clampQuantities(chosen: Readonly<Record<string, number>>, limit: number): Record<string, number> {
  let room = Math.max(0, limit);
  let changed = false;
  const next: Record<string, number> = {};
  for (const [id, n] of Object.entries(chosen)) {
    const keep = Math.min(n, room);
    if (keep !== n) changed = true;
    next[id] = keep;
    room -= keep;
  }
  return changed ? next : (chosen as Record<string, number>);
}
