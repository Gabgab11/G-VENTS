import { describe, expect, it } from "vitest";
import { isCheckoutUrl, paidOrderBody, placeOrderBody } from "./order-input";

const A = "0190a000-0000-7000-8000-00000000000a";
const B = "0190a000-0000-7000-8000-00000000000b";
const Q = "0190a000-0000-7000-8000-0000000000aa";

function form(entries: [string, string][]): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

describe("placeOrderBody", () => {
  it("one line per ticket type with a quantity; names for tickets 2..n; answers once; buyer name", () => {
    expect(
      placeOrderBody(form([["event_id", "x"], [`qty_${A}`, "2"], [`qty_${B}`, "1"], ["guest_2", "Tolu"], ["guest_3", ""], [`q_${Q}`, " Acme "], ["buyer_name", "Ada Obi"]])),
    ).toEqual({
      lines: [{ ticketTypeId: A, quantity: 2 }, { ticketTypeId: B, quantity: 1 }],
      guestNames: ["", "Tolu", ""],
      answers: { [Q]: "Acme" },
      buyerName: "Ada Obi",
    });
  });

  it("skips zero quantities and leaves out empty extras", () => {
    expect(placeOrderBody(form([[`qty_${A}`, "1"], [`qty_${B}`, "0"]]))).toEqual({ lines: [{ ticketTypeId: A, quantity: 1 }] });
  });

  it("needs 1 to 10 tickets", () => {
    expect(placeOrderBody(form([[`qty_${A}`, "0"]]))).toEqual({ error: "Choose at least one ticket." });
    expect(placeOrderBody(form([[`qty_${A}`, "6"], [`qty_${B}`, "5"]]))).toEqual({ error: "Choose between 1 and 10 tickets." });
    expect(placeOrderBody(form([["qty_not-a-uuid", "3"]]))).toEqual({ error: "Choose at least one ticket." });
  });
});

describe("paidOrderBody (M5)", () => {
  it("needs the non-refundable tick, then sends it with the lines", () => {
    expect(paidOrderBody(form([[`qty_${A}`, "2"]]))).toEqual({ error: expect.stringContaining("non-refundable") });
    expect(paidOrderBody(form([[`qty_${A}`, "2"], ["non_refundable", "on"]]))).toEqual({ lines: [{ ticketTypeId: A, quantity: 2 }], nonRefundableAccepted: true });
  });
  it("joins the waiting list only when asked", () => {
    expect(paidOrderBody(form([[`qty_${A}`, "1"], ["non_refundable", "on"], ["join_waitlist", "true"]]))).toMatchObject({ joinWaitlist: true });
    expect(paidOrderBody(form([[`qty_${A}`, "1"], ["non_refundable", "on"], ["join_waitlist", "false"]]))).not.toHaveProperty("joinWaitlist");
  });
  it("keeps the free-order checks", () => {
    expect(paidOrderBody(form([["non_refundable", "on"]]))).toEqual({ error: "Choose at least one ticket." });
  });
});

describe("isCheckoutUrl", () => {
  it("follows https checkout links and the local fake only", () => {
    expect(isCheckoutUrl("https://checkout.paystack.com/abc123")).toBe(true);
    expect(isCheckoutUrl("http://localhost:4000/fake-checkout/x")).toBe(true);
    for (const bad of ["http://evil.example/x", "javascript:alert(1)", "/orders/1", "", null]) expect(isCheckoutUrl(bad), String(bad)).toBe(false);
  });
});
