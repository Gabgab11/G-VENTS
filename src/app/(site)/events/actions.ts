"use server";

import { redirect } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { getLocale, getTranslations } from "next-intl/server";
import { problemMessage } from "@/lib/api/problem";
import { requireUser } from "@/lib/auth";
import { flyerFrom, uploadFlyer } from "@/lib/flyer";
import { getAvailability } from "@/lib/payments";
import { sellReasonKey } from "@/lib/payment-text";
import type { components } from "@/lib/api/schema";
import { createEventBody, hasPaidPrice, type PaidSetup } from "./create-event-input";

/** `created`: the event exists and the browser still has to send its image (`image_pending`). */
export type CreateEventState = { error?: string; created?: { id: string; next: string } } | undefined;

/** Message ids (createEvent.save.*) for the image problems. */
const FLYER_PROBLEMS = {
  flyer_missing: "flyerMissing",
  flyer_type: "flyerType",
  flyer_size: "flyerSize",
  flyer_unreadable: "flyerUnreadable",
} as const;

// Creates the event through gventz-api (U6a). The API derives the time zone from the venue where
// it can, checks every event rule, and answers with a message the form can show.
// An event image, if chosen, is checked first and uploaded once the event exists (U5). If only the
// image fails, the event is kept and the host lands on its settings to try the image again.
// With JavaScript the form keeps the image out of this Server Action (Cloudflare's WAF blocks some
// images sent to Server Actions, src/lib/same-origin.ts): it sends `image_pending`, gets
// `created` back, and posts the image to /api/events/{id}/flyer itself. Without JavaScript the
// image still comes here.
export async function createEvent(_prev: CreateEventState, formData: FormData): Promise<CreateEventState> {
  await requireUser("/events/new");
  const t = await getTranslations();
  // Paid ticket types (M5): only when the API says this host can sell now, in their payout currency.
  let paid: PaidSetup = null;
  if (hasPaidPrice(formData)) {
    const me = (await getAvailability())?.me;
    if (!me?.canSellPaid || !me.currency) return { error: t(sellReasonKey(me?.reason).key) };
    paid = { currency: me.currency };
  }
  const body = createEventBody(formData, paid, (key, values) => t(key, values));
  if ("error" in body) return { error: body.error };
  const flyer = flyerFrom(formData);
  if (flyer && "problem" in flyer) return { error: t(`createEvent.save.${FLYER_PROBLEMS[flyer.problem]}`) };

  let created: { id: string; slug: string };
  try {
    created = data(await (await api()).POST("/v1/events", { body }));
  } catch (error) {
    return { error: problemMessage(error, await getTranslations("errors"), await getLocale(), t("createEvent.save.failed")) };
  }

  const next = body.publish ? `/e/${created.slug}` : "/dashboard";
  if (!flyer && formData.get("image_pending") === "1") return { created: { id: created.id, next } };
  if (flyer) {
    try {
      await uploadFlyer(created.id, flyer.file, flyer.contentType);
      console.info(`[create event] image attached to ${created.id} (${flyer.contentType}, ${flyer.file.size} bytes)`);
    } catch (error) {
      console.error(`[create event] image upload failed: ${(error as Error).message}`);
      redirect(`/dashboard/${created.id}?tab=settings&err=flyer_after_create`);
    }
  }
  redirect(next);
}

export type FeePreview = components["schemas"]["HostFeePreviewDto"];

/** The live example next to a paid price (M5 TicketTypeEditor): what the guest pays and the host receives. */
export async function previewFee(priceMinor: number, feeChoice: "host_absorbs" | "guest_pays"): Promise<FeePreview | { error: string }> {
  const t = await getTranslations("createEvent.fee");
  if (!Number.isSafeInteger(priceMinor) || priceMinor <= 0) return { error: t("enterPrice") };
  try {
    return data(await (await api()).POST("/v1/payments/fee-preview", { body: { priceMinor, feeChoice: feeChoice === "guest_pays" ? "guest_pays" : "host_absorbs" } }));
  } catch (error) {
    return { error: problemMessage(error, await getTranslations("errors"), await getLocale(), t("unavailable")) };
  }
}
