import { after } from "next/server";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { getTicket, siteOrigin, ticketUrl } from "@/lib/ticket";
import { qrPng } from "@/lib/qr-png";
import { QR_CID, ticketEmail } from "@/lib/email/ticket-email";
import { sendEmail } from "@/lib/email/send";
import { recordEmailDelivery } from "@/lib/ticket-delivery";

// Emails a confirmed guest their ticket. The ticket is read now (while the
// request's session is available) and the email is sent after the response,
// so the guest never waits on the mail service and a mail failure never
// undoes their registration.
export async function queueTicketEmail(supabase: SupabaseServerClient, code: string, to: string): Promise<void> {
  try {
    const ticket = await getTicket(supabase, code);
    if (!ticket || ticket.status !== "confirmed" || !to) return;
    const link = ticketUrl(await siteOrigin(), ticket.code);
    const { subject, html, text } = ticketEmail(ticket, link);
    const qr = qrPng(link, 10).toString("base64");

    after(async () => {
      const sent = await sendEmail({
        to,
        subject,
        html,
        text,
        images: [{ filename: "ticket-qr.png", contentBase64: qr, contentId: QR_CID }],
      });
      await recordEmailDelivery(ticket.code, to, sent, "The email service did not accept the message.");
      if (sent) console.info(`[email] ticket ${ticket.code.slice(0, 6)}… sent`);
    });
  } catch (error) {
    console.error("[email] ticket email skipped:", error);
  }
}
