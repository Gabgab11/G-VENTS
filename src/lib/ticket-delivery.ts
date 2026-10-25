// Email delivery for tickets: finding the guest's address, limiting resends,
// and logging each attempt. Server-side only (uses the service-role client).

import { adminConfigured, createSupabaseAdminClient } from "@/lib/supabase/admin";

// Resends per ticket in an hour. Stops someone with the link from flooding the inbox.
export const EMAIL_LIMIT_PER_HOUR = 5;

// The address the guest registered with. Null when the admin key isn't set or
// the ticket doesn't exist.
export async function registeredEmail(ticketCode: string): Promise<string | null> {
  if (!adminConfigured()) return null;
  const { data, error } = await createSupabaseAdminClient()
    .from("registrations")
    .select("attendee_email")
    .eq("ticket_code", ticketCode)
    .maybeSingle();
  if (error) {
    console.error("[delivery] could not read registration:", error.message);
    return null;
  }
  return (data?.attendee_email as string | undefined) ?? null;
}

export async function emailsSentRecently(ticketCode: string): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await createSupabaseAdminClient()
    .from("ticket_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("ticket_code", ticketCode)
    .eq("channel", "email")
    .gte("created_at", since);
  if (error) {
    console.error("[delivery] could not count sends:", error.message);
    return 0;
  }
  return count ?? 0;
}

// Logs one attempt. Never throws: a logging problem must not stop a ticket from being sent.
export async function recordEmailDelivery(
  ticketCode: string,
  destination: string,
  sent: boolean,
  error?: string,
): Promise<void> {
  if (!adminConfigured()) return;
  try {
    const { error: insertError } = await createSupabaseAdminClient()
      .from("ticket_deliveries")
      .insert({
        ticket_code: ticketCode,
        channel: "email",
        destination,
        status: sent ? "sent" : "failed",
        error: sent ? null : (error ?? "send failed").slice(0, 300),
      });
    if (insertError) console.error("[delivery] could not log attempt:", insertError.message);
  } catch (err) {
    console.error("[delivery] could not log attempt:", err);
  }
}

export type LastDelivery = { status: "sent" | "failed"; created_at: string };

export async function lastEmailDelivery(ticketCode: string): Promise<LastDelivery | null> {
  if (!adminConfigured()) return null;
  const { data, error } = await createSupabaseAdminClient()
    .from("ticket_deliveries")
    .select("status, created_at")
    .eq("ticket_code", ticketCode)
    .eq("channel", "email")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as LastDelivery;
}
