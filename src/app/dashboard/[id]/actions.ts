"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const KINDS = ["text", "options", "social", "company", "terms", "phone", "website"] as const;

function done(id: string, tab: string, message: string, ok = true): never {
  revalidatePath(`/dashboard/${id}`);
  revalidatePath("/dashboard");
  redirect(`/dashboard/${id}?tab=${tab}&${ok ? "ok" : "err"}=${encodeURIComponent(message)}`);
}

export async function setRegistrationOpen(formData: FormData) {
  const id = String(formData.get("event_id"));
  const open = formData.get("open") === "true";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("events").update({ registration_open: open }).eq("id", id);
  if (error) done(id, "overview", error.message, false);
  done(id, "overview", open ? "Registration is open" : "Registration is closed");
}

export async function setCapacity(formData: FormData) {
  const id = String(formData.get("event_id"));
  const raw = String(formData.get("capacity") ?? "").trim();
  let capacity: number | null = null;
  if (raw !== "") {
    capacity = Number(raw);
    if (!Number.isInteger(capacity) || capacity <= 0) done(id, "overview", "Capacity must be a whole number above 0", false);
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("events").update({ capacity }).eq("id", id);
  if (error) done(id, "overview", error.message, false);
  done(id, "overview", capacity ? `Capacity set to ${capacity}. Extra guests go to the waiting list.` : "Capacity is unlimited");
}

export async function addQuestion(formData: FormData) {
  const id = String(formData.get("event_id"));
  const label = String(formData.get("label") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  const optionsRaw = String(formData.get("options") ?? "");
  const required = formData.get("required") === "on";

  if (!label) done(id, "registration", "Write the question first", false);
  if (!KINDS.includes(kind as (typeof KINDS)[number])) done(id, "registration", "Choose a question type", false);

  const options = kind === "options"
    ? optionsRaw.split(/\n|,/).map((o) => o.trim()).filter(Boolean)
    : [];
  if (kind === "options" && options.length < 2) done(id, "registration", "Add at least two options", false);

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase.from("event_questions").select("id", { count: "exact", head: true }).eq("event_id", id);
  const { error } = await supabase.from("event_questions").insert({
    event_id: id, label, kind, options, required: kind === "terms" ? true : required, position: (count ?? 0) + 1,
  });
  if (error) done(id, "registration", error.message, false);
  done(id, "registration", "Question added");
}

export async function deleteQuestion(formData: FormData) {
  const id = String(formData.get("event_id"));
  const questionId = String(formData.get("question_id"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("event_questions").delete().eq("id", questionId).eq("event_id", id);
  if (error) done(id, "registration", error.message, false);
  done(id, "registration", "Question removed");
}

export async function checkInGuest(formData: FormData) {
  const id = String(formData.get("event_id"));
  const registrationId = String(formData.get("registration_id"));
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("registrations")
    .update({ checked_in_at: new Date().toISOString(), checked_in_by: user?.id ?? null })
    .eq("id", registrationId)
    .eq("event_id", id);
  if (error) done(id, "guests", error.message, false);
  done(id, "guests", "Checked in");
}

export async function promoteFromWaitlist(formData: FormData) {
  const id = String(formData.get("event_id"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("promote_next_waitlisted", { p_event: id });
  if (error) done(id, "guests", error.message, false);
  done(id, "guests", "A guest from the waiting list is now confirmed");
}

export async function createAnnouncement(formData: FormData) {
  const id = String(formData.get("event_id"));
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const segment = String(formData.get("segment") ?? "all");
  if (!subject || !body) done(id, "announcements", "Add a subject and a message", false);

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { error } = await supabase.from("email_campaigns").insert({
    event_id: id, created_by: user.id, subject, body, segment, status: "draft",
  });
  if (error) done(id, "announcements", error.message, false);
  done(id, "announcements", "Saved. Sending starts once email delivery is connected.");
}
