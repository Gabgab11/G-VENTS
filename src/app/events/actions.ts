"use server";

import { redirect } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { apiMessage } from "@/lib/api/problem";
import { requireUser } from "@/lib/auth";
import { flyerFrom, uploadFlyer } from "@/lib/flyer";
import { getAvailability } from "@/lib/payments";
import { sellReasonText } from "@/lib/payment-text";
import type { components } from "@/lib/api/schema";
import { createEventBody, hasPaidPrice, type PaidSetup } from "./create-event-input";

export type CreateEventState = { error?: string } | undefined;

const FLYER_PROBLEMS = {
  flyer_missing: "Choose an image first.",
  flyer_type: "Use a JPG, PNG, or WebP image for the event image.",
  flyer_size: "The event image is larger than 5 MB. Please resize it and try again.",
  flyer_unreadable: "We couldn't read that image. Please choose it again.",
} as const;

// Creates the event through gventz-api (U6a). The API derives the time zone from the venue where
// it can, checks every event rule, and answers with a message the form can show.
// An event image, if chosen, is checked first and uploaded once the event exists (U5). If only the
// image fails, the event is kept and the host lands on its settings to try the image again.
export async function createEvent(_prev: CreateEventState, formData: FormData): Promise<CreateEventState> {
  await requireUser("/events/new");
  // Paid ticket types (M5): only when the API says this host can sell now, in their payout currency.
  let paid: PaidSetup = null;
  if (hasPaidPrice(formData)) {
    const me = (await getAvailability())?.me;
    if (!me?.canSellPaid || !me.currency) return { error: sellReasonText(me?.reason).text };
    paid = { currency: me.currency };
  }
  const body = createEventBody(formData, paid);
  if ("error" in body) return { error: body.error };
  const flyer = flyerFrom(formData);
  if (flyer && "problem" in flyer) return { error: FLYER_PROBLEMS[flyer.problem] };

  let created: { id: string; slug: string };
  try {
    created = data(await (await api()).POST("/v1/events", { body }));
  } catch (error) {
    return { error: apiMessage(error, "We couldn't save the event. Please try again.") };
  }

  if (flyer) {
    try {
      await uploadFlyer(created.id, flyer.file, flyer.contentType);
      console.info(`[create event] image attached to ${created.id} (${flyer.contentType}, ${flyer.file.size} bytes)`);
    } catch (error) {
      console.error(`[create event] image upload failed: ${(error as Error).message}`);
      redirect(`/dashboard/${created.id}?tab=settings&err=flyer_after_create`);
    }
  }
  redirect(body.publish ? `/e/${created.slug}` : "/dashboard");
}

export type FeePreview = components["schemas"]["HostFeePreviewDto"];

/** The live example next to a paid price (M5 TicketTypeEditor): what the guest pays and the host receives. */
export async function previewFee(priceMinor: number, feeChoice: "host_absorbs" | "guest_pays"): Promise<FeePreview | { error: string }> {
  if (!Number.isSafeInteger(priceMinor) || priceMinor <= 0) return { error: "Enter a price." };
  try {
    return data(await (await api()).POST("/v1/payments/fee-preview", { body: { priceMinor, feeChoice: feeChoice === "guest_pays" ? "guest_pays" : "host_absorbs" } }));
  } catch (error) {
    return { error: apiMessage(error, "The fee example isn't available right now.") };
  }
}
