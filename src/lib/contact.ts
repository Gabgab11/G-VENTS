// The Help & contact form (Change 4 follow-up, step 4): topics, limits and the checks made before
// the message goes to gventz-api (POST /v1/support/messages), which checks everything again. Pure,
// so the rules are unit-tested.
import { PHONE_COUNTRIES } from "./phone";

export const SUPPORT_EMAIL = "support@gventz.com";

export const CONTACT_TOPICS = ["tickets", "refunds", "hosting", "account", "partnerships", "other"] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const CONTACT_LIMITS = { name: { min: 2, max: 100 }, email: 254, message: { min: 10, max: 4000 } } as const;

export type ContactInput = {
  name: string;
  email: string;
  country: string;
  topic: string;
  message: string;
  /** The hidden honeypot: people leave it empty. */
  website: string;
};

export type ContactField = "name" | "email" | "country" | "topic" | "message";
/** A field's problem, named after its message id (info.help.contact.errors.{error}). */
export type ContactError = "nameLength" | "emailInvalid" | "countryMissing" | "topicMissing" | "messageShort" | "messageLong";

export type ContactBody = {
  name: string;
  email: string;
  country: string;
  topic: ContactTopic;
  message: string;
  website: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isContactTopic(value: unknown): value is ContactTopic {
  return typeof value === "string" && (CONTACT_TOPICS as readonly string[]).includes(value);
}

/** Characters as people count them (an emoji is one), for the message counter and its limit. */
export function messageLength(message: string): number {
  return [...message.trim()].length;
}

/** The form's values, trimmed and checked: the body to send, or each field's problem. */
export function validateContact(input: ContactInput): { ok: true; body: ContactBody } | { ok: false; errors: Partial<Record<ContactField, ContactError>> } {
  const name = input.name.trim().replace(/\s+/g, " ");
  const email = input.email.trim().toLowerCase();
  const country = input.country.trim().toUpperCase();
  const message = input.message.trim();
  const errors: Partial<Record<ContactField, ContactError>> = {};
  const nameLength = [...name].length;
  if (nameLength < CONTACT_LIMITS.name.min || nameLength > CONTACT_LIMITS.name.max) errors.name = "nameLength";
  if (email.length > CONTACT_LIMITS.email || !EMAIL.test(email)) errors.email = "emailInvalid";
  if (!PHONE_COUNTRIES.includes(country)) errors.country = "countryMissing";
  if (!isContactTopic(input.topic)) errors.topic = "topicMissing";
  const length = messageLength(message);
  if (length < CONTACT_LIMITS.message.min) errors.message = "messageShort";
  else if (length > CONTACT_LIMITS.message.max) errors.message = "messageLong";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, body: { name, email, country, topic: input.topic as ContactTopic, message, website: input.website } };
}

/** Countries for the picker in the reader's language, sorted by name. */
export function contactCountryOptions(locale: string): { value: string; label: string }[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale, "en"], { type: "region" });
  } catch {
    names = null;
  }
  const collator = new Intl.Collator(locale);
  return PHONE_COUNTRIES.map((code) => ({ value: code, label: names?.of(code) ?? code })).sort((a, b) => collator.compare(a.label, b.label));
}
