import { describe, expect, it } from "vitest";
import { filterOf, listHref, pageOf, roleCanCheckIn, roleCanEdit, soldText, sumByCurrency } from "./events-list";

describe("events list helpers", () => {
  it("filterOf keeps known filters and falls back to all", () => {
    expect(filterOf("upcoming")).toBe("upcoming");
    expect(filterOf("drafts")).toBe("drafts");
    expect(filterOf("past")).toBe("past");
    expect(filterOf(undefined)).toBe("all");
    expect(filterOf("cancelled")).toBe("all");
    expect(filterOf("constructor")).toBe("all");
  });

  it("pageOf reads whole pages from 1", () => {
    expect(pageOf("3")).toBe(3);
    expect(pageOf("2.7")).toBe(2);
    expect(pageOf("-1")).toBe(1);
    expect(pageOf("x")).toBe(1);
    expect(pageOf(undefined)).toBe(1);
  });

  it("listHref leaves defaults out", () => {
    expect(listHref("all")).toBe("/host/events");
    expect(listHref("all", 2)).toBe("/host/events?page=2");
    expect(listHref("past", 1)).toBe("/host/events?filter=past");
    expect(listHref("drafts", 3)).toBe("/host/events?filter=drafts&page=3");
  });

  it("sumByCurrency adds per currency in integer minor units", () => {
    expect(sumByCurrency([])).toEqual([]);
    expect(sumByCurrency(undefined)).toEqual([]);
    expect(
      sumByCurrency([
        { currency: "NGN", grossMinor: 500000 },
        { currency: "GHS", grossMinor: 1250 },
        { currency: "NGN", grossMinor: 250001 },
      ]),
    ).toEqual([
      { currency: "NGN", grossMinor: 750001 },
      { currency: "GHS", grossMinor: 1250 },
    ]);
    expect(sumByCurrency([{ currency: "NGN", grossMinor: 1.5 }])).toEqual([]);
  });

  it("role checks match the API's roles", () => {
    expect(["owner", "admin", "editor", "checkin", "finance", "viewer"].filter(roleCanCheckIn)).toEqual(["owner", "admin", "editor", "checkin"]);
    expect(["owner", "admin", "editor", "checkin", "finance", "viewer"].filter(roleCanEdit)).toEqual(["owner", "admin", "editor"]);
  });

  it("soldText shows capacity when there is one", () => {
    const n = (x: number) => String(x);
    expect(soldText(82, 150, n)).toBe("82 / 150");
    expect(soldText(82, null, n)).toBe("82");
  });
});
