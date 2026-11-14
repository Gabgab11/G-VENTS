"use server";

import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/mfa";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { optionsToJSON } from "@/lib/webauthn-json";

// Passkeys as the second step of sign-in (D54): a passkey on this device (Touch ID, Face ID,
// Windows Hello, a phone or a security key) confirms the session to level aal2, like the
// authenticator app. The ceremony is split: Supabase's options come through here as JSON, the
// browser asks the device, and the signed result comes back here to be verified.

type Started = { factorId: string; challengeId: string; options: Record<string, unknown> } | { error: string };
type Finished = { ok: true; next: string } | { error: string };

/** This site's identity for passkeys: the domain they belong to, and the page origin. */
function relyingParty() {
  const url = new URL(env.siteUrl);
  return { rpId: url.hostname, rpOrigins: [url.origin] };
}

function friendly(error: { message?: string; status?: number } | null): string {
  if (!error) return "That didn't work. Please try again.";
  if (/disabled/i.test(error.message ?? "")) return "Passkeys aren't switched on for this site yet.";
  if (error.status === 422 || error.status === 400) return "That passkey couldn't be confirmed. Please try again.";
  return "That didn't work. Please try again.";
}

/** Starts adding a passkey: returns the options for navigator.credentials.create(). */
export async function startPasskeyEnroll(name: string): Promise<Started> {
  await requireUser("/account/security");
  const supabase = await createSupabaseServerClient();
  const label = (name.trim() || "Passkey").slice(0, 60);
  // Names must be unique among the user's factors, and an unfinished attempt would block a retry.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "webauthn" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const taken = new Set((factors?.all ?? []).map((f) => f.friendly_name));
  const friendlyName = taken.has(label) ? `${label} (${new Date().toISOString().slice(0, 16).replace("T", " ")})` : label;

  const enrolled = await supabase.auth.mfa.enroll({ factorType: "webauthn", friendlyName });
  if (enrolled.error || !enrolled.data) {
    console.error(`[passkey] enroll failed: ${enrolled.error?.message ?? "no data"}`);
    return { error: friendly(enrolled.error) };
  }
  const challenge = await supabase.auth.mfa.challenge({ factorId: enrolled.data.id, webauthn: relyingParty() });
  if (challenge.error || !challenge.data || !("webauthn" in challenge.data)) {
    console.error(`[passkey] challenge failed: ${challenge.error?.message ?? "no options"}`);
    return { error: friendly(challenge.error) };
  }
  return {
    factorId: enrolled.data.id,
    challengeId: challenge.data.id,
    options: optionsToJSON(challenge.data.webauthn.credential_options.publicKey) as Record<string, unknown>,
  };
}

/** Starts confirming this session with an existing passkey: options for navigator.credentials.get(). */
export async function startPasskeyVerify(factorId: string): Promise<Started> {
  await requireUser("/account/security");
  const supabase = await createSupabaseServerClient();
  const challenge = await supabase.auth.mfa.challenge({ factorId, webauthn: relyingParty() });
  if (challenge.error || !challenge.data || !("webauthn" in challenge.data)) {
    console.error(`[passkey] challenge failed: ${challenge.error?.message ?? "no options"}`);
    return { error: friendly(challenge.error) };
  }
  return { factorId, challengeId: challenge.data.id, options: optionsToJSON(challenge.data.webauthn.credential_options.publicKey) as Record<string, unknown> };
}

/** Finishes either ceremony with the browser's credential (JSON). On success the session is aal2. */
export async function finishPasskey(input: { factorId: string; challengeId: string; type: "create" | "request"; credential: Record<string, unknown>; next?: string }): Promise<Finished> {
  await requireUser("/account/security");
  const supabase = await createSupabaseServerClient();
  // Supabase serialises the credential with its toJSON(); ours is already JSON, so hand it back as is.
  const credential = { ...input.credential, toJSON: () => input.credential } as never;
  const { error } = await supabase.auth.mfa.verify({
    factorId: input.factorId,
    challengeId: input.challengeId,
    webauthn: { ...relyingParty(), type: input.type, credential_response: credential },
  });
  if (error) {
    console.error(`[passkey] verify failed: ${error.message}`);
    return { error: friendly(error) };
  }
  return { ok: true, next: safeNext(input.next, "/account/security?done=1") };
}
