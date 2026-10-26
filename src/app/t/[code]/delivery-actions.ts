"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminConfigured } from "@/lib/supabase/admin";
import { getTicket, isTicketCode, siteOrigin, ticketUrl } from "@/lib/ticket";
import { ticketEmail, QR_CID } from "@/lib/email/ticket-email";
import { qrPng } from "@/lib/qr-png";
import { sendEmail } from "@/lib/email/send";
import {
  EMAIL_LIMIT_PER_HOUR,
  emailsSentRecently,
  recordEmailDelivery,
  registeredEmail,
} from "@/lib/ticket-delivery";

// "Email my ticket" on the ticket page. The address is never taken from the form:
// it is read from the registration, so the link can't be used to send mail to anyone else.
// Retrying sends the same ticket again. No new ticket is created.
export async function sendTicketByEmail(formData: FormData) {
  const code = String(formData.get("code") ?? "").toLowerCase();
  if (!isTicketCode(code)) redirect("/");
  // Explicit `never` so TypeScript knows the code below only runs when the checks pass.
  function back(state: string): never {
    redirect(`/t/${code}?email=${state}`);
  }

  if (formData.get("confirm") !== "yes") back("confirm");

  const supabase = await createSupabaseServerClient();
  const ticket = await getTicket(supabase, code);
  if (!ticket || ticket.status !== "confirmed" || ticket.event.status === "cancelled") back("unavailable");
  if (!adminConfigured()) back("unavailable");

  if ((await emailsSentRecently(code)) >= EMAIL_LIMIT_PER_HOUR) back("limit");

  const to = await registeredEmail(code);
  if (!to) back("unavailable");

  const link = ticketUrl(await siteOrigin(), ticket.code);
  const { subject, html, text } = ticketEmail(ticket, link);
  const qr = qrPng(link, 10).toString("base64");

  const sent = await sendEmail({
    to,
    subject,
    html,
    text,
    images: [{ filename: "ticket-qr.png", contentBase64: qr, contentId: QR_CID }],
  });
  await recordEmailDelivery(code, to, sent, "The email service did not accept the message.");
  back(sent ? "sent" : "failed");
}
