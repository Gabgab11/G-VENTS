"use server";

import { redirect } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { ApiError, apiMessage } from "@/lib/api/problem";
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

const PAGE = "/account/payouts";

function sessionEnded(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export async function loadBanks(country: string): Promise<{ banks: Bank[] } | { error: string }> {
  if (!isPayoutCountry(country)) return { error: "Choose a country first." };
  try {
    const res = data(await (await api()).GET("/v1/payments/banks", { params: { query: { country } } }));
    return { banks: res.banks };
  } catch (error) {
    if (sessionEnded(error)) return { error: "Your session has ended. Sign in again." };
    return { error: apiMessage(error, "We couldn't load the banks. Please try again.") };
  }
}

/** Paystack's account-name check for the bank and number (HA1); KE/ZA can't check names. */
export async function checkAccount(country: string, bankCode: string, rawNumber: string): Promise<Resolved | { error: string }> {
  if (!isPayoutCountry(country)) return { error: "Choose a country first." };
  const number = accountNumber(rawNumber);
  if (!bankCode || !number) return { error: "Choose your bank and enter the account number (digits only)." };
  try {
    return data(await (await api()).POST("/v1/payments/resolve-account", { body: { country, bankCode: bankCode.slice(0, 30), accountNumber: number } }));
  } catch (error) {
    if (sessionEnded(error)) return { error: "Your session has ended. Sign in again." };
    return { error: apiMessage(error, "We couldn't check this account. Please try again.") };
  }
}

export async function applyToSell(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser(PAGE);
  const body = applicationBody(formData);
  if ("error" in body) return body;
  const doc = documentFrom(formData);
  if ("error" in doc) return doc;

  try {
    const client = await api();
    const upload = data(await client.POST("/v1/me/host-application/document-upload-url", { body: { contentType: doc.contentType, sizeBytes: doc.file.size } }));
    const put = await fetch(upload.uploadUrl, { method: "PUT", body: Buffer.from(await doc.file.arrayBuffer()), headers: { "content-type": doc.contentType } }).catch(() => null);
    if (!put?.ok) {
      console.error(`[payouts] document upload to storage failed: ${put?.status ?? "network"}`);
      return { error: "The document didn't upload. Please try again." };
    }
    await client.POST("/v1/me/host-application", { body: { ...body, documentPath: upload.path } });
  } catch (error) {
    if (sessionEnded(error)) return { error: "Your session has ended. Sign in again to apply." };
    return { error: apiMessage(error, "We couldn't send your application. Please try again.") };
  }
  redirect(`${PAGE}?ok=submitted`);
}

/** HA4: needs two-step sign-in; pauses paid sales until staff confirm the new account. */
export async function changePayout(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser(PAGE);
  const body = payoutChangeBody(formData);
  if ("error" in body) return body;
  try {
    await (await api()).PUT("/v1/me/payout-account", { body });
  } catch (error) {
    if (error instanceof ApiError && error.code === "auth.mfa_required") redirect(`/account/security?next=${encodeURIComponent(PAGE)}`);
    if (sessionEnded(error)) return { error: "Your session has ended. Sign in again." };
    return { error: apiMessage(error, "We couldn't change your payout details. Please try again.") };
  }
  redirect(`${PAGE}?ok=payout_changed`);
}
