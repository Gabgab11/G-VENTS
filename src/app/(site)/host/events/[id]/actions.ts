"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { ApiError, problemMessage } from "@/lib/api/problem";
import { apiMessageFor } from "@/lib/api/messages";
import { can, requireEvent } from "@/lib/auth";
import { checkbox, field, isUuid } from "@/lib/forms";
import { isThemeKey } from "@/lib/themes";
import { locationInput } from "@/app/(site)/events/create-event-input";
import { MAPS_URL_HINT_KEY } from "@/lib/maps-url";
import { getLocale, getTranslations } from "next-intl/server";
import type { MessageCode } from "./messages";
import type { RefundResult } from "./refund-dialog";
import { detailsPatch, readDetailsForm } from "./details-form";
import type { components } from "@/lib/api/schema";

type UpdateDetails = components["schemas"]["UpdateEventDetailsDto"];

// Event workspace actions through gventz-api (U6b). The API checks the caller's role and every rule;
// these actions read the form, call it, and come back to the tab with a message code. API errors
// travel as `api.<code>` so the page shows the API's wording without putting text in the URL.

const KINDS = ["text", "options", "social", "company", "terms", "phone", "website"] as const;

type Tab = "overview" | "guests" | "details" | "registration" | "announcements" | "settings";

function back(id: string, tab: Tab, query: string): never {
  revalidatePath(`/host/events/${id}`);
  revalidatePath("/host/events");
  redirect(`/host/events/${id}?tab=${tab}&${query}`);
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
      if (error.status >= 500) console.error(`[host/events] ${error.message}`);
    } else {
      console.error("[host/events]", error);
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
  await call(id, "settings", settings(id, { registrationOpen: open }));
  done(id, "settings", open ? "registration_opened" : "registration_closed");
}

export async function setCapacity(formData: FormData) {
  const id = await eventIdFrom(formData);
  const raw = field(formData, "capacity");
  const capacity = raw === "" ? null : Number(raw);
  if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) fail(id, "settings", "capacity_invalid");
  await call(id, "settings", settings(id, { capacity }));
  done(id, "settings", capacity === null ? "capacity_unlimited" : "capacity_set");
}

export async function updateEventTheme(formData: FormData) {
  const id = await eventIdFrom(formData);
  const theme = field(formData, "cover_theme");
  if (!isThemeKey(theme)) fail(id, "details", "theme_invalid");
  await call(id, "details", settings(id, { coverTheme: theme }));
  done(id, "details", "theme_saved");
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

// Settings → guest policies: the refund policy and the owner's registration emails.
export async function updateEventPolicies(formData: FormData) {
  const id = await eventIdFrom(formData);
  await call(id, "settings", async () =>
    (await api()).PATCH("/v1/events/{id}", {
      params: { path: { id } },
      body: {
        refundPolicy: field(formData, "refund_policy", 2000) || null,
        notifyRegistration: checkbox(formData, "notify_registration"),
      },
    }),
  );
  done(id, "settings", "policies_saved");
}

/**
 * The Details tab (basics, dates and time zone, ticket types) → PATCH /v1/events/{id} with only
 * what changed. Rule breaks and API refusals come back as text for the form (the API's own
 * messages are shown; anything else is generic); success returns to the tab with a notice.
 */
export async function saveDetails(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const id = field(formData, "event_id");
  const event = await requireEvent(id);
  const t = await getTranslations("dashboard.details");
  if (!can(event, "event.edit")) return { error: t("errors.forbidden") };
  const result = detailsPatch(readDetailsForm(formData), event);
  if (!result.ok) return { error: t(`errors.${result.error}`) };
  if (Object.keys(result.body).length === 0) back(id, "details", "ok=nothing_changed");
  try {
    await (await api()).PATCH("/v1/events/{id}", { params: { path: { id } }, body: result.body as UpdateDetails });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status >= 500) console.error("[host/events] details:", error);
    return { error: problemMessage(error, await getTranslations("errors"), await getLocale(), t("errors.failed")) };
  }
  done(id, "details", result.rescheduled ? "rescheduled" : "details_saved");
}

const QUICK: Record<string, (v: string) => boolean> = {
  visibility: (v) => v === "public" || v === "private",
  status: (v) => v === "published",
};

// Quick settings in the workspace (publish and visibility), moved from the old list.
// The API checks the caller's role (publish: owner or admin; the others: event.edit).
export async function updateEventSetting(eventId: string, name: string, value: string): Promise<{ error?: string }> {
  const check = Object.hasOwn(QUICK, name) ? QUICK[name] : undefined;
  const t = await getTranslations("dashboard.actions");
  if (!isUuid(eventId) || !check || !check(value)) return { error: t("settingLocked") };
  try {
    const client = await api();
    const params = { path: { id: eventId } };
    if (name === "status") await client.POST("/v1/events/{id}/publish", { params });
    else await client.PATCH("/v1/events/{id}", { params, body: { visibility: value as "public" | "private" } });
  } catch (error) {
    return { error: problemMessage(error, await getTranslations("errors"), await getLocale(), t("saveFailed")) };
  }
  revalidatePath(`/host/events/${eventId}`);
  revalidatePath("/host/events");
  return {};
}

export async function updateVenue(formData: FormData) {
  const id = await eventIdFrom(formData);
  const t = await getTranslations();
  const location = locationInput(formData, (k, v) => t(k, v));
  if ("error" in location) fail(id, "details", location.error === t(MAPS_URL_HINT_KEY) ? "venue_maps_url" : "venue_country");
  await call(id, "details", async () => (await api()).PUT("/v1/events/{id}/location", { params: { path: { id } }, body: location }));
  done(id, "details", "venue_saved");
}

// Uploading a flyer is a route handler, not an action: src/app/api/events/[id]/flyer/route.ts.

export async function removeFlyer(formData: FormData) {
  const id = await eventIdFrom(formData);
  await call(id, "details", async () => (await api()).DELETE("/v1/events/{id}/flyer", { params: { path: { id } } }));
  done(id, "details", "flyer_removed");
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
  revalidatePath("/host/events");
  revalidatePath("/host");
  revalidatePath("/");
  redirect("/host/events?deleted=1");
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

// ---- Paid tickets (M5) ----

/**
 * RF4: the host refunds one paid ticket at their discretion (owner, admin or finance; two-step
 * sign-in). The ticket stops working at once; the guest gets their share back by Paystack. Returns
 * to the refund dialog, which stays open on an error and shows it there (Change 4 follow-up).
 */
export async function refundTicket(eventId: string, ticketId: string, confirmed: boolean): Promise<RefundResult> {
  const t = await getTranslations("dashboard");
  if (!isUuid(eventId) || !isUuid(ticketId)) return { ok: false, error: t("notices.err.failed") };
  if (confirmed !== true) return { ok: false, error: t("notices.err.refundConfirm") };
  try {
    const refund = data(await (await api()).POST("/v1/events/{id}/tickets/{ticketId}/refund", { params: { path: { id: eventId, ticketId } } }));
    revalidatePath(`/host/events/${eventId}`);
    return { ok: true, status: refund.status };
  } catch (error) {
    if (error instanceof ApiError && error.code === "auth.mfa_required") return { ok: false, error: t("guests.refund.twoStepTitle"), twoStep: true };
    if (!(error instanceof ApiError) || error.status >= 500) console.error("[host/events] refund:", error instanceof Error ? error.message : error);
    const lang = await getLocale();
    const message = problemMessage(error, await getTranslations("errors"), lang, t("notices.err.failed"));
    // Paystack's own reason, when the API passes one (a safe, specific text from refund.provider_rejected).
    if (error instanceof ApiError && error.code === "refund.provider_rejected") {
      const english = (await getTranslations({ locale: "en", namespace: "errors" }))("refund.provider_rejected");
      const detail = error.problem.detail.trim();
      if (detail && detail !== english && detail !== message) return { ok: false, error: message, reason: detail.slice(0, 300) };
    }
    return { ok: false, error: message };
  }
}
