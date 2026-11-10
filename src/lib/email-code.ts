// Email sign-in codes: input checks and the messages people see. Pure, so the server actions in
// src/app/auth/actions.ts stay thin and this is unit-tested. Supabase's own error text is never
// shown: it can name internals, and its wording changes between releases.

export type AuthMode = "signin" | "signup";

export type SendCodeResult =
  | { ok: true }
  | { ok: false; reason: "no_account" | "invalid" | "rate_limited" | "captcha" | "failed"; message: string };

export type VerifyCodeResult = { ok: true } | { ok: false; message: string };

/** What Supabase's AuthError carries that matters here. */
export type AuthFailure = { code?: string; status?: number; message?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE = /^\d{6}$/;

/** The address as Supabase stores it, or null when it can't be one. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

export function isSixDigitCode(raw: unknown): raw is string {
  return typeof raw === "string" && CODE.test(raw);
}

export function isAuthMode(raw: unknown): raw is AuthMode {
  return raw === "signin" || raw === "signup";
}

export function sendFailure(error: AuthFailure, mode: AuthMode): Exclude<SendCodeResult, { ok: true }> {
  const code = error.code ?? "";
  // Log in for an address with no account: Supabase refuses because sign-ups are off for this call.
  if (mode === "signin" && (code === "otp_disabled" || code === "signup_disabled" || /signups? not allowed/i.test(error.message ?? ""))) {
    return { ok: false, reason: "no_account", message: "There's no account for this email yet." };
  }
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || error.status === 429) {
    return { ok: false, reason: "rate_limited", message: "Too many codes were requested. Wait a minute, then try again." };
  }
  if (code === "captcha_failed") {
    return { ok: false, reason: "captcha", message: "The robot check didn't pass. Try again, or continue with Google." };
  }
  if (code === "email_address_invalid" || code === "validation_failed") {
    return { ok: false, reason: "invalid", message: "Enter a valid email address." };
  }
  return { ok: false, reason: "failed", message: "We couldn't send a code right now. Try again in a moment." };
}

export function verifyFailure(error: AuthFailure): Exclude<VerifyCodeResult, { ok: true }> {
  if (error.code === "over_request_rate_limit" || error.status === 429) {
    return { ok: false, message: "Too many tries. Wait a minute, then request a new code." };
  }
  return { ok: false, message: "That code is wrong or has expired. Try again or request a new one." };
}
