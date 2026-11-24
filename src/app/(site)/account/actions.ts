"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { api } from "@/lib/api/server";
import { ApiError, problemMessage } from "@/lib/api/problem";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isEmailPreference, readProfileForm, type EmailPreference, type ProfileField } from "./account-input";
import type { MePatch } from "./me";

// Your account (Change 5 chunk 3, FR-35, D93). Personal details and email preferences go to
// PATCH /v1/me; the avatar is uploaded through /api/me/profile/images (the same route as host
// Settings → Profile) and removed here; "Sign out of all devices" ends every session of the account.

export type ProfileState =
  | { ok: true; at: number }
  | { ok: false; message: string; fields: Partial<Record<ProfileField, string>> }
  | undefined;
export type Result = { ok: true } | { ok: false; message: string };

const API_FIELDS: Record<string, ProfileField> = { fullName: "fullName", phone: "phone", gender: "gender" };

async function patchMe(body: MePatch): Promise<void> {
  // The body's new fields (phone, gender, avatarPath, emailPreferences) are in the API's contract (D93).
  await (await api()).PATCH("/v1/me", { body });
}

async function failure(error: unknown, scope: string): Promise<string> {
  const t = await getTranslations("account.page");
  if (error instanceof ApiError && error.status === 401) return t("signedOut");
  if (!(error instanceof ApiError)) console.error(`[account] ${scope}`, error);
  const [errors, lang] = await Promise.all([getTranslations("errors"), getLocale()]);
  return problemMessage(error, errors, lang, t("saveFailed"));
}

/** Saves name, phone and gender. Field problems come back per field, translated. */
export async function saveProfile(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  await requireUser("/account");
  const t = await getTranslations("account.page.profile");
  const read = readProfileForm(form);
  if (!read.ok) {
    const fields = Object.fromEntries(Object.entries(read.fields).map(([field, problem]) => [field, t(`errors.${problem}`)]));
    return { ok: false, message: t("fixErrors"), fields };
  }
  try {
    await patchMe(read.value);
    revalidatePath("/account");
    return { ok: true, at: Date.now() };
  } catch (error) {
    const fields: Partial<Record<ProfileField, string>> = {};
    if (error instanceof ApiError) {
      const [errors, lang] = await Promise.all([getTranslations("errors"), getLocale()]);
      for (const issue of error.problem.errors ?? []) {
        const field = API_FIELDS[issue.field];
        if (field) fields[field] = lang !== "en" && errors.has(issue.code) ? errors(issue.code) : issue.message;
      }
    }
    const message = await failure(error, "save profile");
    return { ok: false, message: Object.keys(fields).length > 0 ? t("fixErrors") : message, fields };
  }
}

/** Removes the avatar (the picture goes; initials show instead). */
export async function removeAvatar(): Promise<Result> {
  await requireUser("/account");
  try {
    await patchMe({ avatarPath: null });
    revalidatePath("/account");
    revalidatePath("/host/settings/profile");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: await failure(error, "remove avatar") };
  }
}

/** Turns one email preference on or off. Tickets, receipts and security emails always arrive. */
export async function setEmailPreference(key: EmailPreference, on: boolean): Promise<Result> {
  await requireUser("/account");
  if (!isEmailPreference(key) || typeof on !== "boolean") return { ok: false, message: (await getTranslations("account.page"))("saveFailed") };
  try {
    await patchMe({ emailPreferences: { [key]: on } });
    revalidatePath("/account");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: await failure(error, "email preference") };
  }
}

/** Ends every session of this account, on every device (Supabase's global sign-out), then home. */
export async function signOutEverywhere(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) {
    console.error(`[account] global sign-out failed: ${error.status ?? "?"} ${error.message}`);
    redirect("/account?sessions=failed");
  }
  revalidatePath("/", "layout");
  redirect("/");
}

/** Removes a passkey or the authenticator app from the account page (needs a confirmed session). */
export async function removeSecurityMethod(formData: FormData): Promise<void> {
  await requireUser("/account");
  const supabase = await createSupabaseServerClient();
  const factorId = String(formData.get("factor_id") ?? "");
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  redirect(error ? "/account?security=remove-failed#security" : "/account?security=removed#security");
}
