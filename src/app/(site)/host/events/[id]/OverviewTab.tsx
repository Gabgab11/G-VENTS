import { getLocale, getTranslations } from "next-intl/server";
import { BarChart3 } from "lucide-react";
import { can, type EventDashboard } from "@/lib/auth";
import { api, data } from "@/lib/api/server";
import type { components } from "@/lib/api/schema";
import { formatMoney, formatRelative, intlLocale } from "@/lib/format";
import type { Locale } from "@/i18n/languages";
import { Card, CardHeader, EmptyState, Stat } from "@/design";
import CopyLink from "./CopyLink";
import { SalesPanel } from "./SalesPanel";
import { dayBars, dayLabel } from "./overview-data";
import styles from "./workspace.module.css";

type Sales = components["schemas"]["EventSalesDto"];
type Settlements = components["schemas"]["EventSettlementsDto"];
/** GET /v1/host/orders item (new in chunk 3; read raw until schema.d.ts has it). */
type HostOrder = components["schemas"]["HostOrderDto"];

/** Sales per day (settlements `days`), for roles that may see sales; null when unavailable. */
async function loadSettlements(event: EventDashboard): Promise<Settlements | null> {
  try {
    return data(await (await api()).GET("/v1/events/{id}/settlements", { params: { path: { id: event.id } } }));
  } catch (error) {
    console.error(`[host/events] settlements: ${(error as Error).message}`);
    return null;
  }
}

/** The event's latest orders (GET /v1/host/orders?eventId=); fails soft. */
async function loadOrders(event: EventDashboard): Promise<HostOrder[] | null> {
  try {
    const page = data(await (await api()).GET("/v1/host/orders", { params: { query: { eventId: event.id, pageSize: 5 } } }));
    return page.items;
  } catch {
    return null;
  }
}

// Overview: the headline numbers, sales by day, recent orders, the paid-sales ledger and the link.
export default async function OverviewTab({ event, url, sales }: { event: EventDashboard; url: string; sales: Sales | null }) {
  const { counts } = event;
  const salesView = can(event, "sales.view");
  const [t, lang, settlements, orders] = await Promise.all([
    getTranslations("dashboard.overview"),
    getLocale() as Promise<Locale>,
    sales && salesView ? loadSettlements(event) : Promise.resolve(null),
    can(event, "orders.view") ? loadOrders(event) : Promise.resolve(null),
  ]);
  const n = (x: number) => x.toLocaleString(lang);
  const days = settlements ? dayBars(settlements.days) : [];
  const gross = sales?.currencies.filter((c) => c.grossMinor > 0 || c.ordersPaid > 0) ?? [];

  return (
    <div className={styles.stack}>
      <section aria-label={t("statsLabel")} className={styles.stats}>
        <Stat label={t("sold")} value={event.capacity === null ? n(counts.confirmed) : t("soldOf", { sold: n(counts.confirmed), capacity: n(event.capacity) })}
          context={t("soldContext", { pending: counts.pending, waitlisted: counts.waitlisted })} />
        {sales && (
          gross.length === 0
              ? <Stat label={t("gross")} value={formatMoney(0, sales.currencies[0]?.currency ?? event.ticketTypes[0]?.currency ?? "NGN", lang, true)} context={t("noSales")} />
              : gross.map((c) => <Stat key={c.currency} label={gross.length > 1 ? `${t("gross")} · ${c.currency}` : t("gross")} value={formatMoney(c.grossMinor, c.currency, lang, true)} context={t("grossContext", { count: c.ordersPaid })} />)
        )}
        <Stat label={t("checkedIn")} value={n(counts.checkedIn)} context={t("checkedInContext", { confirmed: counts.confirmed })} />
      </section>

      {sales && salesView && (
        <Card as="section" aria-labelledby="sales-days">
          <CardHeader title={<span id="sales-days">{t("byDay")}</span>} />
          {days.length === 0 ? (
            <EmptyState icon={<BarChart3 size={20} strokeWidth={1.75} aria-hidden />} title={t("byDayNone")} />
          ) : days.map((group) => (
            <div key={group.currency} className={styles.section}>
              {days.length > 1 && <h3 className={styles.currency}>{group.currency}</h3>}
              <ul className={styles.bars}>
                {group.days.map((d) => (
                  <li key={d.date} className={styles.bar}>
                    <span className={styles.barDay}>{dayLabel(d.date, intlLocale(lang, "date"))}</span>
                    <span className={styles.barTrack} aria-hidden><span className={styles.barFill} style={{ inlineSize: `${Math.max(d.share, 2)}%` }} /></span>
                    <span className={styles.barValue}>
                      {formatMoney(d.grossMinor, d.currency, lang, true)}
                      <small>{t("orders", { count: d.orders })}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      )}

      {orders && orders.length > 0 && (
        <Card as="section">
          <CardHeader title={t("recentOrders")} />
          <ul className={styles.rows}>
            {orders.map((o) => (
              <li key={o.id} className={styles.listRow}>
                <span className={styles.listMain}>
                  <strong>{o.buyerName ?? t("guest")}</strong>
                  <span className={styles.muted}>{t("tickets", { count: o.tickets })}</span>
                </span>
                <span className={styles.listMain}>
                  <strong>{o.kind === "free" ? t("free") : formatMoney(o.amountMinor, o.currency, lang, true)}</strong>
                  <span className={styles.muted}>{formatRelative(o.createdAt, new Date(), lang)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {sales && <SalesPanel sales={sales} feeChoice={event.feeChoice} />}

      <Card as="section">
        <CardHeader title={t("shareTitle")} />
        <p className={styles.muted}>{t("shareHint")}</p>
        <CopyLink url={url} />
      </Card>
    </div>
  );
}
