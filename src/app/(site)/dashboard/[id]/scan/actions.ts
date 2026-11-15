"use server";

import { api, data } from "@/lib/api/server";
import { apiMessage } from "@/lib/api/problem";
import { isUuid } from "@/lib/forms";
import type { ScanResult } from "./scan-screen";

/**
 * One scan at the door → gventz-api (guests.checkIn). The API accepts the scanned ticket link or
 * the bare code, and lets exactly one scan of a ticket through. Errors (limits, sign-in) come back
 * as text for the screen.
 */
export async function scanTicket(eventId: string, code: string): Promise<{ scan?: ScanResult; error?: string }> {
  if (!isUuid(eventId) || typeof code !== "string" || code.length === 0 || code.length > 500) return { error: "That code can't be read." };
  try {
    return { scan: data(await (await api()).POST("/v1/events/{id}/check-in", { params: { path: { id: eventId } }, body: { code } })) as ScanResult };
  } catch (error) {
    return { error: apiMessage(error, "Couldn't reach the server. Check the connection and scan again.") };
  }
}
