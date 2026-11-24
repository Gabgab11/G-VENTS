"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/redirect";
import { syncLanguageAfterSignIn } from "@/i18n/sync";
import {
  isAuthMode,
  isSixDigitCode,
  normalizeEmail,
  sendFailure,
  sendFailureReasonKey,
  verifyFailure,
  verifyFailureKey,
  type AuthFailure,
  type AuthMode,
  type SendCodeResult,
  type VerifyCodeResult,
} from "@/lib/email-code";

// Sign-in runs on the server: the browser only talks to this site, never to Supabase (the CSP's
// connect-src is 'self'). Supabase sets the session cookie through the server client. Messages come
// back already translated into the reader's language (shared.emailCode.*, auth.screen.*).

/**
 * Ends the session on this device only ("Sign out of all devices" on /account ends every session).
 * No redirect here: a server-action redirect is a soft navigation that keeps the browser's cached
 * session, so the header still looked signed in. The caller (useSignOut) reloads onto /sign-in.
 */
export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
}

/**
 * Emails a 6-digit code. Log in sends codes to existing accounts only; sign up creates the account
 * (unconfirmed until the code is entered). Both Supabase templates, "Magic link" and "Confirm
 * signup", must carry {{ .Token }}, or new accounts get a link instead of a code.
 */
export async function sendEmailCode(input: { email: unknown; mode: unknown; captchaToken?: unknown }): Promise<SendCodeResult> {
  const email = normalizeEmail(input.email);
  const t = await getTranslations();
  if (!email) return { ok: false, reason: "invalid", message: t(sendFailureReasonKey("invalid")) };
  const mode: AuthMode = isAuthMode(input.mode) ? input.mode : "signin";
  const captchaToken = typeof input.captchaToken === "string" && input.captchaToken.length <= 4096 ? input.captchaToken : undefined;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: mode === "signup", ...(captchaToken ? { captchaToken } : {}) },
  });
  if (!error) return { ok: true };
  const failure = sendFailure(error, mode);
  if (failure.reason === "failed") console.error(`[auth] send code: ${error.status ?? "?"} ${error.code ?? "?"}`);
  return { ...failure, message: t(sendFailureReasonKey(failure.reason)) };
}

/** Checks the code. On success the session cookie is set and the email counts as verified. */
export async function verifyEmailCode(input: { email: unknown; code: unknown }): Promise<VerifyCodeResult> {
  const email = normalizeEmail(input.email);
  const t = await getTranslations();
  const failed = (error: AuthFailure) => ({ ...verifyFailure(error), message: t(verifyFailureKey(error)) });
  if (!email || !isSixDigitCode(input.code)) return failed({});
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: input.code, type: "email" });
  if (error) return failed(error);
  await syncLanguageAfterSignIn();
  revalidatePath("/", "layout");
  return { ok: true };
}

/** The Google consent URL. The PKCE verifier goes in a cookie; /auth/callback finishes sign-in. */
export async function startGoogleSignIn(next: unknown): Promise<{ url: string } | { error: string }> {
  const incoming = await headers();
  const origin = incoming.get("origin") ?? `${incoming.get("x-forwarded-proto") ?? "https"}://${incoming.get("host")}`;
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", safeNextPath(typeof next === "string" ? next : null));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString(), skipBrowserRedirect: true },
  });
  if (error || !data.url) return { error: (await getTranslations("auth.screen"))("googleUnavailable") };
  return { url: data.url };
}
