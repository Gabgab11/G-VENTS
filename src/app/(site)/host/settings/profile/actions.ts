"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { api, data } from "@/lib/api/server";
import { ApiError, problemMessage } from "@/lib/api/problem";
import { BIO_MAX, LOCATION_MAX, handleProblem, normalizeHandle, socialInput, SOCIAL_FIELDS } from "@/lib/host-profile";

// Settings → Profile (Change 4 chunk 4, FR-32). The display name is the account's name (PATCH /v1/me);
// the rest is the host profile (PATCH /v1/me/profile). The API checks everything again, normalises
// links and refuses taken or reserved handles; its field errors come back per field, translated.

export type ProfileField = "handle" | "name" | "bio" | "location" | "instagram" | "facebook" | "x" | "website";
export type SaveState = { ok: true; handle: string | null; name: string; at: number } | { ok: false; message: string; fields: Partial<Record<ProfileField, string>> } | undefined;

const FIELDS: readonly ProfileField[] = ["handle", "name", "bio", "location", "instagram", "facebook", "x", "website"];
const str = (f: FormData, k: string, max = 2000) => String(f.get(k) ?? "").slice(0, max);

async function translator() {
  const [t, lang] = await Promise.all([getTranslations("errors"), getLocale()]);
  return { t, lang };
}

export async function saveProfile(_prev: SaveState, form: FormData): Promise<SaveState> {
  const st = await getTranslations("profile.settings");
  const handle = normalizeHandle(str(form, "handle", 100));
  const savedHandle = str(form, "savedHandle", 100);
  const name = str(form, "name", 200).trim();
  const savedName = str(form, "savedName", 200);
  const bio = str(form, "bio").trim();
  const location = str(form, "location").trim();

  // The same checks the API makes, so the common mistakes don't need a round trip.
  const fields: Partial<Record<ProfileField, string>> = {};
  const handleChanged = handle !== "" && handle !== savedHandle;
  if (handleChanged) {
    const problem = handleProblem(handle);
    if (problem) fields.handle = st(problem);
  }
  if (bio.length > BIO_MAX || location.length > LOCATION_MAX) {
    const { t } = await translator();
    if (bio.length > BIO_MAX) fields.bio = t("host.bio_invalid");
    if (location.length > LOCATION_MAX) fields.location = t("host.location_invalid");
  }
  if (Object.keys(fields).length > 0) return { ok: false, message: st("fixErrors"), fields };

  try {
    const client = await api();
    if (name !== savedName) await client.PATCH("/v1/me", { body: { fullName: name || null } });
    const body: Record<string, string | null> = { bio: bio || null, location: location || null };
    for (const field of SOCIAL_FIELDS) body[field] = socialInput(field, str(form, field, 1000));
    if (handleChanged) body.handle = handle;
    const profile = data(await client.PATCH("/v1/me/profile", { body }));
    revalidatePath("/host/settings/profile");
    revalidatePath("/host");
    return { ok: true, handle: profile.handle, name, at: Date.now() };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { ok: false, message: st("signedOut"), fields: {} };
    const { t, lang } = await translator();
    const message = problemMessage(error, t, lang, st("saveFailed"));
    if (error instanceof ApiError) {
      for (const issue of error.problem.errors ?? []) {
        const field = (FIELDS as readonly string[]).includes(issue.field) ? (issue.field as ProfileField) : null;
        if (field) fields[field] = lang !== "en" && t.has(issue.code) ? t(issue.code) : issue.message;
      }
      if (error.code === "host.handle_taken") fields.handle = message;
    } else {
      console.error("[profile] save", error);
    }
    return { ok: false, message: Object.keys(fields).length > 0 ? st("fixErrors") : message, fields };
  }
}

export type HandleCheck = "invalid" | "reserved" | "available" | "taken" | "yours" | "unknown";

/**
 * Whether a handle can be had, for the live check. There's no availability endpoint, so this asks for
 * the public profile: 404 means nobody has it (or had it recently: the API's hold then shows on save).
 */
export async function checkHandle(raw: string, ownId: string): Promise<HandleCheck> {
  const problem = handleProblem(raw);
  if (problem) return problem;
  const handle = normalizeHandle(raw);
  try {
    const profile = data(await (await api({ anonymous: true })).GET("/v1/hosts/{handle}", { params: { path: { handle }, query: { limit: 1 } } }));
    return profile.id === ownId && !profile.movedTo ? "yours" : "taken";
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return "available";
    return "unknown";
  }
}

export type RemoveResult = { ok: true } | { ok: false; message: string };

export async function removeProfileImage(kind: "avatar" | "cover"): Promise<RemoveResult> {
  try {
    await (await api()).PATCH("/v1/me/profile", { body: kind === "avatar" ? { avatarPath: null } : { coverPath: null } });
    revalidatePath("/host/settings/profile");
    return { ok: true };
  } catch (error) {
    const st = await getTranslations("profile.settings");
    if (error instanceof ApiError && error.status === 401) return { ok: false, message: st("signedOut") };
    const { t, lang } = await translator();
    return { ok: false, message: problemMessage(error, t, lang, st("saveFailed")) };
  }
}
