"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { field, isUuid } from "@/lib/forms";
import { userMessage } from "@/lib/errors";
import { queueTicketEmail } from "@/lib/email/send-ticket";

export type RegisterState =
  | { error?: string; status?: "confirmed" | "waitlisted" | "pending"; ticketCode?: string }
  | undefined;

const QUESTION_FIELD = /^q_([0-9a-f-]{36})$/i;

// Registration needs a signed-in guest. register_guest() in the database is the authority:
// it checks the event and ticket, enforces the event's own questions, and applies capacity
// and the waiting list. Answers are sent by question id only; labels come from the database.
// The ticket goes to the account's verified email, never an address typed into the form.
export async function registerGuest(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const eventId = field(formData, "event_id");
  const tierId = field(formData, "tier_id");
  const name = field(formData, "name", 120);

  if (!isUuid(eventId)) return { error: "This event could not be found." };
  if (!isUuid(tierId)) return { error: "Choose a ticket." };

  const answers: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    const match = QUESTION_FIELD.exec(key);
    if (match && typeof value === "string") answers[match[1]] = value.trim().slice(0, 1000);
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to register." };

  const { data, error } = await supabase.rpc("register_guest", {
    p_event: eventId, p_tier: tierId, p_name: name, p_email: user.email ?? "", p_answers: answers,
  });

  if (error || !data) return { error: userMessage(error, "We couldn't complete your registration. Please try again.") };
  const status = data.status as "confirmed" | "waitlisted" | "pending";
  if (status === "confirmed") await queueTicketEmail(supabase, data.ticket_code, data.attendee_email);
  return { status, ticketCode: data.ticket_code };
}
