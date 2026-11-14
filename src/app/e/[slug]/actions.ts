"use server";

import { redirect } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { ApiError, apiMessage } from "@/lib/api/problem";
import { isUuid } from "@/lib/forms";
import type { components } from "@/lib/api/schema";
import { isCheckoutUrl, paidOrderBody, placeOrderBody } from "./order-input";

export type OrderState = { error?: string } | undefined;

const BUSY_RETRY_MS = 2_000;

// Gets tickets through gventz-api (U4). The API decides everything: the per-person limit, places,
// the waiting list and approval. The tickets go to the account's verified email (sent by the API).
// When the event or the database is very busy (503 order.busy / service.busy) we wait 2 seconds and
// try once more (NFR design Q2 A).
export async function placeOrder(_prev: OrderState, formData: FormData): Promise<OrderState> {
  const eventId = String(formData.get("event_id") ?? "");
  if (!isUuid(eventId)) return { error: "This event could not be found." };
  const body = placeOrderBody(formData);
  if ("error" in body) return { error: body.error };

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
    if (error instanceof ApiError && error.status === 401) return { error: "Your session has ended. Sign in again to get tickets." };
    return { error: apiMessage(error, "We couldn't get your tickets. Please try again.") };
  }
  redirect(`/orders/${orderId}`);
}

export type Quote = components["schemas"]["FeeQuoteDto"];

/** The live breakdown on the paid order form (prices, fees, VAT, total), from the API's quote. */
export async function quotePaid(eventId: string, lines: { ticketTypeId: string; quantity: number }[]): Promise<Quote | { error: string }> {
  const clean = lines.filter((l) => isUuid(l.ticketTypeId) && Number.isInteger(l.quantity) && l.quantity > 0 && l.quantity <= 10).slice(0, 20);
  if (!isUuid(eventId) || clean.length === 0) return { error: "Choose at least one ticket." };
  try {
    return data(await (await api()).POST("/v1/events/{id}/quote", { params: { path: { id: eventId } }, body: { lines: clean } }));
  } catch (error) {
    return { error: apiMessage(error, "We couldn't work out the total. Please try again.") };
  }
}

/**
 * A paid order (M5, CK1–CK4): the API holds the tickets for 10 minutes, fixes the quote and starts a
 * Paystack transaction; the guest is sent to Paystack's checkout and comes back to /orders/{id},
 * which shows the status from the API (never from the return link).
 */
export async function placePaidOrder(_prev: OrderState, formData: FormData): Promise<OrderState> {
  const eventId = String(formData.get("event_id") ?? "");
  if (!isUuid(eventId)) return { error: "This event could not be found." };
  const body = paidOrderBody(formData);
  if ("error" in body) return { error: body.error };

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
    if (error instanceof ApiError && error.status === 401) return { error: "Your session has ended. Sign in again to get tickets." };
    return { error: apiMessage(error, "We couldn't start your payment. Please try again.") };
  }
  if (placed.status === "awaiting_payment" && isCheckoutUrl(placed.authorizationUrl)) redirect(placed.authorizationUrl);
  redirect(`/orders/${placed.orderId}`);
}
