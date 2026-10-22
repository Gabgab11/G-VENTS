import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { timezoneLabel } from "@/lib/dates";
import { qrSvg } from "@/lib/qr";
import {
  displayCode, getTicket, isTicketCode, siteOrigin, ticketDate, ticketPlace, ticketPrice, ticketTime, ticketUrl,
  type Ticket,
} from "@/lib/ticket";
import { checkInFromTicket } from "./actions";
import PrintButton from "./PrintButton";
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
    case "cancelled":
      return { tone: "warn", title: "This ticket was cancelled", body: "It can no longer be used to enter the event." };
    case "refunded":
      return { tone: "warn", title: "This ticket was refunded", body: "It can no longer be used to enter the event." };
    default:
      return null;
  }
}

export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ checkin?: string }>;
}) {
  const { code: rawCode } = await params;
  const { checkin } = await searchParams;
  const code = rawCode.toLowerCase();
  if (!isTicketCode(code)) notFound();

  const supabase = await createSupabaseServerClient();
  const ticket = await getTicket(supabase, code);
  if (!ticket) notFound();

  const { event, tier } = ticket;
  const note = statusNote(ticket);
  const valid = ticket.status === "confirmed" && event.status !== "cancelled";
  const origin = await siteOrigin();
  const qr = valid ? qrSvg(ticketUrl(origin, ticket.code)) : null;
  const tz = event.timezone;
  const endTime = event.ends_at ? ticketTime(event.ends_at, tz) : null;
  const checkedInAt = ticket.checked_in_at ? ticketTime(ticket.checked_in_at, tz) : null;

  return (
    <main className={`tk ${pageFonts}`}>
      <style dangerouslySetInnerHTML={{ __html: TICKET_CSS }} />

      <header className="tk-top">
        <Link href="/" className="tk-logo">G-vent<b>Z</b></Link>
        <span className="tk-small">Your ticket</span>
      </header>

      {checkin === "done" && (
        <div className="tk-note ok" role="status"><b>Checked in</b>{ticket.name} is in. Enjoy the event!</div>
      )}
      {checkin === "failed" && (
        <div className="tk-note warn" role="alert"><b>Couldn&apos;t check in</b>Refresh the page and try again.</div>
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
              <div className="tk-value">{ticketDate(event.starts_at, tz)}</div>
            </div>
            <div className="tk-field">
              <div className="tk-label">Time</div>
              <div className="tk-value">
                {ticketTime(event.starts_at, tz)}{endTime ? ` – ${endTime}` : ""}
                <span className="tk-small"> ({timezoneLabel(tz)})</span>
              </div>
            </div>
            <div className="tk-field">
              <div className="tk-label">Ticket</div>
              <div className="tk-value">{tier.name} · {ticketPrice(tier)}</div>
            </div>
            <div className="tk-field wide">
              <div className="tk-label">Where</div>
              <div className="tk-value">{ticketPlace(event)}</div>
            </div>
            <div className="tk-field wide">
              <div className="tk-label">Guest</div>
              <div className="tk-value big">{ticket.name}</div>
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

      {ticket.can_check_in && valid && (
        <section className="tk-staff" aria-label="Door check-in">
          {checkedInAt ? (
            <p><b>Already checked in</b> at {checkedInAt}. Don&apos;t let this ticket in twice.</p>
          ) : (
            <>
              <p><b>You&apos;re staff for this event.</b> Check this guest in at the door.</p>
              <form action={checkInFromTicket}>
                <input type="hidden" name="code" value={ticket.code} />
                <button type="submit" className="tk-btn tk-go">Check in {ticket.name.split(" ")[0]}</button>
              </form>
            </>
          )}
        </section>
      )}

      <p className="tk-foot no-print">
        This ticket belongs to {ticket.name}. Anyone with this link can see it, so only share it with people you trust.
        {event.refund_policy ? <><br />Refund policy: {event.refund_policy}</> : null}
      </p>
    </main>
  );
}
