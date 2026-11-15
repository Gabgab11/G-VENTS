import Link from "next/link";
import type { components } from "@/lib/api/schema";
import { getTranslations } from "next-intl/server";
import { getFormat } from "@/i18n/format-server";
import type { Locale } from "@/i18n/languages";
import { eventDateParts, timezoneLabel } from "@/lib/dates";
import { intlLocale, safeZone } from "@/lib/format";
import { qrSvg } from "@/lib/qr";

export type MyOrder = components["schemas"]["MyOrderResponse"];

// Message ids under shared.orderCard.status (Change 3); unknown statuses show as cancelled.
const STATUS: Record<string, string> = {
  completed: "completed",
  pending_approval: "pendingApproval",
  waitlisted: "waitlisted",
  declined: "declined",
  cancelled: "cancelled",
  // Paid orders (M5)
  awaiting_payment: "awaitingPayment",
  expired: "expired",
  failed: "failed",
  refunded: "refunded",
  partially_refunded: "partiallyRefunded",
  disputed: "disputed",
};

/** The calendar tile and date lines in the page's language; English keeps eventDateParts' exact output. */
function dateParts(startsAt: string, endsAt: string | null, timeZone: string | null | undefined, lang: Locale) {
  const en = eventDateParts(startsAt, endsAt, timeZone);
  if (lang === "en") return { month: en.month, day: en.day, dateLine: en.dateLine };
  const tz = safeZone(timeZone);
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intlLocale(lang, "date"), { ...o, timeZone: tz }).format(new Date(startsAt));
  return {
    month: fmt({ month: "short" }).toUpperCase(),
    day: fmt({ day: "numeric" }),
    dateLine: fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  };
}

/**
 * One order with its tickets (U6a): the order result page and My tickets. QR codes are shown only
 * for confirmed tickets; each links to its own ticket page.
 */
export default async function OrderCard({ order, origin, showQr }: { order: MyOrder; origin: string; showQr: boolean }) {
  const t = await getTranslations("shared.orderCard");
  const format = await getFormat();
  const statusId = STATUS[order.status] ?? STATUS.cancelled!;
  const status = { title: t(`status.${statusId}.title`), body: t(`status.${statusId}.body`) };
  const event = order.event;
  const total = order.tickets.length;
  const date = event
    ? {
        ...dateParts(event.startsAt, event.endsAt, event.timeZone, format.lang),
        timeLine: t("timeLine", { range: format.range(event.startsAt, event.endsAt, event.timeZone), zone: timezoneLabel(safeZone(event.timeZone)) }),
      }
    : null;
  return (
    <section className="oc" aria-label={event ? t("ticketsFor", { title: event.title }) : t("tickets")}>
      <header className="oc-head">
        {date && <div className="ev-cal" aria-hidden="true"><span>{date.month}</span><b>{date.day}</b></div>}
        <div className="oc-head-text">
          {event ? <Link href={`/e/${event.slug}`} className="oc-title">{event.title}</Link> : <span className="oc-title">{t("tickets")}</span>}
          {date && <div className="ev-fact-sub">{date.dateLine} · {date.timeLine}</div>}
          {event?.where && <div className="ev-fact-sub">{event.where}</div>}
        </div>
        <span className={`oc-status oc-${order.status}`}>{status.title}</span>
      </header>
      <p className="oc-note">{status.body}</p>
      <ul className="oc-list">
        {order.tickets.map((tk) => (
          <li key={tk.code} className="oc-ticket">
            {showQr && tk.status === "confirmed" && (
              <div className="oc-qr" aria-hidden="true" dangerouslySetInnerHTML={{ __html: qrSvg(`${origin}/t/${tk.code}`) }} />
            )}
            <div className="oc-ticket-text">
              <b>{tk.displayName}</b>
              <div className="ev-fact-sub">
                {tk.ticketType}{tk.number && total > 1 ? ` · ${t("ticketNumber", { number: tk.number, total })}` : ""}{tk.checkedInAt ? ` · ${t("checkedIn")}` : ""}
              </div>
            </div>
            <Link className="btn-small" href={`/t/${tk.code}`}>{t("openTicket")}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
