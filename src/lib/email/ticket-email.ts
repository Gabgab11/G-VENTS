import { timezoneLabel } from "@/lib/dates";
import { displayCode, ticketDate, ticketPlace, ticketPrice, ticketTime, type Ticket } from "@/lib/ticket";

// The "You're in" email with the guest's ticket. Built with tables and inline
// styles because that is what Gmail, Outlook, Yahoo and Apple Mail all render.
// The QR code is an inline PNG attachment referenced as cid:QR_CID.

export const QR_CID = "gventz-ticket-qr";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const DISPLAY = "'Bricolage Grotesque','Helvetica Neue',Helvetica,Arial,sans-serif";
const BODY = "Inter,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "'SF Mono',Menlo,Consolas,'Courier New',monospace";

function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:0 0 14px 0;">
        <div style="font-family:${BODY};font-size:11px;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;color:#6b6a66;">${esc(label)}</div>
        <div style="font-family:${BODY};font-size:16px;font-weight:600;color:#121212;line-height:1.4;margin-top:3px;">${esc(value)}</div>
      </td>
    </tr>`;
}

export function ticketEmail(ticket: Ticket, ticketLink: string): { subject: string; html: string; text: string } {
  const { event, tier } = ticket;
  const tz = event.timezone;
  const date = ticketDate(event.starts_at, tz);
  const time = `${ticketTime(event.starts_at, tz)}${event.ends_at ? ` – ${ticketTime(event.ends_at, tz)}` : ""} (${timezoneLabel(tz)})`;
  const place = ticketPlace(event);
  const ticketLine = `${tier.name} · ${ticketPrice(tier)}`;
  const code = displayCode(ticket.code);
  const firstName = ticket.name.split(" ")[0] || ticket.name;
  const subject = `Your ticket for ${event.title}`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f5f1;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">You're in, ${esc(firstName)}. Your ticket and QR code for ${esc(event.title)} are inside.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f5f1;">
  <tr>
    <td align="center" style="padding:28px 14px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

        <tr>
          <td style="padding:0 6px 18px;font-family:${DISPLAY};font-size:22px;font-weight:800;letter-spacing:-0.4px;color:#121212;">
            G-vent<span style="color:#ff5a3c;">Z</span>
          </td>
        </tr>

        <tr>
          <td style="padding:0 6px 20px;">
            <div style="font-family:${DISPLAY};font-size:34px;line-height:1.05;font-weight:800;letter-spacing:-1px;color:#121212;">
              You're in, <span style="background:#ffc23d;padding:0 6px;border-radius:6px;">${esc(firstName)}</span>.
            </div>
            <div style="font-family:${BODY};font-size:16px;line-height:1.6;color:#6b6a66;margin-top:12px;">
              Here's your ticket. Show the QR code at the door, on your phone or printed.
            </div>
          </td>
        </tr>

        <!-- Ticket -->
        <tr>
          <td style="background:#ffffff;border-radius:22px;border:1px solid #ebe9e2;overflow:hidden;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#ffc23d;border-radius:22px 22px 0 0;padding:20px 24px 24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="font-family:${DISPLAY};font-size:15px;font-weight:800;color:#121212;">G-vent<span style="color:#ff5a3c;">Z</span></td>
                      <td align="right">
                        <span style="display:inline-block;background:#121212;color:#ffffff;font-family:${BODY};font-size:10px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;padding:6px 10px;border-radius:999px;">Admit one</span>
                      </td>
                    </tr>
                  </table>
                  <div style="font-family:${DISPLAY};font-size:30px;line-height:1.02;font-weight:800;letter-spacing:-0.8px;color:#121212;margin-top:18px;">${esc(event.title)}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:22px 24px 8px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    ${row("Date", date)}
                    ${row("Time", time)}
                    ${row("Where", place)}
                    ${row("Ticket", ticketLine)}
                    ${row("Guest", ticket.name)}
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 24px;"><div style="border-top:2px dashed #ebe9e2;height:0;line-height:0;font-size:0;">&nbsp;</div></td>
              </tr>
              <tr>
                <td align="center" style="padding:24px 24px 26px;">
                  <img src="cid:${QR_CID}" width="200" height="200" alt="Ticket QR code" style="display:block;width:200px;height:200px;border:0;outline:none;">
                  <div style="font-family:${MONO};font-size:14px;font-weight:600;letter-spacing:1px;color:#121212;margin-top:12px;">${esc(code)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:24px 6px 8px;">
            <a href="${esc(ticketLink)}" style="display:inline-block;background:#121212;color:#ffffff;font-family:${BODY};font-size:15px;font-weight:600;text-decoration:none;padding:14px 26px;border-radius:14px;">Open or print your ticket</a>
          </td>
        </tr>

        <tr>
          <td style="padding:22px 6px 0;font-family:${BODY};font-size:13px;line-height:1.6;color:#6b6a66;">
            ${event.refund_policy ? `Refund policy: ${esc(event.refund_policy)}<br><br>` : ""}
            This ticket is for ${esc(ticket.name)}. Anyone with the link can see it, so only forward it to people you trust.<br><br>
            Sent by G-ventZ because you registered for this event.
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    `You're in, ${firstName}.`,
    "",
    event.title,
    `Date: ${date}`,
    `Time: ${time}`,
    `Where: ${place}`,
    `Ticket: ${ticketLine}`,
    `Guest: ${ticket.name}`,
    `Ticket code: ${code}`,
    "",
    `Open or print your ticket: ${ticketLink}`,
    "",
    "Show the QR code on that page at the door, on your phone or printed.",
    event.refund_policy ? `\nRefund policy: ${event.refund_policy}` : "",
    "",
    "Sent by G-ventZ because you registered for this event.",
  ].join("\n");

  return { subject, html, text };
}
