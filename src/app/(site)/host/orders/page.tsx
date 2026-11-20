import { getLocale, getTranslations } from "next-intl/server";
import { ReceiptText } from "lucide-react";
import { api, data } from "@/lib/api/server";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Locale } from "@/i18n/languages";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select, Table, Td, Th } from "@/design";
import { ORDER_STATUSES, ordersHref, ordersQuery, statusTone } from "./query";
import styles from "./orders.module.css";

// Orders & guests across the host's events (FR-31): events where the caller may see orders
// (owner, admin, finance). Filters by event and status; 25 a page; a row opens the event's guests.
export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ page?: string; event?: string; status?: string }> }) {
  const q = ordersQuery(await searchParams);
  const client = await api();
  const [orders, events, t, lang] = await Promise.all([
    client.GET("/v1/host/orders", { params: { query: { page: q.page, pageSize: 25, eventId: q.eventId, status: q.status } } }).then(data),
    client.GET("/v1/me/events", { params: { query: { page: 1, pageSize: 100 } } }).then(data),
    getTranslations("host.orders"),
    getLocale() as Promise<Locale>,
  ]);
  const pages = Math.max(1, Math.ceil(orders.total / orders.pageSize));
  const filtered = !!(q.eventId || q.status);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("lead")} />

      <form method="get" action="/host/orders" className={styles.filters}>
        <Field label={t("filter.event")}>
          <Select name="event" defaultValue={q.eventId ?? ""}>
            <option value="">{t("filter.allEvents")}</option>
            {events.items.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </Select>
        </Field>
        <Field label={t("filter.status")}>
          <Select name="status" defaultValue={q.status ?? ""}>
            <option value="">{t("filter.allStatuses")}</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </Select>
        </Field>
        <div className={styles.filterActions}>
          <Button type="submit" variant="secondary">{t("filter.apply")}</Button>
          {filtered && <Button href="/host/orders" variant="ghost">{t("filter.clear")}</Button>}
        </div>
      </form>

      <Card>
        {orders.items.length === 0 ? (
          <EmptyState icon={<ReceiptText size={20} strokeWidth={1.75} aria-hidden />} title={filtered ? t("noneFiltered") : t("none")}>{filtered ? undefined : t("noneHint")}</EmptyState>
        ) : (
          <Table caption={t("caption", { total: orders.total })}>
            <thead>
              <tr>
                <Th>{t("col.buyer")}</Th>
                <Th>{t("col.event")}</Th>
                <Th numeric>{t("col.tickets")}</Th>
                <Th numeric>{t("col.amount")}</Th>
                <Th>{t("col.status")}</Th>
                <Th>{t("col.when")}</Th>
              </tr>
            </thead>
            <tbody>
              {orders.items.map((o) => (
                <tr key={o.id}>
                  <Td label={t("col.buyer")}><a className={styles.buyer} href={`/host/events/${o.eventId}?tab=guests${o.buyerName ? `&q=${encodeURIComponent(o.buyerName.split(" ")[0])}` : ""}`}>{o.buyerName ?? t("guest")}</a></Td>
                  <Td label={t("col.event")}>{o.eventTitle}</Td>
                  <Td label={t("col.tickets")} numeric>{o.tickets}</Td>
                  <Td label={t("col.amount")} numeric>{o.kind === "free" ? t("free") : formatMoney(o.amountMinor, o.currency, lang)}</Td>
                  <Td label={t("col.status")}><Badge tone={statusTone(o.status)}>{t.has(`status.${o.status}`) ? t(`status.${o.status}`) : o.status}</Badge></Td>
                  <Td label={t("col.when")}>{formatDateTime(o.createdAt, null, lang)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {pages > 1 && (
        <nav className={styles.pager} aria-label={t("pages")}>
          {q.page > 1 ? <Button href={ordersHref({ ...q, page: q.page - 1 })} size="sm">{t("previous")}</Button> : <span />}
          <span className={styles.muted}>{t("page", { page: q.page, pages })}</span>
          {q.page < pages ? <Button href={ordersHref({ ...q, page: q.page + 1 })} size="sm">{t("next")}</Button> : <span />}
        </nav>
      )}
    </>
  );
}
