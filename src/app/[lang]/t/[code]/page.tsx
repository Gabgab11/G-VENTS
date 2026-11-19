import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { timezoneLabel } from "@/lib/dates";
import { intlLocale, safeZone } from "@/lib/format";
import type { Locale } from "@/i18n/languages";
import { qrSvg } from "@/lib/qr";
import { displayCode, getTicket, isTicketCode, ticketDate, ticketTime, type Ticket } from "@/lib/ticket";
import { checkInFromTicket } from "./actions";
import PrintButton from "./PrintButton";
import WhatsAppDelivery from "./WhatsAppDelivery";
import EmailDelivery from "./EmailDelivery";
import { TICKET_CSS } from "./ticket-css";
import { pageFonts } from "@/app/fonts";
import SiteHeader from "@/components/SiteHeader";

// One API call per request, shared by the metadata and the page.
const loadTicket = cache(getTicket);

// Tickets are private to whoever holds the link. An unknown code is a real 404: the metadata resolves
// before the page streams.
export async function generateMetadata({ params }: { params: Promise<{ lang: string; code: string }> }) {
  const { lang, code } = await params;
  setRequestLocale(lang);
  if (!(await loadTicket(code.toLowerCase()))) notFound();
  const t = await getTranslations("tickets.ticket");
  // Tickets are private: no index, and no link preview (the site card would otherwise be inherited).
  return { title: t("meta.title"), robots: { index: false, follow: false }, openGraph: null, twitter: null };
}

/** A message id under tickets.ticket.status, with its tone. */
function statusNote(t: Ticket): { tone: "warn" | "ok" | ""; id: string } | null {
  if (t.event.status === "cancelled") return { tone: "warn", id: "eventCancelled" };
  switch (t.status) {
    case "pending":
      return { tone: "", id: "pending" };
    case "waitlisted":
      return { tone: "", id: "waitlisted" };
    case "declined":
      return { tone: "warn", id: "declined" };
    case "cancelled":
      return { tone: "warn", id: "cancelled" };
    case "refunded":
      return { tone: "warn", id: "refunded" };
    default:
      return null;
  }
}

/** What the door check-in redirect reports (the API's scan reasons): message ids under tickets.ticket.checkIn. */
const CHECK_IN: Record<string, { tone: "ok" | "warn"; id: string }> = {
  checked_in: { tone: "ok", id: "checkedIn" },
  already_used: { tone: "warn", id: "alreadyUsed" },
  not_confirmed: { tone: "warn", id: "notConfirmed" },
  waitlisted: { tone: "warn", id: "waitlisted" },
  cancelled: { tone: "warn", id: "cancelled" },
  refunded: { tone: "warn", id: "refunded" },
  failed: { tone: "warn", id: "failed" },
};

/** The ticket's date and times in the page's language; English keeps ticketDate/ticketTime exactly. */
function dateFormatter(lang: Locale, timeZone: string) {
  const local = (iso: string, o: Intl.DateTimeFormatOptions) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(intlLocale(lang, "date"), { ...o, timeZone: safeZone(timeZone) });
  };
  return {
    date: (iso: string) => (lang === "en" ? ticketDate(iso, timeZone) : local(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" })),
    time: (iso: string) => (lang === "en" ? ticketTime(iso, timeZone) : local(iso, { hour: "2-digit", minute: "2-digit" })),
  };
}

export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; code: string }>;
  searchParams: Promise<{ checkin?: string; email?: string }>;
}) {
  const { lang, code: rawCode } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("tickets.ticket");
  const { checkin, email: emailState } = await searchParams;
  const code = rawCode.toLowerCase();
  if (!isTicketCode(code)) notFound();

  const ticket = await loadTicket(code);
  if (!ticket) notFound();

  const { event } = ticket;
  const noteId = statusNote(ticket);
  const note = noteId ? { tone: noteId.tone, title: t(`status.${noteId.id}.title`), body: t(`status.${noteId.id}.body`) } : null;
  const checkInId = checkin ? CHECK_IN[checkin] ?? CHECK_IN.failed! : null;
  const checkInNote = checkInId ? { tone: checkInId.tone, title: t(`checkIn.${checkInId.id}.title`), body: t(`checkIn.${checkInId.id}.body`) } : null;
  const valid = ticket.status === "confirmed" && event.status !== "cancelled";
  const qr = valid ? qrSvg(ticket.qrPayload) : null;
  const tz = event.timeZone;
  const { date: ticketDateIn, time: ticketTimeIn } = dateFormatter(lang as Locale, tz);
  const start = event.startsAt ?? `${event.startsAtLocal}:00Z`;
  const endTime = event.endsAt ? ticketTimeIn(event.endsAt) : null;
  const checkedInAt = ticket.checkedInAt ? ticketTimeIn(ticket.checkedInAt) : null;
  const ofTotal = ticket.number && ticket.total && ticket.total > 1 ? ` · ${t("ofTotal", { number: ticket.number, total: ticket.total })}` : "";

  return (
    <main className={`tk ${pageFonts}`}>
      <style dangerouslySetInnerHTML={{ __html: TICKET_CSS }} />

      <SiteHeader back="/my-tickets" />

      {checkInNote && (
        <div className={`tk-note ${checkInNote.tone}`} role={checkInNote.tone === "ok" ? "status" : "alert"}><b>{checkInNote.title}</b>{checkInNote.body}</div>
      )}
      {note && (
        <div className={`tk-note ${note.tone}`} role="status"><b>{note.title}</b>{note.body}</div>
      )}

      <article className="tk-ticket" aria-label={t("ticketFor", { title: event.title })}>
        <div className="tk-main">
          <div className="tk-band">
            <div className="tk-band-row">
              <span className="tk-brand">G-vent<b>Z</b></span>
              <span className="tk-admit">{t("admitOne")}</span>
            </div>
            <h1 className="tk-title">{event.title}</h1>
          </div>

          <div className="tk-details">
            <div className="tk-field">
              <div className="tk-label">{t("date")}</div>
              <div className="tk-value">{ticketDateIn(start)}</div>
            </div>
            <div className="tk-field">
              <div className="tk-label">{t("time")}</div>
              <div className="tk-value">
                {ticketTimeIn(start)}{endTime ? ` – ${endTime}` : ""}
                <span className="tk-small"> ({timezoneLabel(tz)})</span>
              </div>
            </div>
            <div className="tk-field">
              <div className="tk-label">{t("ticket")}</div>
              <div className="tk-value">{ticket.ticketType} · {t("free")}{ofTotal}</div>
            </div>
            <div className="tk-field wide">
              <div className="tk-label">{t("where")}</div>
              <div className="tk-value">{event.where}</div>
            </div>
            <div className="tk-field wide">
              <div className="tk-label">{t("guest")}</div>
              <div className="tk-value big">{ticket.displayName}</div>
            </div>
          </div>
        </div>

        <div className="tk-stub">
          {qr ? (
            <div className="tk-qr" dangerouslySetInnerHTML={{ __html: qr }} />
          ) : (
            <div className="tk-void">{ticket.status === "confirmed" ? t("notValid") : t("noQr")}</div>
          )}
          <div className="tk-code">{displayCode(ticket.code)}</div>
          <div className="tk-hint">{valid ? t("hintValid") : t("hintPending")}</div>
          {checkedInAt && (
            <div className="tk-stamp">{t("stamp")}<small>{t("stampAt", { time: checkedInAt })}</small></div>
          )}
        </div>
      </article>

      <div className="tk-actions">
        {valid && <PrintButton />}
        <Link href={`/e/${event.slug}`} className="tk-btn tk-ghost">{t("eventPage")}</Link>
      </div>

      {ticket.email && (
        <EmailDelivery code={ticket.code} maskedEmail={ticket.email.masked} last={{ status: ticket.email.lastStatus }} state={emailState} />
      )}

      {valid && process.env.NEXT_PUBLIC_WHATSAPP_NUMBER && (
        <WhatsAppDelivery
          businessNumber={process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}
          eventTitle={event.title}
          displayCode={displayCode(ticket.code)}
          ticketUrl={ticket.qrPayload}
        />
      )}

      {ticket.canCheckIn && valid && (
        <section className="tk-staff" aria-label={t("staff.label")}>
          {checkedInAt ? (
            <p>{t.rich("staff.already", { b: (c) => <b>{c}</b>, time: checkedInAt })}</p>
          ) : (
            <>
              <p>{t.rich("staff.intro", { b: (c) => <b>{c}</b> })}</p>
              <form action={checkInFromTicket}>
                <input type="hidden" name="code" value={ticket.code} />
                <input type="hidden" name="event_id" value={event.id} />
                <button type="submit" className="tk-btn tk-go">{t("staff.button", { name: ticket.displayName.split(" ")[0] ?? "" })}</button>
              </form>
            </>
          )}
        </section>
      )}

      <p className="tk-foot no-print">
        {t("foot", { name: ticket.displayName })}
      </p>
    </main>
  );
}
