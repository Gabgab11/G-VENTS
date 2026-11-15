"use server";

import { redirect } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { ApiError, apiMessage } from "@/lib/api/problem";
import { isUuid } from "@/lib/forms";
import { isCheckoutUrl } from "@/app/e/[slug]/order-input";

export type PayState = { error?: string } | undefined;

/** Opens Paystack's checkout again for an unpaid order (or a waiting-list offer) the API says can be paid. */
export async function payOrder(_prev: PayState, formData: FormData): Promise<PayState> {
  const orderId = String(formData.get("order_id") ?? "");
  if (!isUuid(orderId)) return { error: "This order could not be found." };
  let url: string | null;
  try {
    url = data(await (await api()).POST("/v1/me/orders/{orderId}/pay", { params: { path: { orderId } } })).authorizationUrl;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect(`/sign-in?next=${encodeURIComponent(`/orders/${orderId}`)}`);
    return { error: apiMessage(error, "We couldn't open the payment page. Please try again.") };
  }
  if (!isCheckoutUrl(url)) return { error: "We couldn't open the payment page. Please try again." };
  redirect(url);
}
