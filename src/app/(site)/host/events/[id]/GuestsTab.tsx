import { api, data } from "@/lib/api/server";
import { can, type EventDashboard } from "@/lib/auth";
import type { components } from "@/lib/api/schema";
import { approveOrder, checkInGuest, declineOrder, promoteFromWaitlist } from "./actions";
import { refundStatusKey } from "@/lib/payment-text";
import { getTranslations } from "next-intl/server";
import { getFormat } from "@/i18n/format-server";
import { Download, Users } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Input, Select, Table, Td, Th, type BadgeTone } from "@/design";
import { ToastProvider } from "@/design/client";
import { mfaState } from "@/lib/mfa";
import RefundDialog from "./RefundDialog";
import { canRefundRow, initialRefundView } from "./refund-dialog";
import styles from "./workspace.module.css";

type GuestRow = components["schemas"]["GuestRowResponse"];

export type GuestQuery = { q?: string; status?: string; type?: string; sort?: string; page?: string; refund?: string };

const STATUSES = ["confirmed", "pending", "waitlisted", "declined", "cancelled", "refunded", "checked_in", "not_checked_in"] as const;

/** A ticket or refund status as a badge tone (never colour alone: the badge keeps its word). */
function toneOf(status: string): BadgeTone {
  if (["confirmed", "refunded", "ok", "approved", "completed"].includes(status)) return "success";
  if (["pending", "waitlisted", "queued", "processing", "submitted", "pending_approval"].includes(status)) return "warning";
  if (["declined", "cancelled", "failed", "revoked"].includes(status)) return "danger";
  return "neutral";
}

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
    return `/host/events/${id}?${params}`;
  };

  const approve = can(event, "orders.approve");
  const promote = can(event, "waitlist.promote");
  const checkIn = can(event, "guests.checkIn");
  const refund = can(event, "orders.refund");
  const currencyOf = (ticketTypeId: string) => event.ticketTypes.find((t) => t.id === ticketTypeId)?.currency ?? "NGN";
  const pendingGroups = groupPending(list.items);
  // Refunds need two-step sign-in (the API answers auth.mfa_required until then): ask only when a row offers one.
  const refundable = refund && list.items.some(canRefundRow);
  const refundStart = refundable ? initialRefundView(await mfaState().then((m) => m.level).catch(() => null)) : "two_step";
  const refundLabel = (status: string) => {
    const key = refundStatusKey(status);
    return key ? root(key) : undefined;
  };

  const filtered = Boolean(q || status || ticketTypeId);
  // The buyer's phone and gender (4b) come only to roles that can see guests' contact details.
  const contact = can(event, "guests.export") || list.items.some((r) => r.buyerPhone || r.buyerGender);
  const genderLabel = (g: GuestRow["buyerGender"]) => (g ? t(`guests.gender.${g}`) : null);

  return (
    <ToastProvider closeLabel={t("tools.close")}>
    <div className={styles.stack}>
      <div className={styles.listRow}>
        <p className={styles.muted}>
          {t("guests.counts", { confirmed: list.counts.confirmed, pending: list.counts.pending, waitlist: list.waitlistCount, checkedIn: list.counts.checkedIn })}
        </p>
        <span className={styles.listSide}>
          {promote && list.waitlistCount > 0 && (
            <form action={promoteFromWaitlist}>
              <input type="hidden" name="event_id" value={id} />
              <Button size="sm" type="submit">{t("guests.promote")}</Button>
            </form>
          )}
          {can(event, "guests.export") && <Button size="sm" variant="secondary" href={`/host/events/${id}/guests.csv`}><Download size={16} strokeWidth={1.75} aria-hidden />{t("guests.export")}</Button>}
        </span>
      </div>

      <form className={styles.rowForm} action={`/host/events/${id}`} method="get" role="search">
        <input type="hidden" name="tab" value="guests" />
        <Input name="q" defaultValue={q} placeholder={t("guests.searchPlaceholder")} aria-label={t("guests.searchLabel")} />
        <Select name="status" defaultValue={status ?? ""} aria-label={t("guests.statusLabel")}>
          <option value="">{t("guests.everyone")}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </Select>
        {event.ticketTypes.length > 1 && (
          <Select name="type" defaultValue={ticketTypeId ?? ""} aria-label={t("guests.ticketTypeLabel")}>
            <option value="">{t("guests.allTickets")}</option>
            {event.ticketTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        )}
        <Select name="sort" defaultValue={sort} aria-label={t("guests.sortLabel")}>
          <option value="registered">{t("guests.newest")}</option>
          <option value="checked_in">{t("guests.recentlyCheckedIn")}</option>
        </Select>
        <Button size="sm" type="submit">{t("guests.show")}</Button>
      </form>

      {approve && pendingGroups.length > 0 && (
        <Card as="section">
          <CardHeader title={t("guests.requests")} />
          <ul className={styles.rows}>
            {pendingGroups.map((g) => (
              <li className={styles.listRow} key={g.orderId}>
                <div className={styles.listMain}>
                  <strong>{g.buyerName}</strong>
                  <span className={styles.muted}>{g.buyerEmail} · {t("guests.tickets", { count: g.tickets })}</span>
                  {g.answers.map((a) => <span className={styles.muted} key={a.questionId}>{a.label}: {a.value}</span>)}
                </div>
                <div className={styles.listSide}>
                  <form action={approveOrder}>
                    <input type="hidden" name="event_id" value={id} />
                    <input type="hidden" name="order_id" value={g.orderId} />
                    <Button size="sm" variant="primary" type="submit">{t("guests.approve")}</Button>
                  </form>
                  <form action={declineOrder} className={styles.rowForm}>
                    <input type="hidden" name="event_id" value={id} />
                    <input type="hidden" name="order_id" value={g.orderId} />
                    <Input name="message" maxLength={500} placeholder={t("guests.messagePlaceholder")} aria-label={t("guests.messageTo", { name: g.buyerName })} />
                    <Button size="sm" variant="ghost" type="submit">{t("guests.decline")}</Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {list.items.length === 0 ? (
        <Card>
          <EmptyState icon={<Users size={20} strokeWidth={1.75} aria-hidden />} title={t(filtered ? "guests.noMatch" : "guests.empty")} />
        </Card>
      ) : (
        <Table caption={<span className="sr-only">{t("guests.tableCaption")}</span>}>
          <thead>
            <tr>
              <Th>{t("guests.colGuest")}</Th>
              <Th>{t("guests.colTicket")}</Th>
              {contact && <Th>{t("guests.colContact")}</Th>}
              <Th>{t("guests.statusLabel")}</Th>
              <Th><span className="sr-only">{t("guests.colActions")}</span></Th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((r) => (
              <tr key={r.ticketId}>
                <Td label={t("guests.colGuest")}>
                  <span className={styles.guestCell}>
                    <strong>{r.displayName}</strong>
                    <span className={styles.muted}>{r.buyerEmail}{r.displayName !== r.buyerName ? ` · ${t("guests.bookedBy", { name: r.buyerName })}` : ""}</span>
                    {r.recipientEmail && <span className={styles.muted}>{t.rich("guests.sentTo", { email: r.recipientEmail, b: (c) => <bdi>{c}</bdi> })}</span>}
                    {r.answers.map((a) => <span className={styles.muted} key={a.questionId}>{a.label}: {a.value}</span>)}
                  </span>
                </Td>
                <Td label={t("guests.colTicket")}>
                  {r.ticketType}{r.number && r.total && r.total > 1 ? ` · ${t("guests.ticketNumber", { number: r.number, total: r.total })}` : ""}
                </Td>
                {contact && (
                  <Td label={t("guests.colContact")}>
                    <span className={styles.guestCell}>
                      {r.buyerPhone ? <a href={`tel:${r.buyerPhone}`} dir="ltr">{r.buyerPhone}</a> : <span className={styles.muted}>{"—"}</span>}
                      {genderLabel(r.buyerGender) && <span className={styles.muted}>{genderLabel(r.buyerGender)}</span>}
                    </span>
                  </Td>
                )}
                <Td label={t("guests.statusLabel")}>
                  <span className={styles.badgeRow}>
                    <Badge tone={toneOf(r.status)}>{statusLabel(r.status)}</Badge>
                    {r.checkedInAt && <Badge tone="info">{t("guests.checkedIn")}</Badge>}
                    {r.disputed && <Badge tone="danger">{t("guests.disputed")}</Badge>}
                    {r.refundStatus && <Badge tone={r.refundStatus === "failed" ? "danger" : r.refundStatus === "refunded" ? "success" : "warning"}>{refundLabel(r.refundStatus)}</Badge>}
                  </span>
                </Td>
                <Td label={t("guests.colActions")}>
                  <span className={styles.badgeRow}>
                    {checkIn && r.status === "confirmed" && !r.checkedInAt && (
                      <form action={checkInGuest}>
                        <input type="hidden" name="event_id" value={id} />
                        <input type="hidden" name="ticket_id" value={r.ticketId} />
                        <Button size="sm" type="submit" aria-label={t("guests.checkInLabel", { name: r.displayName })}>{t("guests.checkIn")}</Button>
                      </form>
                    )}
                    {refund && canRefundRow(r) && (
                      <RefundDialog
                        eventId={id}
                        ticketId={r.ticketId}
                        name={r.displayName}
                        ticketType={r.ticketType}
                        amount={format.money(r.refundableMinor ?? 0, currencyOf(r.ticketTypeId))}
                        start={refundStart}
                        requested={query.refund}
                      />
                    )}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {pages > 1 && (
        <nav className={styles.pages} aria-label={t("guests.pagesLabel")}>
          {page > 1 ? <Button href={href({ page: String(page - 1) })} size="sm">{t("pagination.previous")}</Button> : <span />}
          <span className={styles.muted}>{t("pagination.page", { page, pages })}</span>
          {page < pages ? <Button href={href({ page: String(page + 1) })} size="sm">{t("pagination.next")}</Button> : <span />}
        </nav>
      )}
    </div>
    </ToastProvider>
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
