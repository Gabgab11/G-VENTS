import { describe, expect, it } from "vitest";
import { clampQuantities, eventCta, maxQuantity, opensBooking, orderableTypes, ticketsLeft, type EventCtaInput } from "./event-cta";

const free = { priceMinor: 0, remaining: 10 };
const paid = { priceMinor: 500_000, remaining: null };
const soldOutFree = { priceMinor: 0, remaining: 0 };
const soldOutPaid = { priceMinor: 500_000, remaining: 0 };

const base: EventCtaInput = {
  status: "published",
  registrationOpen: true,
  paidSalesOpen: true,
  canManage: false,
  viewerRole: null,
  perBuyerLimit: 10,
  viewerTickets: 0,
  signedIn: true,
  ticketTypes: [paid],
};
const cta = (over: Partial<EventCtaInput>) => eventCta({ ...base, ...over });

describe("the event page's main button", () => {
  it("is Get tickets for paid tickets, straight to booking when signed in", () => {
    expect(cta({})).toEqual({ kind: "get", label: "getTickets", signIn: false });
  });

  it("goes to sign-in first when signed out", () => {
    expect(cta({ signedIn: false, viewerTickets: null })).toEqual({ kind: "get", label: "getTickets", signIn: true });
  });

  it("is Register when every ticket on sale is free", () => {
    expect(cta({ ticketTypes: [free] })).toEqual({ kind: "get", label: "register", signIn: false });
    // Paid tickets that can't be bought right now don't make it a paid event.
    expect(cta({ ticketTypes: [free, paid], paidSalesOpen: false })).toMatchObject({ kind: "get", label: "register" });
  });

  it("is Get tickets when free and paid tickets are both on sale", () => {
    expect(cta({ ticketTypes: [free, paid] })).toMatchObject({ kind: "get", label: "getTickets" });
  });

  it("shows the limit note when the viewer holds the most tickets allowed", () => {
    expect(cta({ viewerTickets: 10 })).toEqual({ kind: "limit" });
    expect(cta({ viewerTickets: 12 })).toEqual({ kind: "limit" });
    expect(cta({ viewerTickets: 9 })).toMatchObject({ kind: "get" });
    // Signed out: no limit is known yet.
    expect(cta({ signedIn: false, viewerTickets: null })).toMatchObject({ kind: "get" });
  });

  it("is Manage event for the event's team, whatever else is true", () => {
    expect(cta({ canManage: true })).toEqual({ kind: "manage" });
    expect(cta({ viewerRole: "checkin" })).toEqual({ kind: "manage" });
    expect(cta({ canManage: true, viewerTickets: 10, status: "cancelled" })).toEqual({ kind: "manage" });
  });

  it("is Sold out when nothing free is left and there is no paid waiting list", () => {
    expect(cta({ ticketTypes: [soldOutFree] })).toEqual({ kind: "soldOut" });
    expect(cta({ ticketTypes: [soldOutFree, soldOutPaid], paidSalesOpen: false })).toEqual({ kind: "soldOut" });
  });

  it("offers the waiting list when only sold-out paid tickets are left", () => {
    expect(cta({ ticketTypes: [soldOutPaid] })).toEqual({ kind: "waitlist", signIn: false });
    expect(cta({ ticketTypes: [soldOutFree, soldOutPaid], signedIn: false, viewerTickets: null })).toEqual({ kind: "waitlist", signIn: true });
  });

  it("is closed, cancelled or not on sale when nothing can be ordered", () => {
    expect(cta({ registrationOpen: false })).toEqual({ kind: "closed" });
    expect(cta({ status: "cancelled" })).toEqual({ kind: "cancelled" });
    expect(cta({ status: "draft" })).toEqual({ kind: "notOnSale" });
    expect(cta({ ticketTypes: [] })).toEqual({ kind: "notOnSale" });
    expect(cta({ ticketTypes: [paid], paidSalesOpen: false })).toEqual({ kind: "notOnSale" });
  });

  it("opens the booking page only for Get tickets, Register and the waiting list", () => {
    expect(opensBooking(cta({}))).toBe(true);
    expect(opensBooking(cta({ ticketTypes: [soldOutPaid] }))).toBe(true);
    for (const over of [{ canManage: true }, { viewerTickets: 10 }, { ticketTypes: [soldOutFree] }, { registrationOpen: false }]) {
      expect(opensBooking(cta(over))).toBe(false);
    }
  });
});

describe("the booking page's quantity caps", () => {
  it("leaves the per-person limit minus the tickets already held", () => {
    expect(ticketsLeft({ perBuyerLimit: 5, viewerTickets: null })).toBe(5);
    expect(ticketsLeft({ perBuyerLimit: 5, viewerTickets: 3 })).toBe(2);
    expect(ticketsLeft({ perBuyerLimit: 5, viewerTickets: 7 })).toBe(0);
  });

  it("splits free and paid ticket types, paid only while paid sales are open", () => {
    expect(orderableTypes({ ticketTypes: [free, paid], paidSalesOpen: true })).toEqual({ free: [free], paid: [paid] });
    expect(orderableTypes({ ticketTypes: [free, paid], paidSalesOpen: false })).toEqual({ free: [free], paid: [] });
  });
});

describe("maxQuantity", () => {
  const a = { id: "a", remaining: null };
  const b = { id: "b", remaining: 3 };
  const gone = { id: "c", remaining: 0 };

  it("is capped by the tickets the viewer has left, minus the other types chosen", () => {
    expect(maxQuantity(a, {}, 5)).toBe(5);
    expect(maxQuantity(a, { a: 2, b: 2 }, 5)).toBe(3);
    expect(maxQuantity(a, { b: 5 }, 5)).toBe(0);
  });

  it("is capped by what the ticket type has left", () => {
    expect(maxQuantity(b, {}, 10)).toBe(3);
    expect(maxQuantity(b, { a: 9 }, 10)).toBe(1);
  });

  it("offers nothing of a sold-out type, except to join its waiting list", () => {
    expect(maxQuantity(gone, {}, 4)).toBe(0);
    expect(maxQuantity(gone, {}, 4, true)).toBe(4);
  });
});

describe("clampQuantities (after the inline sign-in)", () => {
  it("keeps the same object when everything still fits", () => {
    const chosen = { a: 2, b: 1 };
    expect(clampQuantities(chosen, 3)).toBe(chosen);
    expect(clampQuantities(chosen, 10)).toBe(chosen);
  });

  it("takes from the last types first", () => {
    expect(clampQuantities({ a: 2, b: 2 }, 3)).toEqual({ a: 2, b: 1 });
    expect(clampQuantities({ a: 2, b: 2 }, 1)).toEqual({ a: 1, b: 0 });
    expect(clampQuantities({ a: 2 }, 0)).toEqual({ a: 0 });
  });
});
