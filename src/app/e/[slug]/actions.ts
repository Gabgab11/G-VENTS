"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RegisterState =
  | { error?: string; status?: "confirmed" | "waitlisted" | "pending"; ticketCode?: string }
  | undefined;

type Q = { id: string; label: string; kind: string; required: boolean };

// Guests register without an account. The database function checks the event is open,
// the ticket exists and is available, and whether the event is full (waiting list).
export async function registerGuest(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const eventId = String(formData.get("event_id") ?? "");
  const tierId = String(formData.get("tier_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const questions: Q[] = JSON.parse(String(formData.get("questions_json") ?? "[]"));

  const answers: Record<string, { label: string; value: string }> = {};
  for (const q of questions) {
    const raw = formData.get(`q_${q.id}`);
    const value = q.kind === "terms" ? (raw === "on" ? "Accepted" : "") : String(raw ?? "").trim();
    if (q.required && !value) return { error: `Please answer: ${q.label}` };
    if (value) answers[q.id] = { label: q.label, value };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("register_guest", {
    p_event: eventId, p_tier: tierId, p_name: name, p_email: email, p_answers: answers,
  });

  if (error) return { error: error.message.replace(/^.*?: /, "") };
  const row = data as { status: string; ticket_code: string };
  return { status: row.status as "confirmed" | "waitlisted" | "pending", ticketCode: row.ticket_code };
}
