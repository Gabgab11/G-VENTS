"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireEventRole, type EventRole } from "@/lib/auth";
import { isThemeKey } from "@/lib/themes";
import { checkbox, field, isUuid } from "@/lib/forms";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { MessageCode } from "./messages";
import { queueTicketEmail } from "@/lib/email/send-ticket";
import type { TablesUpdate } from "@/lib/supabase/database.types";

const KINDS = ["text", "options", "social", "company", "terms", "phone", "website"] as const;
const SEGMENTS = ["all", "paid", "checked_in", "not_checked_in", "waitlist"] as const;
const MAX_QUESTIONS = 30;

type Tab = "overview" | "guests" | "registration" | "announcements" | "settings";

function done(id: string, tab: Tab, code: MessageCode, ok = true): never {
  revalidatePath(`/dashboard/${id}`);
  revalidatePath("/dashboard");
  redirect(`/dashboard/${id}?tab=${tab}&${ok ? "ok" : "err"}=${code}`);
}

function fail(id: string, tab: Tab, code: MessageCode = "failed"): never {
  done(id, tab, code, false);
}

function logError(action: string, error: { message: string } | null) {
  if (error) console.error(`[dashboard] ${action}: ${error.message}`);
}

// Every action starts here: a valid event id and a signed-in user who manages that event.
async function authorize(formData: FormData, roles?: EventRole[]) {
  const id = field(formData, "event_id");
  const { supabase, user } = await requireEventRole(id, roles);
  return { id, supabase, user };
}

// Updates one event and confirms a row really changed. When RLS blocks an update,
// Postgres reports success with zero rows, which used to show a false "Saved".
async function updateEvent(supabase: SupabaseServerClient, id: string, tab: Tab, patch: TablesUpdate<"events">) {
  const { data, error } = await supabase.from("events").update(patch).eq("id", id).select("id");
  if (error) {
    logError("update event", error);
    fail(id, tab);
  }
  if (!data || data.length === 0) fail(id, tab, "not_saved");
}

export async function setRegistrationOpen(formData: FormData) {
  const { id, supabase } = await authorize(formData);
  const open = field(formData, "open") === "true";
  await updateEvent(supabase, id, "overview", { registration_open: open });
  done(id, "overview", open ? "registration_opened" : "registration_closed");
}

export async function setCapacity(formData: FormData) {
  const { id, supabase } = await authorize(formData);
  const raw = field(formData, "capacity");
  let capacity: number | null = null;
  if (raw !== "") {
    capacity = Number(raw);
    if (!Number.isInteger(capacity) || capacity <= 0 || capacity > 1_000_000) fail(id, "overview", "capacity_invalid");
  }
  await updateEvent(supabase, id, "overview", { capacity });
  done(id, "overview", capacity ? "capacity_set" : "capacity_unlimited");
}

export async function addQuestion(formData: FormData) {
  const { id, supabase } = await authorize(formData);
  const label = field(formData, "label", 200);
  const kind = field(formData, "kind");
  const required = checkbox(formData, "required");

  if (!label) fail(id, "registration", "question_missing");
  if (!KINDS.includes(kind as (typeof KINDS)[number])) fail(id, "registration", "question_kind");

  const options = kind === "options"
    ? [...new Set(field(formData, "options").split(/\n|,/).map((o) => o.trim().slice(0, 100)).filter(Boolean))].slice(0, 30)
    : [];
  if (kind === "options" && options.length < 2) fail(id, "registration", "question_options");

  const { count } = await supabase.from("event_questions").select("id", { count: "exact", head: true }).eq("event_id", id);
  if ((count ?? 0) >= MAX_QUESTIONS) fail(id, "registration", "question_limit");

  const { error } = await supabase.from("event_questions").insert({
    event_id: id, label, kind, options, required: kind === "terms" ? true : required, position: (count ?? 0) + 1,
  });
  if (error) {
    logError("add question", error);
    fail(id, "registration");
  }
  done(id, "registration", "question_added");
}

export async function deleteQuestion(formData: FormData) {
  const { id, supabase } = await authorize(formData);
  const questionId = field(formData, "question_id");
  if (!isUuid(questionId)) fail(id, "registration");
  const { data, error } = await supabase.from("event_questions").delete().eq("id", questionId).eq("event_id", id).select("id");
  if (error || !data?.length) {
    logError("delete question", error);
    fail(id, "registration", error ? "failed" : "not_saved");
  }
  done(id, "registration", "question_removed");
}

export async function checkInGuest(formData: FormData) {
  const { id, supabase } = await authorize(formData, ["owner", "admin", "editor", "checkin"]);
  const registrationId = field(formData, "registration_id");
  if (!isUuid(registrationId)) fail(id, "guests");
  const { error } = await supabase.rpc("check_in_guest", { p_registration: registrationId });
  if (error) {
    logError("check in", error);
    fail(id, "guests", "checkin_failed");
  }
  done(id, "guests", "checked_in");
}

export async function promoteFromWaitlist(formData: FormData) {
  const { id, supabase } = await authorize(formData);
  const { data, error } = await supabase.rpc("promote_next_waitlisted", { p_event: id });
  if (error) {
    logError("promote", error);
    fail(id, "guests", "promote_failed");
  }
  if (data?.ticket_code && data.attendee_email) {
    await queueTicketEmail(supabase, data.ticket_code, data.attendee_email);
  }
  done(id, "guests", "promoted");
}

export async function createAnnouncement(formData: FormData) {
  const { id, supabase, user } = await authorize(formData);
  const subject = field(formData, "subject", 200);
  const body = field(formData, "body", 10000);
  const segment = field(formData, "segment") || "all";
  if (!subject || !body) fail(id, "announcements", "announcement_missing");
  if (!SEGMENTS.includes(segment as (typeof SEGMENTS)[number])) fail(id, "announcements", "announcement_segment");

  const { error } = await supabase.from("email_campaigns").insert({
    event_id: id, created_by: user.id, subject, body, segment, status: "draft",
  });
  if (error) {
    logError("create announcement", error);
    fail(id, "announcements");
  }
  done(id, "announcements", "announcement_saved");
}

export async function updateEventDetails(formData: FormData) {
  const { id, supabase } = await authorize(formData);
  const title = field(formData, "title", 200);
  if (title.length < 3 || title.length > 140) fail(id, "settings", "title_length");

  await updateEvent(supabase, id, "settings", {
    title,
    description: field(formData, "description") || null,
    venue_name: field(formData, "venue", 300) || null,
    city: field(formData, "city", 120) || null,
    country: field(formData, "country", 120) || null,
    refund_policy: field(formData, "refund_policy", 2000) || null,
    visibility: field(formData, "visibility") === "private" ? "private" : "public",
    notify_registration: checkbox(formData, "notify_registration"),
  });
  done(id, "settings", "details_saved");
}

const FLYER_BUCKET = "event-covers";
const FLYER_MAX = 5 * 1024 * 1024;

// Identify the image from its first bytes; the browser's declared type can't be trusted.
function sniffImage(bytes: Uint8Array): { type: string; ext: string } | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0xff, 0xd8, 0xff])) return { type: "image/jpeg", ext: "jpg" };
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { type: "image/png", ext: "png" };
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return { type: "image/webp", ext: "webp" };
  return null;
}

// "https://…/storage/v1/object/public/event-covers/<id>/<file>" → "<id>/<file>"
function flyerPath(publicUrl: string | null): string | null {
  if (!publicUrl) return null;
  const marker = `/object/public/${FLYER_BUCKET}/`;
  const at = publicUrl.indexOf(marker);
  return at === -1 ? null : decodeURIComponent(publicUrl.slice(at + marker.length));
}

async function currentFlyer(supabase: SupabaseServerClient, id: string) {
  const { data } = await supabase.from("events").select("cover_url").eq("id", id).maybeSingle();
  return flyerPath(data?.cover_url ?? null);
}

async function deleteFlyer(supabase: SupabaseServerClient, path: string | null) {
  if (!path) return;
  const { error } = await supabase.storage.from(FLYER_BUCKET).remove([path]);
  // A leftover file only costs storage, so the action still succeeds.
  logError("delete old flyer", error);
}

export async function uploadFlyer(formData: FormData) {
  const { id, supabase } = await authorize(formData);
  const file = formData.get("flyer");
  if (!(file instanceof File) || file.size === 0) fail(id, "settings", "flyer_missing");
  if (file.size > FLYER_MAX) fail(id, "settings", "flyer_size");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = sniffImage(bytes);
  if (!image) fail(id, "settings", "flyer_type");

  const previous = await currentFlyer(supabase, id);
  const path = `${id}/${Date.now()}.${image.ext}`;
  const { error: upErr } = await supabase.storage.from(FLYER_BUCKET).upload(path, bytes, {
    contentType: image.type,
    upsert: false,
  });
  if (upErr) {
    logError("upload flyer", upErr);
    fail(id, "settings");
  }

  const { data } = supabase.storage.from(FLYER_BUCKET).getPublicUrl(path);
  await updateEvent(supabase, id, "settings", { cover_url: data.publicUrl });
  await deleteFlyer(supabase, previous);
  done(id, "settings", "flyer_uploaded");
}

export async function removeFlyer(formData: FormData) {
  const { id, supabase } = await authorize(formData);
  const previous = await currentFlyer(supabase, id);
  await updateEvent(supabase, id, "settings", { cover_url: null });
  await deleteFlyer(supabase, previous);
  done(id, "settings", "flyer_removed");
}

export async function cancelEvent(formData: FormData) {
  const { id, supabase } = await authorize(formData);
  // Editors manage the event but can't cancel it; the database trigger enforces the same rule.
  const { data: canCancel } = await supabase.rpc("has_event_role", { p_event: id, p_roles: ["owner", "admin"] });
  if (!canCancel) fail(id, "settings", "cancel_forbidden");
  if (formData.get("confirm") !== "yes") fail(id, "settings", "cancel_confirm");
  await updateEvent(supabase, id, "settings", { status: "cancelled", registration_open: false });
  done(id, "settings", "event_cancelled");
}

export async function updateEventTheme(formData: FormData) {
  const { id, supabase } = await authorize(formData);
  const theme = field(formData, "cover_theme");
  if (!isThemeKey(theme)) fail(id, "settings", "theme_invalid");
  await updateEvent(supabase, id, "settings", { cover_theme: theme });
  done(id, "settings", "theme_saved");
}
