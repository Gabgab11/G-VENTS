"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api, data } from "@/lib/api/server";
import { getLocale, getTranslations } from "next-intl/server";
import { ApiError, problemMessage } from "@/lib/api/problem";
import { isUuid } from "@/lib/forms";
import { isCheckoutUrl } from "@/app/[lang]/e/[slug]/order-input";

export type PayState = { error?: string } | undefined;

/** Opens Paystack's checkout again for an unpaid order (or a waiting-list offer) the API says can be paid. */
export async function payOrder(_prev: PayState, formData: FormData): Promise<PayState> {
  const [t, errors, lang] = await Promise.all([getTranslations("tickets.payment"), getTranslations("errors"), getLocale()]);
  const orderId = String(formData.get("order_id") ?? "");
  if (!isUuid(orderId)) return { error: t("orderNotFound") };
  let url: string | null;
  try {
    url = data(await (await api()).POST("/v1/me/orders/{orderId}/pay", { params: { path: { orderId } } })).authorizationUrl;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect(`/sign-in?next=${encodeURIComponent(`/orders/${orderId}`)}`);
    return { error: problemMessage(error, errors, lang, t("openFailed")) };
  }
  if (!isCheckoutUrl(url)) return { error: t("openFailed") };
  redirect(url);
}

export type ResendResult = { masked: string } | { error: string };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Sends a ticket the buyer gave to someone else to its recipient again (D89), optionally to a
 * corrected address. The API checks the order is theirs, refuses ticket 1 and the buyer's own email,
 * and limits how often one ticket is emailed.
 */
export async function resendTicket(orderId: string, ticketId: string, email: string): Promise<ResendResult> {
  const [t, errors, lang] = await Promise.all([getTranslations("shared.orderCard.resend"), getTranslations("errors"), getLocale()]);
  if (!isUuid(orderId) || !isUuid(ticketId)) return { error: t("failed") };
  const address = email.trim().toLowerCase();
  if (address && (address.length > 254 || !EMAIL.test(address))) return { error: t("invalidEmail") };
  try {
    const sent = data(await (await api()).POST("/v1/me/orders/{orderId}/tickets/{ticketId}/resend", {
      params: { path: { orderId, ticketId } },
      body: address ? { email: address } : {},
    }));
    revalidatePath("/my-tickets");
    revalidatePath(`/orders/${orderId}`);
    return { masked: sent.masked };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { error: t("signedOut") };
    if (!(error instanceof ApiError) || error.status >= 500) console.error("[orders] resend:", error);
    return { error: problemMessage(error, errors, lang, t("failed")) };
  }
}
