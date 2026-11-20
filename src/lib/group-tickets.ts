// Group tickets (Change 4 chunk 3d, D90): a ticket type can admit 2-20 people per purchase. The
// price is per purchase, each purchase gives groupSize tickets (entries), and it counts once against
// the per-person limit. Pure helpers for the booking forms, My tickets and the host screens.

type Sized = { groupSize?: number | null };

/** People admitted per purchase; 1 for an ordinary ticket. */
export function groupSizeOf(type: Sized): number {
  const n = type.groupSize ?? 1;
  return Number.isInteger(n) && n > 1 ? n : 1;
}

export const isGroup = (type: Sized) => groupSizeOf(type) > 1;

/** Purchases still possible: `remaining` counts entries, and a group purchase needs groupSize of them. */
export function purchasesLeft(type: Sized & { remaining: number | null }): number | null {
  return type.remaining === null ? null : Math.max(0, Math.floor(type.remaining / groupSizeOf(type)));
}

/** Sold out for buyers: fewer entries left than one purchase needs. */
export function isSoldOut(type: Sized & { remaining: number | null }): boolean {
  return type.remaining !== null && type.remaining < groupSizeOf(type);
}

/** The order's tickets: purchases × group size, summed over the chosen types. */
export function ticketCount(qty: Readonly<Record<string, number>>, types: readonly (Sized & { id: string })[]): number {
  return types.reduce((sum, t) => sum + Math.max(0, qty[t.id] ?? 0) * groupSizeOf(t), 0);
}

/**
 * Which type each ticket of the order is, in the order the API numbers them (types in the order
 * they appear on the form, each one's tickets together): index 0 is ticket 1.
 */
export function ticketTypesInOrder<T extends Sized & { id: string }>(qty: Readonly<Record<string, number>>, types: readonly T[]): T[] {
  return types.flatMap((t) => Array.from({ length: Math.max(0, qty[t.id] ?? 0) * groupSizeOf(t) }, () => t));
}

/**
 * Each ticket's place within its group ("Ticket 2 of 4"), for tickets listed in number order:
 * consecutive tickets of one group type are filled into groups of groupSize. Ordinary tickets get null.
 */
export function groupPositions(tickets: readonly (Sized & { ticketType: string })[]): (number | null)[] {
  let previous: string | null = null;
  let position = 0;
  return tickets.map((t) => {
    const size = groupSizeOf(t);
    if (size === 1) {
      previous = null;
      return null;
    }
    position = previous === t.ticketType && position < size ? position + 1 : 1;
    previous = t.ticketType;
    return position;
  });
}

/** A translator for the event.booking area (next-intl's `t`, narrowed to what this needs). */
type LineTranslate = (key: "line" | "groupLine", values: Record<string, string | number>) => string;

/** A summary line: "Regular × 2", or for a group "Table of 4 × 1 (4 entries)". */
export function summaryLine(t: LineTranslate, name: string, count: number, groupSize?: number | null): string {
  const size = groupSizeOf({ groupSize });
  return size > 1 ? t("groupLine", { name, count, entries: count * size }) : t("line", { name, count });
}
