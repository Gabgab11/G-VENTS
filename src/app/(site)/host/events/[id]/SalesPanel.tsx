import { getTranslations } from "next-intl/server";
import type { components } from "@/lib/api/schema";
import { feeChoiceKey, type FeeChoice } from "@/lib/payment-text";
import { getFormat } from "@/i18n/format-server";
import { Banner, Card, CardHeader, Stat } from "@/design";
import styles from "./workspace.module.css";

type Sales = components["schemas"]["EventSalesDto"];
type Dispute = components["schemas"]["EventDisputeDto"];

// Paid ticket sales for the event (M5 SalesPanel), per currency, from the API's ledger.
export async function SalesPanel({ sales, feeChoice }: { sales: Sales; feeChoice: FeeChoice }) {
  const [t, root, format] = await Promise.all([getTranslations("dashboard.sales"), getTranslations(), getFormat()]);
  return (
    <Card as="section" aria-labelledby="sales-title">
      <CardHeader title={<span id="sales-title">{t("title")}</span>} action={<span className={styles.muted}>{root(feeChoiceKey(feeChoice).labelKey)}</span>} />
      {sales.currencies.length === 0 && <p className={styles.muted}>{t("none")}</p>}
      {sales.currencies.map((c) => {
        const f = (n: number) => format.money(n, c.currency);
        const minus = (n: number) => t("minus", { amount: f(n) });
        return (
          <div className={styles.section} key={c.currency}>
            <div className={styles.stats}>
              <Stat label={t("ticketsSold")} value={c.ticketsSold} />
              <Stat label={t("received")} value={f(c.netMinor)} />
            </div>
            <dl className={styles.ledger}>
              <dt>{t("guestsPaid", { count: c.ordersPaid })}</dt><dd>{f(c.grossMinor)}</dd>
              <dt>{t("fees")}</dt><dd>{minus(c.feesMinor)}</dd>
              {c.vatMinor > 0 && <><dt>{t("vat")}</dt><dd>{minus(c.vatMinor)}</dd></>}
              <dt>{t("paystack")}</dt><dd>{minus(c.providerChargesMinor)}</dd>
              {c.debtRecoveredMinor > 0 && <><dt>{t("debtRecovered")}</dt><dd>{minus(c.debtRecoveredMinor)}</dd></>}
              <dt className={styles.total}>{t("received")}</dt><dd className={styles.total}>{f(c.netMinor)}</dd>
              {c.refundsMinor > 0 && <><dt>{t("refunded")}</dt><dd>{f(c.refundsMinor)}</dd></>}
              {c.debtMinor > 0 && <><dt>{t("owed")}</dt><dd>{f(c.debtMinor)}</dd></>}
            </dl>
          </div>
        );
      })}
      {sales.refundsPending > 0 && <p className={styles.muted}>{t("refundsPending", { count: sales.refundsPending })}</p>}
      {sales.refundsFailed > 0 && <Banner tone="warning" title={t("refundsFailed", { count: sales.refundsFailed })} />}
      <p className={styles.muted}>{t("shareNote")}</p>
    </Card>
  );
}

// Open chargebacks on the event's orders (M5 DisputeBanner, DS1–DS3).
export async function DisputeBanner({ disputes }: { disputes: Dispute[] }) {
  const open = disputes.filter((d) => d.status === "open");
  if (open.length === 0) return null;
  const [t, format] = await Promise.all([getTranslations("dashboard.disputes"), getFormat()]);
  const total = new Map<string, number>();
  for (const d of open) total.set(d.currency, (total.get(d.currency) ?? 0) + d.amountMinor);
  return (
    <Banner tone="danger" aria-labelledby="disputes-title"
      title={<span id="disputes-title">{t("title", { count: open.length })} ({[...total].map(([c, n]) => format.money(n, c)).join(" · ")})</span>}>
      {t("body")}
    </Banner>
  );
}
