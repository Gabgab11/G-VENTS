// Sends email through Resend's HTTP API. No SDK needed.
//
// Settings (Vercel → Environment Variables):
//   RESEND_API_KEY     required to send. Without it, emails are skipped and logged.
//   TICKET_EMAIL_FROM  optional sender, e.g. "G-ventZ Tickets <tickets@gventz.com>".
//                      Until the domain is verified in Resend, the default test
//                      sender below only delivers to the Resend account's own address.

const DEFAULT_FROM = "G-ventZ Tickets <onboarding@resend.dev>";

export type InlineImage = { filename: string; contentBase64: string; contentId: string };

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  images?: InlineImage[];
};

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY is not set, so the email was not sent.");
    return false;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.TICKET_EMAIL_FROM || DEFAULT_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        attachments: (message.images ?? []).map((img) => ({
          filename: img.filename,
          content: img.contentBase64,
          content_id: img.contentId,
        })),
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error(`[email] Resend refused the email (${response.status}): ${(await response.text()).slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] Could not reach Resend:", error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
