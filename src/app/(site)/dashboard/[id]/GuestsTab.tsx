import Link from "next/link";
import { api, data } from "@/lib/api/server";
import { can, type EventDashboard } from "@/lib/auth";
import type { components } from "@/lib/api/schema";
import { approveOrder, checkInGuest, declineOrder, promoteFromWaitlist, refundTicket } from "./actions";
import { refundStatusKey } from "@/lib/payment-text";
import { getTranslations } from "next-intl/server";
import { getFormat } from "@/i18n/format-server";

type GuestRow = components["schemas"]["GuestRowResponse"];

export type GuestQuery = { q?: string; status?: string; type?: string; sort?: string; page?: string };

const STATUSES = ["confirmed", "pending", "waitlisted", "declined", "cancelled", "refunded", "checked_in", "not_checked_in"] as const;

// The guest list (US-7.3, I2, I3, I4) from gventz-api: one row per ticket, search, filters, totals.
// Pending requests are grouped by order so the host approves or declines a group at once.
export default async function GuestsTab({ event, query }: { event: EventDashboard; query: GuestQuery }) {
  const id = event.id;
  const [t, root, format] = await Promise.all([getTranslations("dashboard"), getTranslations(), getFormat()]);
  const statusLabel = (s: string) => ((STATUSES as readonly string[]).includes(s) ? t(`guests.status.${s}`) : s);
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const status = STATUSES.find((s) => s === query.status);
  const ticketTypeId = event.ticketTypes.find((t) => t.id === query.type)?.id;
  const q = (query.q ?? "").trim().slice(0, 120);
  const sort = query.sort === "checked_in" ? "checked_in" : "registered";

  const list = data(
    await (await api()).GET("/v1/events/{id}/guests", {
      params: { path: { id }, query: { page, pageSize: 50, sort, ...(status ? { status } : {}), ...(ticketTypeId ? { ticketTypeId } : {}), ...(q ? { q } : {}) } },
    }),
  );
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const href = (overrides: Partial<GuestQuery>) => {
    const params = new URLSearchParams({ tab: "guests" });
    const merged = { q, status, type: ticketTypeId, sort: sort === "checked_in" ? "checked_in" : undefined, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
    return `/dashboard/${id}?${params}`;
  };

  const approve = can(event, "orders.approve");
  const promote = can(event, "waitlist.promote");
  const checkIn = can(event, "guests.checkIn");
  const refund = can(event, "orders.refund");
  const currencyOf = (ticketTypeId: string) => event.ticketTypes.find((t) => t.id === ticketTypeId)?.currency ?? "NGN";
  const pendingGroups = groupPending(list.items);
  const refundLabel = (status: string) => {
    const key = refundStatusKey(status);
    return key ? root(key) : undefined;
  };

  return (
    <div className="stack">
      <div className="spread">
        <p className="muted small">
          {t("guests.counts", { confirmed: list.counts.confirmed, pending: list.counts.pending, waitlist: list.waitlistCount, checkedIn: list.counts.checkedIn })}
        </p>
        <span className="row-form">
          {promote && list.waitlistCount > 0 && (
            <form action={promoteFromWaitlist}>
              <input type="hidden" name="event_id" value={id} />
              <button className="btn-small" type="submit">{t("guests.promote")}</button>
            </form>
          )}
          {can(event, "guests.export") && <a className="btn-small" href={`/dashboard/${id}/guests.csv`}>{t("guests.export")}</a>}
        </span>
      </div>

      <form className="row-form" action={`/dashboard/${id}`} method="get" role="search">
        <input type="hidden" name="tab" value="guests" />
        <input className="input" name="q" defaultValue={q} placeholder={t("guests.searchPlaceholder")} aria-label={t("guests.searchLabel")} />
        <select className="input" name="status" defaultValue={status ?? ""} aria-label={t("guests.statusLabel")}>
          <option value="">{t("guests.everyone")}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
        {event.ticketTypes.length > 1 && (
          <select className="input" name="type" defaultValue={ticketTypeId ?? ""} aria-label={t("guests.ticketTypeLabel")}>
            <option value="">{t("guests.allTickets")}</option>
            {event.ticketTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <select className="input" name="sort" defaultValue={sort} aria-label={t("guests.sortLabel")}>
          <option value="registered">{t("guests.newest")}</option>
          <option value="checked_in">{t("guests.recentlyCheckedIn")}</option>
        </select>
        <button className="btn-small" type="submit">{t("guests.show")}</button>
      </form>

      {approve && pendingGroups.length > 0 && (
        <section className="panel">
          <div className="panel-label">{t("guests.requests")}</div>
          {pendingGroups.map((g) => (
            <div className="guest-row" key={g.orderId}>
              <div className="guest-main">
                <b>{g.buyerName}</b>
                <div className="muted small">{g.buyerEmail} · {t("guests.tickets", { count: g.tickets })}</div>
                {g.answers.map((a) => <div className="muted small" key={a.questionId}>{a.label}: {a.value}</div>)}
              </div>
              <div className="guest-side">
                <form action={approveOrder}>
                  <input type="hidden" name="event_id" value={id} />
                  <input type="hidden" name="order_id" value={g.orderId} />
                  <button className="btn-small" type="submit">{t("guests.approve")}</button>
                </form>
                <form action={declineOrder} className="row-form">
                  <input type="hidden" name="event_id" value={id} />
                  <input type="hidden" name="order_id" value={g.orderId} />
                  <input className="input" name="message" maxLength={500} placeholder={t("guests.messagePlaceholder")} aria-label={t("guests.messageTo", { name: g.buyerName })} />
                  <button className="link-btn" type="submit">{t("guests.decline")}</button>
                </form>
              </div>
            </div>
          ))}
        </section>
      )}

      {list.items.length === 0 && <p className="muted">{t(q || status || ticketTypeId ? "guests.noMatch" : "guests.empty")}</p>}

      {list.items.map((r) => (
        <div className="guest-row" key={r.ticketId}>
          <div className="guest-main">
            <b>{r.displayName}</b>
            <div className="muted small">
              {r.buyerEmail} · {r.ticketType}{r.number && r.total && r.total > 1 ? ` · ${t("guests.ticketNumber", { number: r.number, total: r.total })}` : ""}
              {r.displayName !== r.buyerName ? ` · ${t("guests.bookedBy", { name: r.buyerName })}` : ""}
            </div>
            {r.answers.map((a) => <div className="muted small" key={a.questionId}>{a.label}: {a.value}</div>)}
          </div>
          <div className="guest-side">
            <span className={`tag tag-${r.status}`}>{statusLabel(r.status)}</span>
            {checkIn && r.status === "confirmed" && !r.checkedInAt && (
              <form action={checkInGuest}>
                <input type="hidden" name="event_id" value={id} />
                <input type="hidden" name="ticket_id" value={r.ticketId} />
                <button className="btn-small" type="submit" aria-label={t("guests.checkInLabel", { name: r.displayName })}>{t("guests.checkIn")}</button>
              </form>
            )}
            {r.checkedInAt && <span className="muted small">{t("guests.checkedIn")}</span>}
            {r.disputed && <span className="tag tag-cancelled">{t("guests.disputed")}</span>}
            {r.refundStatus && <span className={`tag ${r.refundStatus === "failed" ? "tag-cancelled" : r.refundStatus === "refunded" ? "" : "tag-waitlisted"}`}>{refundLabel(r.refundStatus)}</span>}
            {refund && r.paid && r.status === "confirmed" && r.refundableMinor !== null && r.refundableMinor > 0 && (!r.refundStatus || r.refundStatus === "failed") && (
              <RefundAction eventId={id} ticketId={r.ticketId} name={r.displayName} amount={format.money(r.refundableMinor, currencyOf(r.ticketTypeId))} />
            )}
          </div>
        </div>
      ))}

      {pages > 1 && (
        <nav className="spread" aria-label={t("guests.pagesLabel")}>
          {page > 1 ? <Link href={href({ page: String(page - 1) })} className="btn-small">{t("pagination.previous")}</Link> : <span />}
          <span className="muted small">{t("pagination.page", { page, pages })}</span>
          {page < pages ? <Link href={href({ page: String(page + 1) })} className="btn-small">{t("pagination.next")}</Link> : <span />}
        </nav>
      )}
    </div>
  );
}

type PendingGroup = { orderId: string; buyerName: string; buyerEmail: string; tickets: number; answers: GuestRow["answers"] };

/** Pending tickets of this page, one entry per order (tickets from before go-live have no order and can't be approved here). */
function groupPending(rows: GuestRow[]): PendingGroup[] {
  const groups = new Map<string, PendingGroup>();
  for (const r of rows) {
    if (r.status !== "pending" || !r.orderId) continue;
    const g = groups.get(r.orderId) ?? { orderId: r.orderId, buyerName: r.buyerName, buyerEmail: r.buyerEmail, tickets: 0, answers: r.answers };
    g.tickets++;
    groups.set(r.orderId, g);
  }
  return [...groups.values()];
}

/**
 * One paid ticket's refund (M5 RefundAction, RF4/RF5): the host confirms with the amount the guest
 * gets back; two-step sign-in is asked for by the action when needed.
 */
async function RefundAction({ eventId, ticketId, name, amount }: { eventId: string; ticketId: string; name: string; amount: string }) {
  const t = await getTranslations("dashboard.guests.refund");
  return (
    <details className="pay-refund">
      <summary>{t("summary")}</summary>
      <form action={refundTicket} className="stack pay-refund-body">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="ticket_id" value={ticketId} />
        <p className="small">{t.rich("body", { name, amount, b: (c) => <b>{c}</b> })}</p>
        <label className="check"><input type="checkbox" name="confirm" value="yes" required /> <span>{t("confirm", { amount, name })}</span></label>
        <button className="btn-small" type="submit">{t("button")}</button>
      </form>
    </details>
  );
}
