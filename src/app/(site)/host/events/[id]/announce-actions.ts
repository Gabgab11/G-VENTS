"use server";

import { revalidatePath } from "next/cache";
import { api, data } from "@/lib/api/server";
import { isUuid } from "@/lib/forms";
import { apiFailure, failure, ok, type ActionResult } from "./action-result";
import { isSegment, isTemplate } from "./announce";

// Announcements (C2, Change 4 chunk 5): save a draft, or save and send it in one step after the
// host confirmed the recipient count. The API enforces the free plan's limits and who may send.

type Draft = { subject: string; body: string; segment: unknown; template: unknown };

function readDraft(raw: unknown) {
  const r = (raw ?? {}) as Partial<Draft>;
  const subject = typeof r.subject === "string" ? r.subject.trim().slice(0, 200) : "";
  const body = typeof r.body === "string" ? r.body.trim().slice(0, 10_000) : "";
  return { subject, body, segment: isSegment(r.segment) ? r.segment : null, template: r.template === null || r.template === "" ? null : isTemplate(r.template) ? r.template : undefined };
}

async function draft(eventId: string, raw: unknown): Promise<ActionResult<string>> {
  const d = readDraft(raw);
  if (!d.subject || !d.body) return failure("notices.err.announcementMissing", d.subject ? "body" : "subject");
  if (!d.segment) return failure("notices.err.announcementSegment", "segment");
  if (d.template === undefined) return failure("announcements.errors.template");
  try {
    const created = data(await (await api()).POST("/v1/events/{id}/announcements", {
      params: { path: { id: eventId } },
      body: { subject: d.subject, body: d.body, segment: d.segment, template: d.template },
    }));
    return ok(created.id);
  } catch (error) {
    return apiFailure(error, "announcement draft");
  }
}

export async function saveAnnouncementDraft(eventId: string, raw: unknown): Promise<ActionResult> {
  if (!isUuid(eventId)) return failure("notices.err.failed");
  const saved = await draft(eventId, raw);
  if (!saved.ok) return saved;
  revalidatePath(`/host/events/${eventId}`);
  return ok(undefined);
}

/** Sends a saved draft (announcementId) or saves the composer's text and sends it. */
export async function sendAnnouncementNow(eventId: string, announcementId: string | null, raw: unknown): Promise<ActionResult<{ queued: number }>> {
  if (!isUuid(eventId) || (announcementId !== null && !isUuid(announcementId))) return failure("notices.err.failed");
  let id = announcementId;
  if (id === null) {
    const saved = await draft(eventId, raw);
    if (!saved.ok) return saved;
    id = saved.data;
  }
  try {
    const sent = data(await (await api()).POST("/v1/events/{id}/announcements/{announcementId}/send", { params: { path: { id: eventId, announcementId: id } } }));
    revalidatePath(`/host/events/${eventId}`);
    return ok({ queued: sent.recipients });
  } catch (error) {
    // The draft stays in the history, so the host can send it later.
    revalidatePath(`/host/events/${eventId}`);
    return apiFailure(error, "announcement send");
  }
}
