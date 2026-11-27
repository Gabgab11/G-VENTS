"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { getLocale, getTranslations } from "next-intl/server";
import { ApiError, problemMessage } from "@/lib/api/problem";
import { NON_REFUNDABLE_KEY } from "@/lib/payment-text";
import { isUuid } from "@/lib/forms";
import type { components } from "@/lib/api/schema";
import { isCheckoutUrl, paidOrderBody, placeOrderBody, type OrderInputError } from "./order-input";
import { cleanCode, isDiscountProblem } from "./tickets/discount-code";
import { unlockCookieName } from "./tickets/registration-token";

/**
 * Change 6 (free path): stamp the order with the registration link it was placed on, and attach the
 * unlock proof for a code-gated link. The link token is in a hidden form field; the short-lived unlock
 * token lives in an httpOnly cookie set by the unlock action. The API re-verifies the unlock inside the
 * order transaction (fail closed), so a missing or stale cookie just fails there. (Paid orders stay on
 * the default link for now — PaidOrderDto carries neither field; that gating is a documented follow-up.)
 */
async function applyRegistrationLink(eventId: string, formData: FormData, body: { registrationLinkToken?: string; unlock?: string }): Promise<void> {
  const token = formData.get("registration_link_token");
  if (typeof token !== "string" || !token) return;
  body.registrationLinkToken = token;
  const unlock = (await cookies()).get(unlockCookieName(eventId, token))?.value;
  if (unlock) body.unlock = unlock;
}

export type OrderState = { error?: string } | undefined;

const BUSY_RETRY_MS = 2_000;

/** The event area's messages, the API error messages and the reader's language. */
async function texts() {
  const [t, errors, root, lang] = await Promise.all([getTranslations("event.errors"), getTranslations("errors"), getTranslations(), getLocale()]);
  const inputError = (error: OrderInputError) => (error === "nonRefundable" ? t("nonRefundable", { text: root(NON_REFUNDABLE_KEY) }) : t(error));
  return { t, inputError, problem: (error: unknown, fallback: string) => problemMessage(error, errors, lang, fallback) };
}

// Gets tickets through gventz-api (U4). The API decides everything: the per-person limit, places,
// the waiting list and approval. The tickets go to the account's verified email (sent by the API).
// When the event or the database is very busy (503 order.busy / service.busy) we wait 2 seconds and
// try once more (NFR design Q2 A).
export async function placeOrder(_prev: OrderState, formData: FormData): Promise<OrderState> {
  const { t, inputError, problem } = await texts();
  const eventId = String(formData.get("event_id") ?? "");
  if (!isUuid(eventId)) return { error: t("eventNotFound") };
  const body = placeOrderBody(formData);
  if ("error" in body) return { error: inputError(body.error) };
  await applyRegistrationLink(eventId, formData, body);

  const send = async () => data(await (await api()).POST("/v1/events/{id}/orders", { params: { path: { id: eventId } }, body }));
  let orderId: string;
  try {
    try {
      orderId = (await send()).orderId;
    } catch (error) {
      if (!(error instanceof ApiError && (error.code === "order.busy" || error.code === "service.busy"))) throw error;
      await new Promise((resolve) => setTimeout(resolve, BUSY_RETRY_MS));
      orderId = (await send()).orderId;
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { error: t("sessionEnded") };
    return { error: problem(error, t("orderFailed")) };
  }
  redirect(`/orders/${orderId}`);
}

export type Quote = components["schemas"]["FeeQuoteDto"];

/** Why a quote failed; `discount` when it was the code's fault (shown under the code box). */
export type QuoteFailure = { error: string; discount?: boolean };

/**
 * The live breakdown on the paid order form (prices, any discount code, fees, VAT, total), from the
 * API's quote. Public: signed-out buyers see it too. The code is checked by the API (D91).
 */
export async function quotePaid(eventId: string, lines: { ticketTypeId: string; quantity: number }[], code?: string | null): Promise<Quote | QuoteFailure> {
  const { t, problem } = await texts();
  const clean = lines.filter((l) => isUuid(l.ticketTypeId) && Number.isInteger(l.quantity) && l.quantity > 0 && l.quantity <= 10).slice(0, 20);
  if (!isUuid(eventId) || clean.length === 0) return { error: t("chooseTicket") };
  const discount = code == null || code === "" ? null : cleanCode(code);
  if (discount === null && code) return { error: t("codeFormat"), discount: true };
  try {
    return data(await (await api()).POST("/v1/events/{id}/quote", { params: { path: { id: eventId } }, body: { lines: clean, ...(discount ? { code: discount } : {}) } }));
  } catch (error) {
    return { error: problem(error, t("quoteFailed")), ...(discount && error instanceof ApiError && isDiscountProblem(error.code) ? { discount: true } : {}) };
  }
}

/**
 * A paid order (M5, CK1–CK4): the API holds the tickets for 10 minutes, fixes the quote and starts a
 * Paystack transaction; the guest is sent to Paystack's checkout and comes back to /orders/{id},
 * which shows the status from the API (never from the return link).
 */
export async function placePaidOrder(_prev: OrderState, formData: FormData): Promise<OrderState> {
  const { t, inputError, problem } = await texts();
  const eventId = String(formData.get("event_id") ?? "");
  if (!isUuid(eventId)) return { error: t("eventNotFound") };
  const body = paidOrderBody(formData);
  if ("error" in body) return { error: inputError(body.error) };

  const send = async () => data(await (await api()).POST("/v1/events/{id}/paid-orders", { params: { path: { id: eventId } }, body }));
  let placed: components["schemas"]["PaidOrderPlacedDto"];
  try {
    try {
      placed = await send();
    } catch (error) {
      if (!(error instanceof ApiError && (error.code === "order.busy" || error.code === "service.busy"))) throw error;
      await new Promise((resolve) => setTimeout(resolve, BUSY_RETRY_MS));
      placed = await send();
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { error: t("sessionEnded") };
    return { error: problem(error, t("paymentFailed")) };
  }
  if (placed.status === "awaiting_payment" && isCheckoutUrl(placed.authorizationUrl)) redirect(placed.authorizationUrl);
  redirect(`/orders/${placed.orderId}`);
}
