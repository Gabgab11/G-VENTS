import { describe, expect, it } from "vitest";
import { isCheckoutUrl, paidOrderBody, placeOrderBody } from "./order-input";

const A = "0190a000-0000-7000-8000-00000000000a";
const B = "0190a000-0000-7000-8000-00000000000b";
const Q = "0190a000-0000-7000-8000-0000000000aa";
const PHONE = "+2348031234567";

/** A form with the required phone (4b) unless the entries give their own. */
function form(entries: [string, string][]): FormData {
  const fd = new FormData();
  const all: [string, string][] = entries.some(([k]) => k === "buyer_phone") ? entries : [["buyer_phone_country", "NG"], ["buyer_phone", "0803 123 4567"], ...entries];
  for (const [k, v] of all) fd.append(k, v);
  return fd;
}

describe("placeOrderBody", () => {
  it("one line per ticket type; answers once; buyer name, phone and gender; recipients", () => {
    expect(
      placeOrderBody(form([
        ["event_id", "x"], [`qty_${A}`, "2"], [`qty_${B}`, "1"], [`q_${Q}`, " Acme "], ["buyer_name", "Ada Obi"], ["buyer_gender", "female"],
        ["tickets_for", "others"], ["recipient_name_2", "Tolu Ade"], ["recipient_email_2", "Tolu@Example.com"], ["recipient_name_3", "Bisi"], ["recipient_email_3", ""],
      ])),
    ).toEqual({
      lines: [{ ticketTypeId: A, quantity: 2 }, { ticketTypeId: B, quantity: 1 }],
      recipients: [{ name: "Tolu Ade", email: "tolu@example.com" }, { name: "Bisi" }],
      buyerPhone: PHONE,
      buyerGender: "female",
      answers: { [Q]: "Acme" },
      buyerName: "Ada Obi",
    });
  });

  it("skips zero quantities and leaves out empty extras; recipients only when sending to others", () => {
    expect(placeOrderBody(form([[`qty_${A}`, "1"], [`qty_${B}`, "0"], ["buyer_gender", "other"], ["tickets_for", "me"], ["recipient_name_2", "Tolu"]])))
      .toEqual({ lines: [{ ticketTypeId: A, quantity: 1 }], buyerPhone: PHONE });
  });

  it("needs 1 to 10 purchases", () => {
    expect(placeOrderBody(form([[`qty_${A}`, "0"]]))).toEqual({ error: "chooseTicket" });
    expect(placeOrderBody(form([[`qty_${A}`, "6"], [`qty_${B}`, "5"]]))).toEqual({ error: "ticketRange" });
    expect(placeOrderBody(form([["qty_not-a-uuid", "3"]]))).toEqual({ error: "chooseTicket" });
  });

  it("needs a phone it can turn into E.164", () => {
    expect(placeOrderBody(form([[`qty_${A}`, "1"], ["buyer_phone", ""]]))).toEqual({ error: "phoneRequired" });
    expect(placeOrderBody(form([[`qty_${A}`, "1"], ["buyer_phone_country", "NG"], ["buyer_phone", "12"]]))).toEqual({ error: "phoneInvalid" });
    expect(placeOrderBody(form([[`qty_${A}`, "1"], ["buyer_phone_country", "GH"], ["buyer_phone", "024 123 4567"]]))).toMatchObject({ buyerPhone: "+233241234567" });
  });

  it("refuses a recipient without a name or with a bad email", () => {
    expect(placeOrderBody(form([[`qty_${A}`, "2"], ["tickets_for", "others"], ["recipient_name_2", ""]]))).toEqual({ error: "recipientName" });
    expect(placeOrderBody(form([[`qty_${A}`, "2"], ["tickets_for", "others"], ["recipient_name_2", "Tolu"], ["recipient_email_2", "tolu@"]]))).toEqual({ error: "recipientEmail" });
  });
});

describe("paidOrderBody (M5)", () => {
  it("needs the non-refundable tick, then sends it with the lines", () => {
    expect(paidOrderBody(form([[`qty_${A}`, "2"]]))).toEqual({ error: "nonRefundable" });
    expect(paidOrderBody(form([[`qty_${A}`, "2"], ["non_refundable", "on"]]))).toEqual({ lines: [{ ticketTypeId: A, quantity: 2 }], buyerPhone: PHONE, nonRefundableAccepted: true });
  });
  it("joins the waiting list only when asked", () => {
    expect(paidOrderBody(form([[`qty_${A}`, "1"], ["non_refundable", "on"], ["join_waitlist", "true"]]))).toMatchObject({ joinWaitlist: true });
    expect(paidOrderBody(form([[`qty_${A}`, "1"], ["non_refundable", "on"], ["join_waitlist", "false"]]))).not.toHaveProperty("joinWaitlist");
  });
  it("keeps the free-order checks", () => {
    expect(paidOrderBody(form([["non_refundable", "on"]]))).toEqual({ error: "chooseTicket" });
  });
});

describe("isCheckoutUrl", () => {
  it("follows https checkout links and the local fake only", () => {
    expect(isCheckoutUrl("https://checkout.paystack.com/abc123")).toBe(true);
    expect(isCheckoutUrl("http://localhost:4000/fake-checkout/x")).toBe(true);
    for (const bad of ["http://evil.example/x", "javascript:alert(1)", "/orders/1", "", null]) expect(isCheckoutUrl(bad), String(bad)).toBe(false);
  });
});

describe("paidOrderBody with a discount code (D91)", () => {
  it("sends the applied code, upper-cased", () => {
    expect(paidOrderBody(form([[`qty_${A}`, "1"], ["non_refundable", "on"], ["code", " early10 "]]))).toEqual({
      lines: [{ ticketTypeId: A, quantity: 1 }],
      buyerPhone: PHONE,
      nonRefundableAccepted: true,
      code: "EARLY10",
    });
  });

  it("leaves out a blank or malformed code, and any code when joining the waiting list", () => {
    expect(paidOrderBody(form([[`qty_${A}`, "1"], ["non_refundable", "on"], ["code", ""]]))).not.toHaveProperty("code");
    expect(paidOrderBody(form([[`qty_${A}`, "1"], ["non_refundable", "on"], ["code", "no spaces!"]]))).not.toHaveProperty("code");
    expect(paidOrderBody(form([[`qty_${A}`, "1"], ["non_refundable", "on"], ["join_waitlist", "true"], ["code", "EARLY10"]]))).toEqual({
      lines: [{ ticketTypeId: A, quantity: 1 }],
      buyerPhone: PHONE,
      nonRefundableAccepted: true,
      joinWaitlist: true,
    });
  });
});
