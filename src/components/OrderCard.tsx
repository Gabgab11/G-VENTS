import Link from "next/link";
import type { components } from "@/lib/api/schema";
import { eventDateParts } from "@/lib/dates";
import { qrSvg } from "@/lib/qr";

export type MyOrder = components["schemas"]["MyOrderResponse"];

const STATUS: Record<string, { title: string; body: string }> = {
  completed: { title: "You're in", body: "Each ticket has its own QR code. Forward a ticket to the guest it's for." },
  pending_approval: { title: "Request received", body: "The host reviews each request. We'll email your tickets as soon as they decide." },
  waitlisted: { title: "You're on the waiting list", body: "The event is full right now. If places free up, the host can move your group in." },
  declined: { title: "Not accepted this time", body: "The host couldn't accept this request." },
  cancelled: { title: "Cancelled", body: "These tickets can no longer be used." },
};

/**
 * One order with its tickets (U6a): the order result page and My tickets. QR codes are shown only
 * for confirmed tickets; each links to its own ticket page.
 */
export default function OrderCard({ order, origin, showQr }: { order: MyOrder; origin: string; showQr: boolean }) {
  const status = STATUS[order.status] ?? STATUS.cancelled!;
  const event = order.event;
  const total = order.tickets.length;
  const date = event?.startsAt ? eventDateParts(event.startsAt, event.endsAt ?? null, event.timeZone) : null;
  return (
    <section className="oc" aria-label={event ? `Tickets for ${event.title}` : "Tickets"}>
      <header className="oc-head">
        {date && <div className="ev-cal" aria-hidden="true"><span>{date.month}</span><b>{date.day}</b></div>}
        <div className="oc-head-text">
          {event ? <Link href={`/e/${event.slug}`} className="oc-title">{event.title}</Link> : <span className="oc-title">Tickets</span>}
          {date && <div className="ev-fact-sub">{date.dateLine} · {date.timeLine}</div>}
          {event?.where && <div className="ev-fact-sub">{event.where}</div>}
        </div>
        <span className={`oc-status oc-${order.status}`}>{status.title}</span>
      </header>
      <p className="oc-note">{status.body}</p>
      <ul className="oc-list">
        {order.tickets.map((t) => (
          <li key={t.code} className="oc-ticket">
            {showQr && t.status === "confirmed" && (
              <div className="oc-qr" aria-hidden="true" dangerouslySetInnerHTML={{ __html: qrSvg(`${origin}/t/${t.code}`) }} />
            )}
            <div className="oc-ticket-text">
              <b>{t.displayName}</b>
              <div className="ev-fact-sub">
                {t.ticketType}{t.number && total > 1 ? ` · ${t.number} of ${total}` : ""}{t.checkedInAt ? " · Checked in" : ""}
              </div>
            </div>
            <Link className="btn-small" href={`/t/${t.code}`}>Open ticket</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
