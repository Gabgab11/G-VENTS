"use server";

import { redirect } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { isUuid } from "@/lib/forms";
import { isTicketCode } from "@/lib/ticket";

// Door check-in from a scanned ticket page (staff see a "Check in" button). gventz-api decides
// who may check guests in and lets exactly one scan of a ticket through.
export async function checkInFromTicket(formData: FormData) {
  const code = String(formData.get("code") ?? "").toLowerCase();
  const eventId = String(formData.get("event_id") ?? "");
  if (!isTicketCode(code) || !isUuid(eventId)) redirect("/");

  let reason = "failed";
  try {
    const result = data(await (await api()).POST("/v1/events/{id}/check-in", { params: { path: { id: eventId } }, body: { code } }));
    reason = result.reason;
  } catch (error) {
    console.error("[ticket] check in:", error);
  }
  redirect(`/t/${code}?checkin=${encodeURIComponent(reason)}`);
}
