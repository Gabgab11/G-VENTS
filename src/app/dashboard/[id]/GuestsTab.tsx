import Link from "next/link";
import { api, data } from "@/lib/api/server";
import { can, type EventDashboard } from "@/lib/auth";
import type { components } from "@/lib/api/schema";
import { approveOrder, checkInGuest, declineOrder, promoteFromWaitlist } from "./actions";

type GuestRow = components["schemas"]["GuestRowResponse"];

export type GuestQuery = { q?: string; status?: string; type?: string; sort?: string; page?: string };

const STATUSES = ["confirmed", "pending", "waitlisted", "declined", "cancelled", "refunded", "checked_in", "not_checked_in"] as const;
const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed", pending: "Waiting for approval", waitlisted: "Waiting list", declined: "Declined",
  cancelled: "Cancelled", refunded: "Refunded", checked_in: "Checked in", not_checked_in: "Not checked in",
};

// The guest list (US-7.3, I2, I3, I4) from gventz-api: one row per ticket, search, filters, totals.
// Pending requests are grouped by order so the host approves or declines a group at once.
export default async function GuestsTab({ event, query }: { event: EventDashboard; query: GuestQuery }) {
  const id = event.id;
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
  const pendingGroups = groupPending(list.items);

  return (
    <div className="stack">
      <div className="spread">
        <p className="muted small">
          {list.counts.confirmed} confirmed · {list.counts.pending} waiting for approval · {list.waitlistCount} on the waiting list · {list.counts.checkedIn} checked in
        </p>
        <span className="row-form">
          {promote && list.waitlistCount > 0 && (
            <form action={promoteFromWaitlist}>
              <input type="hidden" name="event_id" value={id} />
              <button className="btn-small" type="submit">Give the next waiting group tickets</button>
            </form>
          )}
          {can(event, "guests.export") && <a className="btn-small" href={`/dashboard/${id}/guests.csv`}>Export CSV</a>}
        </span>
      </div>

      <form className="row-form" action={`/dashboard/${id}`} method="get" role="search">
        <input type="hidden" name="tab" value="guests" />
        <input className="input" name="q" defaultValue={q} placeholder="Name, email, @company.com or ticket code" aria-label="Search guests" />
        <select className="input" name="status" defaultValue={status ?? ""} aria-label="Status">
          <option value="">Everyone</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        {event.ticketTypes.length > 1 && (
          <select className="input" name="type" defaultValue={ticketTypeId ?? ""} aria-label="Ticket type">
            <option value="">All tickets</option>
            {event.ticketTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <select className="input" name="sort" defaultValue={sort} aria-label="Sort">
          <option value="registered">Newest first</option>
          <option value="checked_in">Recently checked in</option>
        </select>
        <button className="btn-small" type="submit">Show</button>
      </form>

      {approve && pendingGroups.length > 0 && (
        <section className="panel">
          <div className="panel-label">Requests waiting for you</div>
          {pendingGroups.map((g) => (
            <div className="guest-row" key={g.orderId}>
              <div className="guest-main">
                <b>{g.buyerName}</b>
                <div className="muted small">{g.buyerEmail} · {g.tickets} {g.tickets === 1 ? "ticket" : "tickets"}</div>
                {g.answers.map((a) => <div className="muted small" key={a.questionId}>{a.label}: {a.value}</div>)}
              </div>
              <div className="guest-side">
                <form action={approveOrder}>
                  <input type="hidden" name="event_id" value={id} />
                  <input type="hidden" name="order_id" value={g.orderId} />
                  <button className="btn-small" type="submit">Approve</button>
                </form>
                <form action={declineOrder} className="row-form">
                  <input type="hidden" name="event_id" value={id} />
                  <input type="hidden" name="order_id" value={g.orderId} />
                  <input className="input" name="message" maxLength={500} placeholder="Message (optional)" aria-label={`Message to ${g.buyerName}`} />
                  <button className="link-btn" type="submit">Decline</button>
                </form>
              </div>
            </div>
          ))}
        </section>
      )}

      {list.items.length === 0 && <p className="muted">{q || status || ticketTypeId ? "No guests match." : "No guests yet. Share the link to get guests."}</p>}

      {list.items.map((r) => (
        <div className="guest-row" key={r.ticketId}>
          <div className="guest-main">
            <b>{r.displayName}</b>
            <div className="muted small">
              {r.buyerEmail} · {r.ticketType}{r.number && r.total && r.total > 1 ? ` · ${r.number} of ${r.total}` : ""}
              {r.displayName !== r.buyerName ? ` · booked by ${r.buyerName}` : ""}
            </div>
            {r.answers.map((a) => <div className="muted small" key={a.questionId}>{a.label}: {a.value}</div>)}
          </div>
          <div className="guest-side">
            <span className={`tag tag-${r.status}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
            {checkIn && r.status === "confirmed" && !r.checkedInAt && (
              <form action={checkInGuest}>
                <input type="hidden" name="event_id" value={id} />
                <input type="hidden" name="ticket_id" value={r.ticketId} />
                <button className="btn-small" type="submit" aria-label={`Check in ${r.displayName}`}>Check in</button>
              </form>
            )}
            {r.checkedInAt && <span className="muted small">Checked in</span>}
          </div>
        </div>
      ))}

      {pages > 1 && (
        <nav className="spread" aria-label="Guest list pages">
          {page > 1 ? <Link href={href({ page: String(page - 1) })} className="btn-small">← Previous</Link> : <span />}
          <span className="muted small">Page {page} of {pages}</span>
          {page < pages ? <Link href={href({ page: String(page + 1) })} className="btn-small">Next →</Link> : <span />}
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
