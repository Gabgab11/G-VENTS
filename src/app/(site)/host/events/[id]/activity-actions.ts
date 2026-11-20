"use server";

import { api, data } from "@/lib/api/server";
import { isUuid } from "@/lib/forms";
import { apiFailure, failure, ok, type ActionResult } from "./action-result";
import type { ActivityItem } from "./activity-labels";

const PAGE = 30;

/** The next page of the event's activity after `cursor` (the API's opaque cursor). */
export async function loadActivity(eventId: string, cursor: string): Promise<ActionResult<{ items: ActivityItem[]; nextCursor: string | null }>> {
  if (!isUuid(eventId) || typeof cursor !== "string" || cursor.length === 0 || cursor.length > 512) return failure("notices.err.failed");
  try {
    const page = data(await (await api()).GET("/v1/events/{id}/activity", { params: { path: { id: eventId }, query: { cursor, limit: PAGE } } }));
    return ok(page);
  } catch (error) {
    return apiFailure(error, "activity");
  }
}
