"use server";

import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { api, data } from "@/lib/api/server";
import { ApiError, problemMessage } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { requireUser } from "@/lib/auth";
import { isPayoutCountry } from "@/lib/payment-text";
import { accountNumber, applicationBody, documentFrom, payoutChangeBody } from "./application-input";

// Applying to sell paid tickets and changing payout details (M5, FR-20, business rules HA1–HA4).
// The browser never calls the API: the bank list and the account check go through these actions,
// and the document is uploaded from here to private storage through a signed URL from the API.

export type FormState = { error?: string } | undefined;
type Bank = components["schemas"]["BankDto"];
type Resolved = components["schemas"]["ResolvedAccountDto"];

const PAGE = "/host/payouts";

function sessionEnded(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/** The message for a failed API call, in the reader's language (fallback from this area). */
async function failure(error: unknown, fallback: string): Promise<string> {
  const [t, lang] = await Promise.all([getTranslations("errors"), getLocale()]);
  return problemMessage(error, t, lang, fallback);
}

export async function loadBanks(country: string): Promise<{ banks: Bank[] } | { error: string }> {
  const t = await getTranslations("account.payouts.errors");
  if (!isPayoutCountry(country)) return { error: t("chooseCountry") };
  try {
    const res = data(await (await api()).GET("/v1/payments/banks", { params: { query: { country } } }));
    return { banks: res.banks };
  } catch (error) {
    if (sessionEnded(error)) return { error: t("sessionEnded") };
    return { error: await failure(error, t("loadBanksFailed")) };
  }
}

/** Paystack's account-name check for the bank and number (HA1); KE/ZA can't check names. */
export async function checkAccount(country: string, bankCode: string, rawNumber: string): Promise<Resolved | { error: string }> {
  const t = await getTranslations("account.payouts.errors");
  if (!isPayoutCountry(country)) return { error: t("chooseCountry") };
  const number = accountNumber(rawNumber);
  if (!bankCode || !number) return { error: t("bankAndNumber") };
  try {
    return data(await (await api()).POST("/v1/payments/resolve-account", { body: { country, bankCode: bankCode.slice(0, 30), accountNumber: number } }));
  } catch (error) {
    if (sessionEnded(error)) return { error: t("sessionEnded") };
    return { error: await failure(error, t("checkFailed")) };
  }
}

export async function applyToSell(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser(PAGE);
  const t = await getTranslations("account");
  const body = applicationBody(formData);
  if ("error" in body) return { error: t(body.error) };
  // With JavaScript the form uploads the document first, to /api/me/host-application/document (a
  // route handler: Cloudflare's WAF blocks some files sent to Server Actions, src/lib/same-origin.ts),
  // and sends its path here. Without JavaScript the file still comes here. The API checks the path.
  const uploadedPath = typeof formData.get("document_path") === "string" ? String(formData.get("document_path")).trim() : "";
  const doc = uploadedPath ? null : documentFrom(formData);
  if (doc && "error" in doc) return { error: t(doc.error) };

  try {
    const client = await api();
    let documentPath = uploadedPath;
    if (doc) {
      const upload = data(await client.POST("/v1/me/host-application/document-upload-url", { body: { contentType: doc.contentType, sizeBytes: doc.file.size } }));
      const put = await fetch(upload.uploadUrl, { method: "PUT", body: Buffer.from(await doc.file.arrayBuffer()), headers: { "content-type": doc.contentType } }).catch(() => null);
      if (!put?.ok) {
        console.error(`[payouts] document upload to storage failed: ${put?.status ?? "network"}`);
        return { error: t("payouts.errors.uploadFailed") };
      }
      documentPath = upload.path;
    }
    await client.POST("/v1/me/host-application", { body: { ...body, documentPath } });
  } catch (error) {
    if (sessionEnded(error)) return { error: t("payouts.errors.sessionEndedApply") };
    return { error: await failure(error, t("payouts.errors.sendFailed")) };
  }
  redirect(`${PAGE}?ok=submitted`);
}

/** HA4: needs two-step sign-in; pauses paid sales until staff confirm the new account. */
export async function changePayout(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser(PAGE);
  const t = await getTranslations("account");
  const body = payoutChangeBody(formData);
  if ("error" in body) return { error: t(body.error) };
  try {
    await (await api()).PUT("/v1/me/payout-account", { body });
  } catch (error) {
    if (error instanceof ApiError && error.code === "auth.mfa_required") redirect(`/host/settings/security?next=${encodeURIComponent(PAGE)}`);
    if (sessionEnded(error)) return { error: t("payouts.errors.sessionEnded") };
    return { error: await failure(error, t("payouts.errors.changeFailed")) };
  }
  redirect(`${PAGE}?ok=payout_changed`);
}
