import { describe, expect, it } from "vitest";
import en from "../../messages/en/shared.json";
import { isAuthMode, isSixDigitCode, normalizeEmail, sendFailure, sendFailureKey, sendFailureReasonKey, verifyFailure, verifyFailureKey, type AuthFailure, type AuthMode } from "./email-code";

describe("email sign-in codes", () => {
  it("normalizes addresses and refuses what can't be one", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
    expect(normalizeEmail("no-at-sign")).toBeNull();
    expect(normalizeEmail("a@b")).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
    expect(normalizeEmail(`${"a".repeat(250)}@x.io`)).toBeNull();
  });

  it("accepts only six digits as a code", () => {
    expect(isSixDigitCode("012345")).toBe(true);
    expect(isSixDigitCode("12345")).toBe(false);
    expect(isSixDigitCode("12345a")).toBe(false);
    expect(isSixDigitCode(123456)).toBe(false);
  });

  it("accepts only the two modes", () => {
    expect(isAuthMode("signin")).toBe(true);
    expect(isAuthMode("signup")).toBe(true);
    expect(isAuthMode("admin")).toBe(false);
  });

  it("points log in for an unknown address to sign up", () => {
    expect(sendFailure({ code: "otp_disabled" }, "signin").reason).toBe("no_account");
    expect(sendFailure({ message: "Signups not allowed for otp" }, "signin").reason).toBe("no_account");
    // On sign up the same refusal is a real failure, not "no account".
    expect(sendFailure({ code: "otp_disabled" }, "signup").reason).toBe("failed");
  });

  it("explains rate limits, the robot check and bad addresses", () => {
    expect(sendFailure({ code: "over_email_send_rate_limit", status: 429 }, "signup").reason).toBe("rate_limited");
    expect(sendFailure({ status: 429 }, "signin").reason).toBe("rate_limited");
    expect(sendFailure({ code: "captcha_failed" }, "signup").reason).toBe("captcha");
    expect(sendFailure({ code: "email_address_invalid" }, "signup").reason).toBe("invalid");
  });

  it("never shows Supabase's own error text", () => {
    const secret = "relation auth.users violates something internal";
    expect(sendFailure({ code: "unexpected_failure", status: 500, message: secret }, "signup").message).not.toContain(secret);
    expect(verifyFailure({ code: "otp_expired", message: secret }).message).not.toContain(secret);
  });

  it("tells a wrong code from too many tries", () => {
    expect(verifyFailure({ code: "otp_expired", status: 403 }).message).toMatch(/wrong or has expired/);
    expect(verifyFailure({ status: 429 }).message).toMatch(/Too many tries/);
  });

  it("gives message ids whose English is the old text (Change 3)", () => {
    const msg = (id: string) => {
      const [area, group, key] = id.split(".");
      expect(area).toBe("shared");
      return (en as unknown as Record<string, Record<string, string>>)[group!]![key!];
    };
    const errors: AuthFailure[] = [
      { code: "otp_disabled" }, { message: "Signups not allowed for otp" }, { code: "over_email_send_rate_limit" }, { status: 429 },
      { code: "captcha_failed" }, { code: "email_address_invalid" }, { code: "validation_failed" }, { code: "otp_expired", status: 403 }, {},
    ];
    for (const error of errors) {
      for (const mode of ["signin", "signup"] as AuthMode[]) {
        const old = sendFailure(error, mode);
        expect(msg(sendFailureKey(error, mode))).toBe(old.message);
        expect(sendFailureReasonKey(old.reason)).toBe(sendFailureKey(error, mode));
      }
      expect(msg(verifyFailureKey(error))).toBe(verifyFailure(error).message);
    }
  });
});
