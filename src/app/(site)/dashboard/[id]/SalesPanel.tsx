import { getTranslations } from "next-intl/server";
import type { components } from "@/lib/api/schema";
import { feeChoiceKey, type FeeChoice } from "@/lib/payment-text";
import { getFormat } from "@/i18n/format-server";

type Sales = components["schemas"]["EventSalesDto"];
type Dispute = components["schemas"]["EventDisputeDto"];

// Paid ticket sales for the event (M5 SalesPanel), per currency, from the API's ledger.
export async function SalesPanel({ sales, feeChoice }: { sales: Sales; feeChoice: FeeChoice }) {
  const [t, root, format] = await Promise.all([getTranslations("dashboard.sales"), getTranslations(), getFormat()]);
  return (
    <section className="panel stack" aria-labelledby="sales-title">
      <div className="spread">
        <div id="sales-title" className="panel-label">{t("title")}</div>
        <span className="muted small">{root(feeChoiceKey(feeChoice).labelKey)}</span>
      </div>
      {sales.currencies.length === 0 && <p className="muted">{t("none")}</p>}
      {sales.currencies.map((c) => {
        const f = (n: number) => format.money(n, c.currency);
        const minus = (n: number) => t("minus", { amount: f(n) });
        return (
          <div className="stack" key={c.currency}>
            <div className="stats">
              <div className="stat"><b>{c.ticketsSold}</b><span>{t("ticketsSold")}</span></div>
              <div className="stat"><b className="pay-money">{f(c.netMinor)}</b><span>{t("received")}</span></div>
            </div>
            <dl className="pay-ledger">
              <dt>{t("guestsPaid", { count: c.ordersPaid })}</dt><dd>{f(c.grossMinor)}</dd>
              <dt>{t("fees")}</dt><dd>{minus(c.feesMinor)}</dd>
              {c.vatMinor > 0 && <><dt>{t("vat")}</dt><dd>{minus(c.vatMinor)}</dd></>}
              <dt>{t("paystack")}</dt><dd>{minus(c.providerChargesMinor)}</dd>
              {c.debtRecoveredMinor > 0 && <><dt>{t("debtRecovered")}</dt><dd>{minus(c.debtRecoveredMinor)}</dd></>}
              <dt className="pay-total">{t("received")}</dt><dd className="pay-total">{f(c.netMinor)}</dd>
              {c.refundsMinor > 0 && <><dt>{t("refunded")}</dt><dd>{f(c.refundsMinor)}</dd></>}
              {c.debtMinor > 0 && <><dt>{t("owed")}</dt><dd>{f(c.debtMinor)}</dd></>}
            </dl>
          </div>
        );
      })}
      {(sales.refundsPending > 0 || sales.refundsFailed > 0) && (
        <p className="small">
          {sales.refundsPending > 0 && <>{t("refundsPending", { count: sales.refundsPending })}{" "}</>}
          {sales.refundsFailed > 0 && <span className="error">{t("refundsFailed", { count: sales.refundsFailed })}</span>}
        </p>
      )}
      <p className="muted small">{t("shareNote")}</p>
    </section>
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
    <section className="pay-banner" role="alert" aria-labelledby="disputes-title">
      <b id="disputes-title">{t("title", { count: open.length })} ({[...total].map(([c, n]) => format.money(n, c)).join(" · ")})</b>
      <p className="small">{t("body")}</p>
    </section>
  );
}
