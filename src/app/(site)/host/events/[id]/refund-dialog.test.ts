import { describe, expect, it } from "vitest";
import { canRefundRow, initialRefundView, opensOnLoad, refundReducer, refundReturnPath, twoStepHref, type RefundState } from "./refund-dialog";

const EVENT = "01a1da7b-1057-7551-8cb3-d89c23f4b84a";
const TICKET = "0b0c7a52-6c3d-4a8e-9f55-2f1f1b0c0d0e";

describe("refund dialog (Change 4 follow-up, step 3)", () => {
  it("asks for two-step sign-in unless the session already used it", () => {
    expect(initialRefundView("aal2")).toBe("confirm");
    expect(initialRefundView("aal1")).toBe("two_step");
    expect(initialRefundView(null)).toBe("two_step");
  });

  it("sends the host to two-step sign-in and back to the same ticket's dialog", () => {
    expect(refundReturnPath(EVENT, TICKET)).toBe(`/host/events/${EVENT}?tab=guests&refund=${TICKET}`);
    const href = twoStepHref(EVENT, TICKET);
    expect(href.startsWith("/host/settings/security?next=")).toBe(true);
    expect(new URL(href, "https://x.test").searchParams.get("next")).toBe(refundReturnPath(EVENT, TICKET));
  });

  it("reopens only the requested ticket's dialog", () => {
    expect(opensOnLoad(TICKET, TICKET)).toBe(true);
    expect(opensOnLoad("other", TICKET)).toBe(false);
    expect(opensOnLoad(undefined, TICKET)).toBe(false);
    expect(opensOnLoad("", TICKET)).toBe(false);
  });

  it("offers a refund only on paid, confirmed tickets with money to return and no refund under way", () => {
    const row = { paid: true, status: "confirmed", refundableMinor: 21_382_500, refundStatus: null };
    expect(canRefundRow(row)).toBe(true);
    expect(canRefundRow({ ...row, refundStatus: "failed" })).toBe(true);
    expect(canRefundRow({ ...row, refundStatus: "queued" })).toBe(false);
    expect(canRefundRow({ ...row, paid: false })).toBe(false);
    expect(canRefundRow({ ...row, status: "refunded" })).toBe(false);
    expect(canRefundRow({ ...row, refundableMinor: 0 })).toBe(false);
    expect(canRefundRow({ ...row, refundableMinor: null })).toBe(false);
  });

  it("keeps the dialog open with the error, and switches to two-step when the API asks for it", () => {
    const start: RefundState = { view: "confirm", confirmed: false, error: null, reason: null };
    const ticked = refundReducer(start, { type: "confirm", checked: true });
    expect(ticked.confirmed).toBe(true);

    const failed = refundReducer(ticked, { type: "result", result: { ok: false, error: "Paystack couldn't start this refund.", reason: "Transaction has been fully reversed" } });
    expect(failed).toEqual({ view: "confirm", confirmed: true, error: "Paystack couldn't start this refund.", reason: "Transaction has been fully reversed" });

    // Changing the tick clears the old error.
    expect(refundReducer(failed, { type: "confirm", checked: false })).toEqual({ ...start });

    const twoStep = refundReducer(ticked, { type: "result", result: { ok: false, error: "x", twoStep: true } });
    expect(twoStep).toEqual({ view: "two_step", confirmed: false, error: null, reason: null });

    expect(refundReducer(failed, { type: "result", result: { ok: true, status: "queued" } }).error).toBeNull();
    expect(refundReducer(failed, { type: "reset", view: "two_step" })).toEqual({ view: "two_step", confirmed: false, error: null, reason: null });
  });
});
