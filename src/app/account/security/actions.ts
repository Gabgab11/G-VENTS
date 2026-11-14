"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { safeNext } from "@/lib/mfa";

export type EnrollState = { factorId?: string; qr?: string; secret?: string; error?: string } | undefined;
export type VerifyState = { error?: string } | undefined;

const CODE = /^\d{6}$/;
const GENERIC = "That didn't work. Please try again.";

function code(formData: FormData): string {
  return String(formData.get("code") ?? "").replace(/\s+/g, "");
}

/** Starts setting up an authenticator app: returns the QR code and the secret to type in instead. */
export async function startEnroll(): Promise<EnrollState> {
  await requireUser("/account/security");
  const supabase = await createSupabaseServerClient();
  // An unfinished earlier attempt blocks a new one with the same name, so clear those first.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
  if (error || !data) {
    console.error(`[mfa] enroll failed: ${error?.message ?? "no data"}`);
    return { error: "Two-step sign-in couldn't be set up right now. Please try again." };
  }
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Confirms the new authenticator app with its first code; the session moves to aal2. */
export async function finishEnroll(_prev: EnrollState, formData: FormData): Promise<EnrollState> {
  await requireUser("/account/security");
  const factorId = String(formData.get("factor_id") ?? "");
  const value = code(formData);
  const keep = { factorId, qr: String(formData.get("qr") ?? ""), secret: String(formData.get("secret") ?? "") };
  if (!CODE.test(value)) return { ...keep, error: "Enter the 6-digit code from your authenticator app." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: value });
  if (error) return { ...keep, error: error.status === 422 || error.status === 400 ? "That code isn't right, or it expired. Try the current one." : GENERIC };
  redirect(safeNext(formData.get("next"), "/account/security?done=1"));
}

/** Confirms this session with the authenticator app (step up to aal2), then goes on. */
export async function verifyCode(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  await requireUser("/account/security");
  const value = code(formData);
  if (!CODE.test(value)) return { error: "Enter the 6-digit code from your authenticator app." };
  const supabase = await createSupabaseServerClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.find((f) => f.status === "verified");
  if (!factor) return { error: "Set up an authenticator app first." };
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: value });
  if (error) return { error: error.status === 422 || error.status === 400 ? "That code isn't right, or it expired. Try the current one." : GENERIC };
  redirect(safeNext(formData.get("next")));
}

/** Removes the authenticator app. Only from a session already confirmed with it (aal2). */
export async function removeFactor(formData: FormData): Promise<void> {
  await requireUser("/account/security");
  const supabase = await createSupabaseServerClient();
  const factorId = String(formData.get("factor_id") ?? "");
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  redirect(error ? "/account/security?err=remove" : "/account/security?removed=1");
}
