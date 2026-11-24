// Your account (Change 5 chunk 3, FR-35, D93): the profile form's rules, pure so they're unit-tested.
// The API checks everything again; these catch the common mistakes without a round trip.
import { isPhoneCountry, toE164 } from "@/lib/phone";

export const NAME_MIN = 2;
export const NAME_MAX = 100;
export const GENDERS = ["female", "male", "unspecified"] as const;
export type Gender = (typeof GENDERS)[number];

export type ProfileField = "fullName" | "phone" | "gender";
/** Why a field was refused: a key under account.page.profile.errors. */
export type FieldProblem = "nameShort" | "nameLong" | "phoneInvalid" | "genderInvalid";

export type ProfileInput = { fullName: string; phone: string | null; gender: Gender | null };

export const EMAIL_PREFERENCES = ["announcements", "followedHosts", "product"] as const;
export type EmailPreference = (typeof EMAIL_PREFERENCES)[number];
export type EmailPreferences = Record<EmailPreference, boolean>;

export function isEmailPreference(value: unknown): value is EmailPreference {
  return typeof value === "string" && (EMAIL_PREFERENCES as readonly string[]).includes(value);
}

/** Every preference on unless the account turned it off (the API's default is on). */
export function emailPreferencesFrom(raw: Partial<EmailPreferences> | null | undefined): EmailPreferences {
  return { announcements: raw?.announcements !== false, followedHosts: raw?.followedHosts !== false, product: raw?.product !== false };
}

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").slice(0, max);

/**
 * The profile form → the PATCH /v1/me body, or the problem with each field. An empty phone clears
 * it; a number is read with the chosen country and sent in E.164. Gender "" clears it.
 */
export function readProfileForm(form: FormData): { ok: true; value: ProfileInput } | { ok: false; fields: Partial<Record<ProfileField, FieldProblem>> } {
  const fields: Partial<Record<ProfileField, FieldProblem>> = {};
  const fullName = text(form, "fullName", 400).trim().replace(/\s+/g, " ");
  if (fullName.length < NAME_MIN) fields.fullName = "nameShort";
  else if (fullName.length > NAME_MAX) fields.fullName = "nameLong";

  const typed = text(form, "phone", 60).trim();
  const country = text(form, "phoneCountry", 2).toUpperCase();
  let phone: string | null = null;
  if (typed) {
    phone = toE164(isPhoneCountry(country) ? country : null, typed);
    if (!phone) fields.phone = "phoneInvalid";
  }

  const rawGender = text(form, "gender", 20);
  const gender = rawGender === "" ? null : (GENDERS as readonly string[]).includes(rawGender) ? (rawGender as Gender) : undefined;
  if (gender === undefined) fields.gender = "genderInvalid";

  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return { ok: true, value: { fullName, phone, gender: gender ?? null } };
}
