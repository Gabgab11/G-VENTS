import Link from "next/link";
import type { components } from "@/lib/api/schema";
import { formatEventDate, timezoneLabel } from "@/lib/dates";
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
  return (
    <section className="done order-card" aria-label={event ? `Tickets for ${event.title}` : "Tickets"}>
      {event && (
        <>
          <Link href={`/e/${event.slug}`} className="order-event">{event.title}</Link>
          <p className="muted small">
            {formatEventDate(`${event.startsAtLocal}:00Z`, "UTC", "long")} ({timezoneLabel(event.timeZone)}) · {event.where}
          </p>
        </>
      )}
      <b>{status.title}</b>
      <p className="muted small">{status.body}</p>
      <ul className="order-tickets">
        {order.tickets.map((t) => (
          <li key={t.code} className="order-ticket">
            {showQr && t.status === "confirmed" && (
              <div className="order-qr" aria-hidden="true" dangerouslySetInnerHTML={{ __html: qrSvg(`${origin}/t/${t.code}`) }} />
            )}
            <div className="grow">
              <div><b>{t.displayName}</b></div>
              <div className="muted small">
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
