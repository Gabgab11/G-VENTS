import { describe, expect, it } from "vitest";
import { detailsPatch, isReschedule, parsePrice, parseQuantity, priceText, readDetailsForm, ticketLock, type DetailsInput, type EventForPatch } from "./details-form";
import { dayBars, dayLabel } from "./overview-data";

const event: EventForPatch = {
  title: "Jazz Night",
  description: "Live jazz",
  category: "Music",
  startsAtLocal: "2026-12-05T18:00:00",
  endsAtLocal: "2026-12-05T22:00",
  timeZone: "Africa/Lagos",
  status: "published",
  counts: { confirmed: 3, pending: 0, waitlisted: 0 },
  ticketTypes: [
    { id: "a", name: "Regular", priceMinor: 500000, currency: "NGN", quantity: 100, sold: 3 },
    { id: "b", name: "VIP", priceMinor: 1500000, currency: "NGN", quantity: 10, sold: 0 },
  ],
};

const same = (over: Partial<DetailsInput> = {}): DetailsInput => ({
  title: "Jazz Night",
  description: "Live jazz",
  category: "Music",
  startsAt: "2026-12-05T18:00",
  endsAt: "2026-12-05T22:00",
  timeZone: "Africa/Lagos",
  tickets: [
    { id: "a", name: "Regular", quantity: "100", price: "5000", remove: false },
    { id: "b", name: "VIP", quantity: "10", price: "15000", remove: false },
  ],
  ...over,
});

describe("group tickets and descriptions (D90)", () => {
  const rows = (a: Partial<DetailsInput["tickets"][number]>, b: Partial<DetailsInput["tickets"][number]> = {}) => same({
    tickets: [
      { id: "a", name: "Regular", quantity: "100", price: "5000", remove: false, groupSize: "1", description: "", ...a },
      { id: "b", name: "VIP", quantity: "10", price: "15000", remove: false, groupSize: "1", description: "", ...b },
    ],
  });

  it("sends a new group size and description for an unsold type", () => {
    expect(detailsPatch(rows({}, { groupSize: "4", description: " Table near the stage " }), event)).toMatchObject({
      ok: true, body: { ticketTypes: [{ id: "b", groupSize: 4, description: "Table near the stage" }] },
    });
  });

  it("nothing changes when the form matches", () => {
    expect(detailsPatch(rows({}), event)).toMatchObject({ ok: true, body: {} });
  });

  it("a sold type keeps its group size; bad sizes and long descriptions are refused", () => {
    expect(detailsPatch(rows({ groupSize: "4" }), event)).toEqual({ ok: false, error: "ticket_group_locked" });
    expect(detailsPatch(rows({}, { groupSize: "21" }), event)).toEqual({ ok: false, error: "ticket_group_size" });
    expect(detailsPatch(rows({}, { description: "x".repeat(301) }), event)).toEqual({ ok: false, error: "ticket_description" });
  });

  it("a new group type", () => {
    const input = same({ tickets: [...same().tickets, { id: "", name: "Table of 4", quantity: "40", price: "300000", remove: false, groupSize: "4", description: "Seats four" }] });
    expect(detailsPatch(input, event)).toMatchObject({ ok: true, body: { ticketTypes: [{ name: "Table of 4", priceMinor: 30000000, quantity: 40, groupSize: 4, description: "Seats four" }] } });
  });

  it("reads the new fields from the form", () => {
    const fd = new FormData();
    for (const [k, v] of [["tt_id", "a"], ["tt_name", "Regular"], ["tt_quantity", ""], ["tt_price", "0"], ["tt_remove", "0"], ["tt_group_size", "4"], ["tt_desc", "Hi"]]) fd.append(k!, v!);
    expect(readDetailsForm(fd).tickets[0]).toEqual({ id: "a", name: "Regular", quantity: "", price: "0", remove: false, groupSize: "4", description: "Hi" });
  });
});

describe("ticket locks", () => {
  it("locks the price and removal once sold; quantity never below sold", () => {
    expect(ticketLock({ sold: 0 })).toEqual({ priceLocked: false, groupLocked: false, minQuantity: 1, removable: true });
    expect(ticketLock({ sold: 7 })).toEqual({ priceLocked: true, groupLocked: true, minQuantity: 7, removable: false });
  });
});

describe("parsePrice / parseQuantity / priceText", () => {
  it("reads prices to integer minor units", () => {
    expect(parsePrice("5000", "NGN")).toBe(500000);
    expect(parsePrice("5,000", "NGN")).toBe(500000);
    expect(parsePrice("1,234,567.5", "NGN")).toBe(123456750);
    expect(parsePrice("12,5", "NGN")).toBe(1250);
    expect(parsePrice("5 000", "NGN")).toBe(500000);
    expect(parsePrice("", "NGN")).toBe(0);
    expect(parsePrice("1.234", "NGN")).toBeNull();
    expect(parsePrice("-5", "NGN")).toBeNull();
    expect(parsePrice("abc", "NGN")).toBeNull();
    expect(parsePrice("500", "JPY")).toBe(500);
    expect(parsePrice("500.5", "JPY")).toBeNull();
  });

  it("reads quantities: blank is unlimited", () => {
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity("12")).toBe(12);
    expect(parseQuantity("0")).toBeUndefined();
    expect(parseQuantity("1.5")).toBeUndefined();
  });

  it("shows minor units as typed prices", () => {
    expect(priceText(500000, "NGN")).toBe("5000");
    expect(priceText(1250, "NGN")).toBe("12.5");
    expect(priceText(0, "NGN")).toBe("0");
  });
});

describe("detailsPatch", () => {
  it("sends nothing when nothing changed", () => {
    expect(detailsPatch(same(), event)).toEqual({ ok: true, body: {}, rescheduled: false });
  });

  it("sends only the changed basics", () => {
    const r = detailsPatch(same({ title: "  Jazz Night II ", description: " ", category: "Arts" }), event);
    expect(r).toEqual({ ok: true, body: { title: "Jazz Night II", description: null, category: "Arts" }, rescheduled: false });
  });

  it("checks the title, category and dates", () => {
    expect(detailsPatch(same({ title: "ab" }), event)).toEqual({ ok: false, error: "title_length" });
    expect(detailsPatch(same({ category: "Gaming" }), event)).toEqual({ ok: false, error: "category" });
    expect(detailsPatch(same({ startsAt: "tomorrow" }), event)).toEqual({ ok: false, error: "starts_at" });
    expect(detailsPatch(same({ endsAt: "2026-12-05T17:00" }), event)).toEqual({ ok: false, error: "ends_before_start" });
    expect(detailsPatch(same({ timeZone: "Mars/Olympus" }), event)).toEqual({ ok: false, error: "time_zone" });
  });

  it("moving a published event with guests is a reschedule", () => {
    const r = detailsPatch(same({ startsAt: "2026-12-06T18:00", endsAt: "" }), event);
    expect(r).toEqual({ ok: true, body: { startsAt: "2026-12-06T18:00", endsAt: null }, rescheduled: true });
    expect(detailsPatch(same({ timeZone: "Africa/Accra" }), event)).toEqual({ ok: true, body: { timeZone: "Africa/Accra" }, rescheduled: true });
    expect(isReschedule({ ...event, status: "draft" }, { startsAt: "2026-12-06T18:00", endsAt: "", timeZone: "" })).toBe(false);
    expect(isReschedule({ ...event, counts: { confirmed: 0, pending: 0, waitlisted: 0 } }, { startsAt: "2026-12-06T18:00", endsAt: "", timeZone: "" })).toBe(false);
  });

  it("renames, resizes and reprices unsold types; adds and removes", () => {
    const r = detailsPatch(same({
      tickets: [
        { id: "a", name: "General", quantity: "", price: "5000", remove: false },
        { id: "b", name: "VIP", quantity: "10", price: "20,000", remove: false },
        { id: "", name: "Early bird", quantity: "50", price: "2500", remove: false },
        { id: "", name: "Dropped", quantity: "", price: "", remove: true },
      ],
    }), event);
    expect(r).toEqual({
      ok: true,
      rescheduled: false,
      body: { ticketTypes: [
        { id: "a", name: "General", quantity: null },
        { id: "b", priceMinor: 2000000 },
        { name: "Early bird", priceMinor: 250000, quantity: 50 },
      ] },
    });
    const removed = detailsPatch(same({ tickets: [same().tickets[0]!, { ...same().tickets[1]!, remove: true }] }), event);
    expect(removed).toEqual({ ok: true, rescheduled: false, body: { ticketTypes: [{ id: "b", remove: true }] } });
  });

  it("keeps the locks on types with sales", () => {
    const [a, b] = same().tickets as [DetailsInput["tickets"][0], DetailsInput["tickets"][0]];
    expect(detailsPatch(same({ tickets: [{ ...a, price: "6000" }, b] }), event)).toEqual({ ok: false, error: "ticket_price_locked" });
    expect(detailsPatch(same({ tickets: [{ ...a, quantity: "2" }, b] }), event)).toEqual({ ok: false, error: "ticket_quantity_below_sold" });
    expect(detailsPatch(same({ tickets: [{ ...a, remove: true }, b] }), event)).toEqual({ ok: false, error: "ticket_has_sales" });
    expect(detailsPatch(same({ tickets: [{ ...a, name: " " }, b] }), event)).toEqual({ ok: false, error: "ticket_name" });
    expect(detailsPatch(same({ tickets: [{ ...a, quantity: "many" }, b] }), event)).toEqual({ ok: false, error: "ticket_quantity" });
    expect(detailsPatch(same({ tickets: [a, { ...b, price: "x" }] }), event)).toEqual({ ok: false, error: "ticket_price" });
  });

  it("an event keeps at least one ticket type", () => {
    const noSales = { ...event, ticketTypes: [event.ticketTypes[1]!] };
    expect(detailsPatch(same({ tickets: [{ id: "b", name: "VIP", quantity: "10", price: "15000", remove: true }] }), noSales)).toEqual({ ok: false, error: "ticket_count" });
  });
});

describe("readDetailsForm", () => {
  it("reads the rows in order", () => {
    const fd = new FormData();
    for (const [k, v] of [["title", "T"], ["description", ""], ["category", "Music"], ["starts_at", "2026-12-05T18:00"], ["ends_at", ""], ["time_zone", "Africa/Lagos"]]) fd.set(k!, v!);
    for (const [id, name, q, p, rm] of [["a", "Regular", "100", "5000", "0"], ["", "New", "", "0", "1"]]) {
      fd.append("tt_id", id!); fd.append("tt_name", name!); fd.append("tt_quantity", q!); fd.append("tt_price", p!); fd.append("tt_remove", rm!);
    }
    expect(readDetailsForm(fd)).toEqual({
      title: "T", description: "", category: "Music", startsAt: "2026-12-05T18:00", endsAt: "", timeZone: "Africa/Lagos",
      tickets: [
        { id: "a", name: "Regular", quantity: "100", price: "5000", remove: false },
        { id: "", name: "New", quantity: "", price: "0", remove: true },
      ],
    });
  });
});

describe("dayBars", () => {
  it("groups by currency, keeps the newest days, and scales to the best day", () => {
    const r = dayBars([
      { date: "2026-11-19", currency: "NGN", orders: 2, grossMinor: 1000000 },
      { date: "2026-11-18", currency: "NGN", orders: 1, grossMinor: 500000 },
      { date: "2026-11-18", currency: "GHS", orders: 1, grossMinor: 3000 },
      { date: "2026-11-17", currency: "NGN", orders: 0, grossMinor: 0 },
      { date: "2026-11-16", currency: "NGN", orders: 1, grossMinor: 250000 },
    ], 2);
    expect(r).toEqual([
      { currency: "NGN", days: [
        { date: "2026-11-19", currency: "NGN", orders: 2, grossMinor: 1000000, share: 100 },
        { date: "2026-11-18", currency: "NGN", orders: 1, grossMinor: 500000, share: 50 },
      ] },
      { currency: "GHS", days: [{ date: "2026-11-18", currency: "GHS", orders: 1, grossMinor: 3000, share: 100 }] },
    ]);
    expect(dayBars([])).toEqual([]);
  });

  it("labels a zone date without shifting it", () => {
    expect(dayLabel("2026-11-19", "en-GB")).toBe("Thu 19 Nov");
    expect(dayLabel("bad", "en-GB")).toBe("bad");
  });
});
