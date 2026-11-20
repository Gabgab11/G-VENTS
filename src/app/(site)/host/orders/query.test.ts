import { describe, expect, it } from "vitest";
import { ordersHref, ordersQuery, statusTone } from "./query";

const ID = "01a1d9b2-5be7-70f5-a17f-4da4c8c3095a";

describe("ordersQuery", () => {
  it("reads page, event and status", () => {
    expect(ordersQuery({ page: "3", event: ID, status: "refunded" })).toEqual({ page: 3, eventId: ID, status: "refunded" });
  });
  it("drops what the API would refuse", () => {
    expect(ordersQuery({ page: "-2", event: "nope", status: "paid" })).toEqual({ page: 1, eventId: undefined, status: undefined });
  });
});

describe("ordersHref", () => {
  it("keeps the filters and leaves out page 1", () => {
    expect(ordersHref({ page: 1 })).toBe("/host/orders");
    expect(ordersHref({ page: 2, eventId: ID, status: "completed" })).toBe(`/host/orders?event=${ID}&status=completed&page=2`);
  });
});

describe("statusTone", () => {
  it("colours settled, waiting and failed orders differently", () => {
    expect(statusTone("completed")).toBe("success");
    expect(statusTone("awaiting_payment")).toBe("warning");
    expect(statusTone("disputed")).toBe("danger");
    expect(statusTone("cancelled")).toBe("neutral");
  });
});
