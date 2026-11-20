import { describe, expect, it } from "vitest";
import { cleanCode, codeParam, isDiscountProblem, quoteKey, quoteLines, withCode } from "./discount-code";

describe("discount codes on the booking page (D91)", () => {
  it("tidies a typed or linked code: trimmed, upper-cased, 3–32 of A-Z 0-9 - _", () => {
    expect(cleanCode(" early10 ")).toBe("EARLY10");
    expect(cleanCode("vip_2026-a")).toBe("VIP_2026-A");
    expect(cleanCode("ab")).toBeNull();
    expect(cleanCode("x".repeat(33))).toBeNull();
    expect(cleanCode("no spaces")).toBeNull();
    expect(cleanCode("<script>")).toBeNull();
    expect(cleanCode(undefined)).toBeNull();
    expect(cleanCode(42)).toBeNull();
  });

  it("reads ?code= (the first when repeated)", () => {
    expect(codeParam("early10")).toBe("EARLY10");
    expect(codeParam(["early10", "other"])).toBe("EARLY10");
    expect(codeParam(undefined)).toBeNull();
    expect(codeParam("bad code")).toBeNull();
  });

  it("carries ?code= from the event page to the booking page", () => {
    expect(withCode("/fr/e/jazz-ab12c/tickets", "early10")).toBe("/fr/e/jazz-ab12c/tickets?code=EARLY10");
    expect(withCode("/e/jazz-ab12c/tickets?x=1", "EARLY10")).toBe("/e/jazz-ab12c/tickets?x=1&code=EARLY10");
    expect(withCode("/e/jazz-ab12c/tickets", null)).toBe("/e/jazz-ab12c/tickets");
    expect(withCode("/e/jazz-ab12c/tickets", "a b")).toBe("/e/jazz-ab12c/tickets");
  });

  it("tells the code's own errors from other quote errors", () => {
    for (const code of ["discount.invalid", "discount.expired", "discount.used_up", "discount.not_for_ticket", "discount.whole_order", "rate_limit.exceeded"]) {
      expect(isDiscountProblem(code)).toBe(true);
    }
    for (const code of ["order.busy", "ticket_type.not_found", "event.closed", "", null, undefined]) expect(isDiscountProblem(code)).toBe(false);
  });

  it("maps the chosen quantities to quote lines and one key per request", () => {
    expect(quoteLines({ a: 2, b: 0, c: 1 })).toEqual([{ ticketTypeId: "a", quantity: 2 }, { ticketTypeId: "c", quantity: 1 }]);
    expect(quoteLines({})).toEqual([]);
    const lines = quoteLines({ a: 2 });
    expect(quoteKey(lines, "EARLY10")).toBe(quoteKey([{ ticketTypeId: "a", quantity: 2 }], "EARLY10"));
    expect(quoteKey(lines, "EARLY10")).not.toBe(quoteKey(lines, ""));
    expect(quoteKey(lines, null)).toBe(quoteKey(lines, ""));
  });
});
