import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { timezoneLabel } from "@/lib/dates";
import { qrSvg } from "@/lib/qr";
import { displayCode, getTicket, isTicketCode, ticketDate, ticketTime, type Ticket } from "@/lib/ticket";
import { checkInFromTicket } from "./actions";
import PrintButton from "./PrintButton";
import WhatsAppDelivery from "./WhatsAppDelivery";
import EmailDelivery from "./EmailDelivery";
import { adminConfigured } from "@/lib/supabase/admin";
import { lastEmailDelivery, registeredEmail } from "@/lib/ticket-delivery";
import { maskEmail } from "@/lib/email/mask";
import { TICKET_CSS } from "./ticket-css";
import { pageFonts } from "@/app/fonts";

// Tickets are private to whoever holds the link.
export const metadata: Metadata = {
  title: "Your ticket · G-ventZ",
  robots: { index: false, follow: false },
};

function statusNote(t: Ticket): { tone: "warn" | "ok" | ""; title: string; body: string } | null {
  if (t.event.status === "cancelled") {
    return { tone: "warn", title: "This event has been cancelled", body: "The host has cancelled this event, so this ticket can't be used." };
  }
  switch (t.status) {
    case "pending":
      return { tone: "", title: "Waiting for the host", body: "The host approves each guest. Your QR code appears here once you're confirmed." };
    case "waitlisted":
      return { tone: "", title: "You're on the waiting list", body: "The event is full right now. If a place opens, this page turns into your ticket." };
    case "declined":
      return { tone: "warn", title: "The host couldn't accept this request", body: "This ticket can't be used to enter the event." };
    case "cancelled":
      return { tone: "warn", title: "This ticket was cancelled", body: "It can no longer be used to enter the event." };
    case "refunded":
      return { tone: "warn", title: "This ticket was refunded", body: "It can no longer be used to enter the event." };
    default:
      return null;
  }
}

/** What the door check-in redirect reports (the API's scan reasons). */
const CHECK_IN: Record<string, { tone: "ok" | "warn"; title: string; body: string }> = {
  checked_in: { tone: "ok", title: "Checked in", body: "This guest is in. Enjoy the event!" },
  already_used: { tone: "warn", title: "Already checked in", body: "Don't let this ticket in twice." },
  not_confirmed: { tone: "warn", title: "Not confirmed yet", body: "The host hasn't approved this ticket." },
  waitlisted: { tone: "warn", title: "On the waiting list", body: "This ticket hasn't got a place yet." },
  cancelled: { tone: "warn", title: "Not valid", body: "This ticket was cancelled." },
  refunded: { tone: "warn", title: "Not valid", body: "This ticket was refunded." },
  failed: { tone: "warn", title: "Couldn't check in", body: "Refresh the page and try again." },
};

export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ checkin?: string; email?: string }>;
}) {
  const { code: rawCode } = await params;
  const { checkin, email: emailState } = await searchParams;
  const code = rawCode.toLowerCase();
  if (!isTicketCode(code)) notFound();

  const ticket = await getTicket(code);
  if (!ticket) notFound();

  const { event } = ticket;
  const note = statusNote(ticket);
  const checkInNote = checkin ? CHECK_IN[checkin] ?? CHECK_IN.failed : null;
  const valid = ticket.status === "confirmed" && event.status !== "cancelled";
<<<<<<< HEAD
  const qr = valid ? qrSvg(ticket.qrPayload) : null;
  const tz = event.timeZone;
  const start = event.startsAt ?? `${event.startsAtLocal}:00Z`;
  const endTime = event.endsAt ? ticketTime(event.endsAt, tz) : null;
  const checkedInAt = ticket.checkedInAt ? ticketTime(ticket.checkedInAt, tz) : null;
  const ofTotal = ticket.number && ticket.total && ticket.total > 1 ? ` · ${ticket.number} of ${ticket.total}` : "";
=======
  const origin = await siteOrigin();
  const qr = valid ? qrSvg(ticketUrl(origin, ticket.code)) : null;
  const tz = event.timezone;
  const endTime = event.ends_at ? ticketTime(event.ends_at, tz) : null;
  const checkedInAt = ticket.checked_in_at ? ticketTime(ticket.checked_in_at, tz) : null;
  const emailTo = valid && adminConfigured() ? await registeredEmail(ticket.code) : null;
  const lastEmail = emailTo ? await lastEmailDelivery(ticket.code) : null;
>>>>>>> origin/staging

  return (
    <main className={`tk ${pageFonts}`}>
      <style dangerouslySetInnerHTML={{ __html: TICKET_CSS }} />

      <header className="tk-top">
        <Link href="/" className="tk-logo">G-vent<b>Z</b></Link>
        <span className="tk-small">Your ticket</span>
      </header>

      {checkInNote && (
        <div className={`tk-note ${checkInNote.tone}`} role={checkInNote.tone === "ok" ? "status" : "alert"}><b>{checkInNote.title}</b>{checkInNote.body}</div>
      )}
      {note && (
        <div className={`tk-note ${note.tone}`} role="status"><b>{note.title}</b>{note.body}</div>
      )}

      <article className="tk-ticket" aria-label={`Ticket for ${event.title}`}>
        <div className="tk-main">
          <div className="tk-band">
            <div className="tk-band-row">
              <span className="tk-brand">G-vent<b>Z</b></span>
              <span className="tk-admit">Admit one</span>
            </div>
            <h1 className="tk-title">{event.title}</h1>
          </div>

          <div className="tk-details">
            <div className="tk-field">
              <div className="tk-label">Date</div>
              <div className="tk-value">{ticketDate(start, tz)}</div>
            </div>
            <div className="tk-field">
              <div className="tk-label">Time</div>
              <div className="tk-value">
                {ticketTime(start, tz)}{endTime ? ` – ${endTime}` : ""}
                <span className="tk-small"> ({timezoneLabel(tz)})</span>
              </div>
            </div>
            <div className="tk-field">
              <div className="tk-label">Ticket</div>
              <div className="tk-value">{ticket.ticketType} · Free{ofTotal}</div>
            </div>
            <div className="tk-field wide">
              <div className="tk-label">Where</div>
              <div className="tk-value">{event.where}</div>
            </div>
            <div className="tk-field wide">
              <div className="tk-label">Guest</div>
              <div className="tk-value big">{ticket.displayName}</div>
            </div>
          </div>
        </div>

        <div className="tk-stub">
          {qr ? (
            <div className="tk-qr" dangerouslySetInnerHTML={{ __html: qr }} />
          ) : (
            <div className="tk-void">{ticket.status === "confirmed" ? "Not valid" : "No QR code yet"}</div>
          )}
          <div className="tk-code">{displayCode(ticket.code)}</div>
          <div className="tk-hint">{valid ? "Show this code at the door. A printout works too." : "Keep this link. It updates if your ticket changes."}</div>
          {checkedInAt && (
            <div className="tk-stamp">Checked in<small>at {checkedInAt}</small></div>
          )}
        </div>
      </article>

      <div className="tk-actions">
        {valid && <PrintButton />}
        <Link href={`/e/${event.slug}`} className="tk-btn tk-ghost">Event page</Link>
      </div>

<<<<<<< HEAD
      {ticket.canCheckIn && valid && (
=======
      {emailTo && (
        <EmailDelivery code={ticket.code} maskedEmail={maskEmail(emailTo)} last={lastEmail} state={emailState} />
      )}

      {valid && process.env.NEXT_PUBLIC_WHATSAPP_NUMBER && (
        <WhatsAppDelivery
          businessNumber={process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}
          eventTitle={event.title}
          displayCode={displayCode(ticket.code)}
          ticketUrl={ticketUrl(origin, ticket.code)}
        />
      )}

      {ticket.can_check_in && valid && (
>>>>>>> origin/staging
        <section className="tk-staff" aria-label="Door check-in">
          {checkedInAt ? (
            <p><b>Already checked in</b> at {checkedInAt}. Don&apos;t let this ticket in twice.</p>
          ) : (
            <>
              <p><b>You&apos;re staff for this event.</b> Check this guest in at the door.</p>
              <form action={checkInFromTicket}>
                <input type="hidden" name="code" value={ticket.code} />
                <input type="hidden" name="event_id" value={event.id} />
                <button type="submit" className="tk-btn tk-go">Check in {ticket.displayName.split(" ")[0]}</button>
              </form>
            </>
          )}
        </section>
      )}

      <p className="tk-foot no-print">
        This ticket belongs to {ticket.displayName}. Anyone with this link can see it, so only share it with people you trust.
      </p>
    </main>
  );
}
