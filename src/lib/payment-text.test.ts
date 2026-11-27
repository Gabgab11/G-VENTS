import { describe, expect, it } from "vitest";
import en from "../../messages/en/shared.json";
import {
  APPLICATION_STATUS, FEE_CHOICES, NON_REFUNDABLE_KEY, NON_REFUNDABLE_TEXT, ORGANIZER_KEY, ORGANIZER_TEXT, REFUND_STATUS, SELL_REASONS,
  applicationStatusKey, feeChoiceKey, refundStatusKey, sellReasonKey, sellReasonText, type FeeChoice,
  PAYOUT_COUNTRIES, PAYSTACK_COUNTRIES, PROVIDER_METHODS, isPayoutCountry, isProviderId, providerName,
} from "./payment-text";
import eventEn from "../../messages/en/event.json";

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

describe("providers and countries (Change 5 chunk 4)", () => {
  const event = eventEn as unknown as { paid: { methods: Record<string, string> } };

  it("knows all 11 payout countries, Paystack's four among them", () => {
    expect(Object.keys(PAYOUT_COUNTRIES)).toEqual(["NG", "GH", "KE", "ZA", "UG", "TZ", "RW", "ZM", "CM", "CI", "SN"]);
    expect(PAYSTACK_COUNTRIES.every((c) => isPayoutCountry(c))).toBe(true);
    expect(isPayoutCountry("UG")).toBe(true);
    expect(isPayoutCountry("US")).toBe(false);
    expect(PAYOUT_COUNTRIES.CI.currency).toBe("XOF");
  });

  it("names providers, defaulting to Paystack for older orders", () => {
    expect(providerName("flutterwave")).toBe("Flutterwave");
    expect(providerName(null)).toBe("Paystack");
    expect(isProviderId("stripe")).toBe(false);
  });

  it("PS20: Google Pay and mobile money on Flutterwave only, and every method has words", () => {
    expect(PROVIDER_METHODS.paystack).toEqual(["card", "bankTransfer", "applePay"]);
    expect(PROVIDER_METHODS.flutterwave).toEqual(expect.arrayContaining(["googlePay", "mobileMoney", ...PROVIDER_METHODS.paystack]));
    for (const m of PROVIDER_METHODS.flutterwave) expect(event.paid.methods[m], m).toBeTruthy();
  });
});
