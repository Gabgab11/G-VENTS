import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Two-step sign-in (D54) with an authenticator app (TOTP, Supabase Auth MFA). Required for
// platform staff (the admin dashboard); optional for everyone else. The API decides who needs it:
// it answers 403 auth.mfa_required until this session is at level aal2.

export type MfaState = {
  /** This session's level: aal1 = signed in, aal2 = also confirmed with the authenticator app. */
  level: "aal1" | "aal2" | null;
  /** The verified authenticator app, if one is set up. */
  factor: Method | null;
  /** Verified passkeys (WebAuthn), newest first. */
  passkeys: Method[];
};

export type Method = { id: string; name: string | null; createdAt: string };

export async function mfaState(): Promise<MfaState> {
  const supabase = await createSupabaseServerClient();
  const [{ data: aal }, { data: factors }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  const all = factors?.all ?? [];
  const toMethod = (f: { id: string; friendly_name?: string | null; created_at: string }): Method => ({ id: f.id, name: f.friendly_name ?? null, createdAt: f.created_at });
  const totp = all.find((f) => f.factor_type === "totp" && f.status === "verified");
  const passkeys = all
    .filter((f) => f.factor_type === "webauthn" && f.status === "verified")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(toMethod);
  return {
    level: (aal?.currentLevel as MfaState["level"]) ?? null,
    factor: totp ? toMethod(totp) : null,
    passkeys,
  };
}

/** Only same-site paths are followed after verifying, never another site. */
export function safeNext(raw: unknown, fallback = "/dashboard"): string {
  const next = typeof raw === "string" ? raw : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}
