"use server";

import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { api, data } from "@/lib/api/server";
import { ApiError } from "@/lib/api/problem";
import { isEnabled } from "@/i18n/languages";
import { validateContact, type ContactField, type ContactInput } from "@/lib/contact";

// The Help & contact form (Change 4 follow-up, step 4) → gventz-api POST /v1/support/messages, with
// the BFF headers (src/lib/api/server.ts). The API checks Turnstile, rate-limits by IP and email,
// drops honeypot messages quietly and emails support@gventz.com. Errors come back in the reader's
// language: a known API code's text from errors.json, or a generic message.

export type ContactResult =
  | { ok: true }
  | { ok: false; error: string; fields?: Partial<Record<ContactField, string>>; captcha?: boolean };

export type ContactPrefill = { name: string; email: string; country: string | null };

const SESSION_COOKIE = /^sb-[^=]+-auth-token(?:\.\d+)?$/;
const FIELDS: readonly string[] = ["name", "email", "country", "topic", "message"];

export async function sendSupportMessage(input: ContactInput & { captchaToken?: string | null; language?: string }): Promise<ContactResult> {
  const locale = isEnabled(input.language) ? input.language : "en";
  const t = await getTranslations({ locale, namespace: "info.help.contact" });
  const raw: ContactInput = {
    name: String(input.name ?? ""),
    email: String(input.email ?? ""),
    country: String(input.country ?? ""),
    topic: String(input.topic ?? ""),
    message: String(input.message ?? ""),
    website: String(input.website ?? "").slice(0, 200),
  };
  const checked = validateContact(raw);
  if (!checked.ok) {
    const fields = Object.fromEntries(Object.entries(checked.errors).map(([f, e]) => [f, t(`errors.${e}`)]));
    return { ok: false, error: t("errors.fix"), fields };
  }
  const captchaToken = typeof input.captchaToken === "string" && input.captchaToken ? input.captchaToken.slice(0, 4096) : undefined;
  try {
    // A plain POST: the endpoint is new, so the generated client may not know its path yet.
    data(
      await (await api()).POST("/v1/support/messages" as never, {
        body: { ...checked.body, ...(captchaToken ? { captchaToken } : {}), language: locale } as never,
      } as never),
    );
    return { ok: true };
  } catch (error) {
    return failure(error, locale, t("errors.failed"));
  }
}

async function failure(error: unknown, locale: string, generic: string): Promise<ContactResult> {
  if (!(error instanceof ApiError)) {
    console.error("[help] support message:", error instanceof Error ? error.message : error);
    return { ok: false, error: generic };
  }
  const errors = await getTranslations({ locale, namespace: "errors" });
  const known = (code: string | undefined) => (code && /^[a-z_]+\.[a-z_]+$/.test(code) && errors.has(code) ? errors(code) : null);
  if (error.status === 429) return { ok: false, error: known(error.code) ?? errors("rate_limit.exceeded") };
  const captcha = error.code === "support.captcha_failed" || error.code === "auth.captcha_failed";
  const fields: Partial<Record<ContactField, string>> = {};
  for (const issue of error.problem.errors ?? []) {
    const text = known(issue.code);
    if (text && FIELDS.includes(issue.field)) fields[issue.field as ContactField] = text;
  }
  if (error.status >= 500) console.error(`[help] support message: ${error.message}`);
  return { ok: false, error: known(error.code) ?? generic, ...(Object.keys(fields).length ? { fields } : {}), ...(captcha ? { captcha } : {}) };
}

/** The signed-in visitor's name, email and country, to fill the form in; null when signed out. */
export async function contactPrefill(): Promise<ContactPrefill | null> {
  const jar = await cookies();
  if (!jar.getAll().some((c) => SESSION_COOKIE.test(c.name) && c.value !== "")) return null;
  try {
    const me = data(await (await api()).GET("/v1/me"));
    return { name: me.fullName ?? "", email: me.email, country: me.country };
  } catch {
    return null;
  }
}
