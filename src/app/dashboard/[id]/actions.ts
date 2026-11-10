"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { ApiError } from "@/lib/api/problem";
import { apiMessageFor } from "@/lib/api/messages";
import { requireEvent } from "@/lib/auth";
import { checkbox, field, isUuid } from "@/lib/forms";
import { isThemeKey } from "@/lib/themes";
import { locationInput } from "@/app/events/create-event-input";
import type { MessageCode } from "./messages";

// Dashboard actions through gventz-api (U6b). The API checks the caller's role and every rule;
// these actions read the form, call it, and come back to the tab with a message code. API errors
// travel as `api.<code>` so the page shows the API's wording without putting text in the URL.

const KINDS = ["text", "options", "social", "company", "terms", "phone", "website"] as const;
const SEGMENTS = ["all", "paid", "checked_in", "not_checked_in", "waitlist"] as const;
const FLYER_MAX = 5 * 1024 * 1024;

type Tab = "overview" | "guests" | "registration" | "announcements" | "settings";

function back(id: string, tab: Tab, query: string): never {
  revalidatePath(`/dashboard/${id}`);
  revalidatePath("/dashboard");
  redirect(`/dashboard/${id}?tab=${tab}&${query}`);
}

function done(id: string, tab: Tab, code: MessageCode): never {
  back(id, tab, `ok=${code}`);
}

function fail(id: string, tab: Tab, code: MessageCode = "failed"): never {
  back(id, tab, `err=${code}`);
}

/** Runs one API call; any API error returns to the tab with its code (known codes only). */
async function call<T>(id: string, tab: Tab, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ApiError) {
      if (apiMessageFor(error.code)) back(id, tab, `err=api.${encodeURIComponent(error.code)}`);
      if (error.status >= 500) console.error(`[dashboard] ${error.message}`);
    } else {
      console.error("[dashboard]", error);
    }
    fail(id, tab);
  }
}

/** The event id from the form, after the API confirmed the caller has a role on it. */
async function eventIdFrom(formData: FormData): Promise<string> {
  const id = field(formData, "event_id");
  await requireEvent(id);
  return id;
}

const settings = (id: string, body: Record<string, unknown>) => async () => (await api()).PATCH("/v1/events/{id}/settings", { params: { path: { id } }, body });

export async function setRegistrationOpen(formData: FormData) {
  const id = await eventIdFrom(formData);
  const open = field(formData, "open") === "true";
  await call(id, "overview", settings(id, { registrationOpen: open }));
  done(id, "overview", open ? "registration_opened" : "registration_closed");
}

export async function setCapacity(formData: FormData) {
  const id = await eventIdFrom(formData);
  const raw = field(formData, "capacity");
  const capacity = raw === "" ? null : Number(raw);
  if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) fail(id, "overview", "capacity_invalid");
  await call(id, "overview", settings(id, { capacity }));
  done(id, "overview", capacity === null ? "capacity_unlimited" : "capacity_set");
}

export async function updateEventTheme(formData: FormData) {
  const id = await eventIdFrom(formData);
  const theme = field(formData, "cover_theme");
  if (!isThemeKey(theme)) fail(id, "settings", "theme_invalid");
  await call(id, "settings", settings(id, { coverTheme: theme }));
  done(id, "settings", "theme_saved");
}

export async function addQuestion(formData: FormData) {
  const id = await eventIdFrom(formData);
  const label = field(formData, "label", 200);
  const kind = field(formData, "kind");
  if (!label) fail(id, "registration", "question_missing");
  if (!KINDS.includes(kind as (typeof KINDS)[number])) fail(id, "registration", "question_kind");
  const options = field(formData, "options", 3000);
  await call(id, "registration", async () =>
    (await api()).POST("/v1/events/{id}/questions", {
      params: { path: { id } },
      body: { label, kind: kind as (typeof KINDS)[number], ...(kind === "options" ? { options: options.split(/\n|,/) } : {}), required: checkbox(formData, "required") },
    }),
  );
  done(id, "registration", "question_added");
}

export async function deleteQuestion(formData: FormData) {
  const id = await eventIdFrom(formData);
  const questionId = field(formData, "question_id");
  if (!isUuid(questionId)) fail(id, "registration");
  await call(id, "registration", async () => (await api()).DELETE("/v1/events/{id}/questions/{questionId}", { params: { path: { id, questionId } } }));
  done(id, "registration", "question_removed");
}

export async function createAnnouncement(formData: FormData) {
  const id = await eventIdFrom(formData);
  const subject = field(formData, "subject", 200);
  const body = field(formData, "body", 10000);
  const segment = field(formData, "segment") || "all";
  if (!subject || !body) fail(id, "announcements", "announcement_missing");
  if (!SEGMENTS.includes(segment as (typeof SEGMENTS)[number])) fail(id, "announcements", "announcement_segment");
  await call(id, "announcements", async () =>
    (await api()).POST("/v1/events/{id}/announcements", { params: { path: { id } }, body: { subject, body, segment: segment as (typeof SEGMENTS)[number] } }),
  );
  done(id, "announcements", "announcement_saved");
}

// Free plan (C2): the API enforces 2 sends per event, before it starts, and 1,000 emails a month.
export async function sendAnnouncement(formData: FormData) {
  const id = await eventIdFrom(formData);
  const announcementId = field(formData, "announcement_id");
  if (!isUuid(announcementId)) fail(id, "announcements");
  await call(id, "announcements", async () =>
    data(await (await api()).POST("/v1/events/{id}/announcements/{announcementId}/send", { params: { path: { id, announcementId } } })),
  );
  done(id, "announcements", "announcement_sending");
}

export async function updateEventDetails(formData: FormData) {
  const id = await eventIdFrom(formData);
  const title = field(formData, "title", 200);
  if (title.length < 3 || title.length > 140) fail(id, "settings", "title_length");
  await call(id, "settings", async () =>
    (await api()).PATCH("/v1/events/{id}", {
      params: { path: { id } },
      body: {
        title,
        description: field(formData, "description") || null,
        refundPolicy: field(formData, "refund_policy", 2000) || null,
        visibility: field(formData, "visibility") === "private" ? "private" : "public",
        notifyRegistration: checkbox(formData, "notify_registration"),
      },
    }),
  );
  done(id, "settings", "details_saved");
}

export async function updateVenue(formData: FormData) {
  const id = await eventIdFrom(formData);
  const location = locationInput(formData);
  if ("error" in location) fail(id, "settings", "venue_country");
  await call(id, "settings", async () => (await api()).PUT("/v1/events/{id}/location", { params: { path: { id } }, body: location }));
  done(id, "settings", "venue_saved");
}

// The file comes to this action as before; it goes on to Supabase Storage through a signed URL
// from the API, which then checks the real file type and size before using it (U5).
export async function uploadFlyer(formData: FormData) {
  const id = await eventIdFrom(formData);
  const file = formData.get("flyer");
  if (!(file instanceof File) || file.size === 0) fail(id, "settings", "flyer_missing");
  if (file.size > FLYER_MAX) fail(id, "settings", "flyer_size");
  const contentType = ["image/jpeg", "image/png", "image/webp"].includes(file.type) ? (file.type as "image/jpeg" | "image/png" | "image/webp") : null;
  if (!contentType) fail(id, "settings", "flyer_type");

  const upload = await call(id, "settings", async () => data(await (await api()).POST("/v1/events/{id}/flyer/upload-url", { params: { path: { id } }, body: { contentType } })));
  const put = await fetch(upload.uploadUrl, { method: "PUT", body: Buffer.from(await file.arrayBuffer()), headers: { "content-type": contentType } }).catch(() => null);
  if (!put?.ok) {
    console.error(`[dashboard] flyer upload to storage failed: ${put?.status ?? "network"}`);
    fail(id, "settings");
  }
  await call(id, "settings", async () => (await api()).POST("/v1/events/{id}/flyer", { params: { path: { id } }, body: { path: upload.path } }));
  done(id, "settings", "flyer_uploaded");
}

export async function removeFlyer(formData: FormData) {
  const id = await eventIdFrom(formData);
  await call(id, "settings", async () => (await api()).DELETE("/v1/events/{id}/flyer", { params: { path: { id } } }));
  done(id, "settings", "flyer_removed");
}

export async function cancelEvent(formData: FormData) {
  const id = await eventIdFrom(formData);
  if (formData.get("confirm") !== "yes") fail(id, "settings", "cancel_confirm");
  await call(id, "settings", async () => (await api()).POST("/v1/events/{id}/cancel", { params: { path: { id } }, body: { confirm: true } }));
  done(id, "settings", "event_cancelled");
}

// Owner only; the host types the event name to confirm. The API checks both, and refuses events
// with paid tickets. Flyer files are cleaned up by the API after the delete.
export async function deleteEvent(formData: FormData) {
  const id = await eventIdFrom(formData);
  const confirmTitle = field(formData, "confirm_title", 200);
  await call(id, "settings", async () => (await api()).DELETE("/v1/events/{id}", { params: { path: { id } }, body: { confirmTitle } }));
  revalidatePath("/dashboard");
  revalidatePath("/");
  redirect("/dashboard?deleted=1");
}

// ---- Guests (U6b step 3) ----

export async function checkInGuest(formData: FormData) {
  const id = await eventIdFrom(formData);
  const ticketId = field(formData, "ticket_id");
  if (!isUuid(ticketId)) fail(id, "guests");
  const scan = await call(id, "guests", async () => data(await (await api()).POST("/v1/events/{id}/guests/{ticketId}/check-in", { params: { path: { id, ticketId } } })));
  if (scan.result === "green") done(id, "guests", "checked_in");
  fail(id, "guests", scan.reason === "already_used" ? "already_used" : "checkin_failed");
}

export async function approveOrder(formData: FormData) {
  const id = await eventIdFrom(formData);
  const orderId = field(formData, "order_id");
  if (!isUuid(orderId)) fail(id, "guests");
  await call(id, "guests", async () => (await api()).POST("/v1/events/{id}/orders/{orderId}/approve", { params: { path: { id, orderId } } }));
  done(id, "guests", "approved");
}

export async function declineOrder(formData: FormData) {
  const id = await eventIdFrom(formData);
  const orderId = field(formData, "order_id");
  if (!isUuid(orderId)) fail(id, "guests");
  const message = field(formData, "message", 500);
  await call(id, "guests", async () =>
    (await api()).POST("/v1/events/{id}/orders/{orderId}/decline", { params: { path: { id, orderId } }, body: message ? { message } : {} }),
  );
  done(id, "guests", "declined");
}

export async function promoteFromWaitlist(formData: FormData) {
  const id = await eventIdFrom(formData);
  await call(id, "guests", async () => (await api()).POST("/v1/events/{id}/waitlist/promote", { params: { path: { id } } }));
  done(id, "guests", "promoted");
}
