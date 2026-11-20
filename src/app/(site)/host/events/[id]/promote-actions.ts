"use server";

import { revalidatePath } from "next/cache";
import { api, data } from "@/lib/api/server";
import { requireEvent } from "@/lib/auth";
import { isUuid } from "@/lib/forms";
import { apiFailure, failure, ok, type ActionResult } from "./action-result";
import { createBody, updateBody, type DiscountInput } from "./promote-form";

// Discount codes (Change 4 chunk 5): create, change and pause through gventz-api, which allows
// them for the owner and co-hosts (event.fees) and checks every rule again.

const MAX_TEXT = 64;

/** The dialog's fields, cut to size; anything else in the payload is ignored. */
function readInput(raw: unknown): DiscountInput {
  const r = (raw ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof r[k] === "string" ? (r[k] as string).slice(0, MAX_TEXT) : "");
  const ids = Array.isArray(r.ticketTypeIds) ? r.ticketTypeIds.filter(isUuid).slice(0, 50) : [];
  return { code: s("code"), kind: s("kind"), value: s("value"), maxUses: s("maxUses"), startsAt: s("startsAt"), endsAt: s("endsAt"), ticketTypeIds: ids };
}

async function context(eventId: string) {
  const event = await requireEvent(eventId);
  const paid = event.ticketTypes.filter((t) => t.priceMinor > 0);
  return { event, ctx: { currency: paid[0]?.currency ?? event.ticketTypes[0]?.currency ?? "NGN", timeZone: event.timeZone, paidTypeIds: paid.map((t) => t.id) } };
}

/** Creates a code (codeId null) or changes one. */
export async function saveDiscountCode(eventId: string, codeId: string | null, raw: unknown): Promise<ActionResult> {
  if (!isUuid(eventId) || (codeId !== null && !isUuid(codeId))) return failure("notices.err.failed");
  const { ctx } = await context(eventId);
  const input = readInput(raw);
  const client = await api();
  try {
    if (codeId === null) {
      const built = createBody(input, ctx);
      if (!built.ok) return failure(`promote.errors.${built.error}`, built.field);
      await client.POST("/v1/events/{id}/discount-codes", { params: { path: { id: eventId } }, body: built.body });
    } else {
      const list = data(await client.GET("/v1/events/{id}/discount-codes", { params: { path: { id: eventId } } }));
      const current = list.items.find((c) => c.id === codeId);
      if (!current) return failure("promote.errors.notFound");
      const built = updateBody(input, current, ctx);
      if (!built.ok) return failure(`promote.errors.${built.error}`, built.field);
      await client.PATCH("/v1/events/{id}/discount-codes/{codeId}", { params: { path: { id: eventId, codeId } }, body: built.body });
    }
  } catch (error) {
    return apiFailure(error, "discount code");
  }
  revalidatePath(`/host/events/${eventId}`);
  return ok(undefined);
}

export async function setDiscountPaused(eventId: string, codeId: string, paused: boolean): Promise<ActionResult> {
  if (!isUuid(eventId) || !isUuid(codeId)) return failure("notices.err.failed");
  try {
    await (await api()).PATCH("/v1/events/{id}/discount-codes/{codeId}", { params: { path: { id: eventId, codeId } }, body: { paused: paused === true } });
  } catch (error) {
    return apiFailure(error, "discount pause");
  }
  revalidatePath(`/host/events/${eventId}`);
  return ok(undefined);
}
