"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTicket, isTicketCode } from "@/lib/ticket";

// Door check-in from a scanned ticket. A host scans the QR code with their phone
// camera, the ticket page opens, and event staff see a "Check in" button.
// check_in_guest() in the database decides who may check guests in and blocks
// a second check-in of the same ticket.
export async function checkInFromTicket(formData: FormData) {
  const code = String(formData.get("code") ?? "").toLowerCase();
  if (!isTicketCode(code)) redirect("/");

  const supabase = await createSupabaseServerClient();
  let ok = false;
  try {
    const ticket = await getTicket(supabase, code);
    if (ticket?.can_check_in) {
      const { error } = await supabase.rpc("check_in_guest", { p_registration: ticket.id });
      if (error) console.error(`[ticket] check in: ${error.message}`);
      ok = !error;
    }
  } catch (error) {
    console.error("[ticket] check in:", error);
  }
  redirect(`/t/${code}?checkin=${ok ? "done" : "failed"}`);
}
