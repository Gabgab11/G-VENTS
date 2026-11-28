"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/server";
import { requireEvent } from "@/lib/auth";
import { isUuid } from "@/lib/forms";
import { apiFailure, failure, ok, type ActionResult } from "./action-result";
import { createLinkBody, normalizeAccessCode, updateLinkBody, type LinkInput } from "./registration-links";

// Registration links (Change 6, FR-41/FR-46): create, change, archive and rotate the share token
// through gventz-api, which allows them for the owner and co-hosts (links.manage) and checks every
// rule again. Plus the event-level access code. These return to the client dialog (ActionResult)
// instead of redirecting, so it can stay open and show a field error.

const MAX_TEXT = 64;

/** The dialog's fields, cut to size; anything else in the payload is ignored. */
function readInput(raw: unknown): LinkInput {
  const r = (raw ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof r[k] === "string" ? (r[k] as string).slice(0, MAX_TEXT) : "");
  return { name: s("name"), cap: s("cap"), accessCode: s("accessCode"), tierId: s("tierId") };
}

/** Creates a link (linkId null) or changes one. */
export async function saveRegistrationLink(eventId: string, linkId: string | null, raw: unknown): Promise<ActionResult> {
  if (!isUuid(eventId) || (linkId !== null && !isUuid(linkId))) return failure("notices.err.failed");
  await requireEvent(eventId); // 404s if the caller has no role on the event.
  const input = readInput(raw);
  const client = await api();
  try {
    if (linkId === null) {
      const built = createLinkBody(input);
      if (!built.ok) return failure(`links.errors.${built.error}`, built.field);
      await client.POST("/v1/events/{id}/registration-links", { params: { path: { id: eventId } }, body: built.body });
    } else {
      const built = updateLinkBody(input);
      if (!built.ok) return failure(`links.errors.${built.error}`, built.field);
      await client.PATCH("/v1/events/{id}/registration-links/{linkId}", { params: { path: { id: eventId, linkId } }, body: built.body });
    }
  } catch (error) {
    return apiFailure(error, "registration link");
  }
  revalidatePath(`/host/events/${eventId}`);
  return ok(undefined);
}

/** Issues a fresh share token for a link (the old `/e/<slug>?r=<token>` stops working). */
export async function rotateLinkToken(eventId: string, linkId: string): Promise<ActionResult> {
  if (!isUuid(eventId) || !isUuid(linkId)) return failure("notices.err.failed");
  try {
    await (await api()).PATCH("/v1/events/{id}/registration-links/{linkId}", { params: { path: { id: eventId, linkId } }, body: { rotateToken: true } });
  } catch (error) {
    return apiFailure(error, "rotate link token");
  }
  revalidatePath(`/host/events/${eventId}`);
  return ok(undefined);
}

/** Archives a segment link (the default link cannot be archived — the API refuses it). */
export async function archiveRegistrationLink(eventId: string, linkId: string): Promise<ActionResult> {
  if (!isUuid(eventId) || !isUuid(linkId)) return failure("notices.err.failed");
  try {
    await (await api()).DELETE("/v1/events/{id}/registration-links/{linkId}", { params: { path: { id: eventId, linkId } } });
  } catch (error) {
    return apiFailure(error, "archive registration link");
  }
  revalidatePath(`/host/events/${eventId}`);
  return ok(undefined);
}

/** Sets or clears the event-level access code (blank removes it). */
export async function setEventAccessCode(eventId: string, raw: unknown): Promise<ActionResult> {
  if (!isUuid(eventId)) return failure("notices.err.failed");
  await requireEvent(eventId);
  const value = typeof raw === "string" ? raw.slice(0, MAX_TEXT) : "";
  const code = normalizeAccessCode(value);
  if (code === undefined) return failure("accessCode.errors.accessCode", "accessCode");
  try {
    await (await api()).PUT("/v1/events/{id}/access-code", { params: { path: { id: eventId } }, body: { accessCode: code } });
  } catch (error) {
    return apiFailure(error, "event access code");
  }
  revalidatePath(`/host/events/${eventId}`);
  return ok(undefined);
}
