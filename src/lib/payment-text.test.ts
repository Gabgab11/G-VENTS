import { describe, expect, it } from "vitest";
import en from "../../messages/en/shared.json";
import {
  APPLICATION_STATUS, FEE_CHOICES, NON_REFUNDABLE_KEY, NON_REFUNDABLE_TEXT, ORGANIZER_KEY, ORGANIZER_TEXT, REFUND_STATUS, SELL_REASONS,
  applicationStatusKey, feeChoiceKey, refundStatusKey, sellReasonKey, sellReasonText, type FeeChoice,
} from "./payment-text";

// The English message for a full id ("shared.x.y").
function english(id: string | null | undefined): unknown {
  expect(id).toMatch(/^shared\./);
  return id!.split(".").slice(1).reduce<unknown>((node, k) => (node as Record<string, unknown> | undefined)?.[k], en);
}

describe("payment wording ids (Change 3)", () => {
  it("sell reasons: every id exists and its English is the old text", () => {
    for (const reason of [...Object.keys(SELL_REASONS), "unknown", null, undefined]) {
      const old = sellReasonText(reason);
      const { key, actionKey } = sellReasonKey(reason);
      expect(english(key)).toBe(old.text);
      if (old.action) expect(english(actionKey)).toBe(old.action);
      else expect(actionKey).toBeUndefined();
    }
  });

  it("fee choices", () => {
    for (const choice of Object.keys(FEE_CHOICES) as FeeChoice[]) {
      const { labelKey, hintKey } = feeChoiceKey(choice);
      expect(english(labelKey)).toBe(FEE_CHOICES[choice].label);
      expect(english(hintKey)).toBe(FEE_CHOICES[choice].hint);
    }
  });

  it("checkout texts and statuses", () => {
    expect(english(NON_REFUNDABLE_KEY)).toBe(NON_REFUNDABLE_TEXT);
    expect(english(ORGANIZER_KEY)).toBe(ORGANIZER_TEXT);
    for (const [s, text] of Object.entries(REFUND_STATUS)) expect(english(refundStatusKey(s))).toBe(text);
    for (const [s, text] of Object.entries(APPLICATION_STATUS)) expect(english(applicationStatusKey(s))).toBe(text);
    expect(refundStatusKey("nope")).toBeNull();
    expect(applicationStatusKey("toString")).toBeNull();
  });
});
