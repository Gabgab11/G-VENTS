import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { MyHostApplication } from "@/lib/payments";
import { sellReasonKey } from "@/lib/payment-text";
import { getFormat } from "@/i18n/format-server";

// The host's paid-ticket status on the dashboard (M5 SellPaidCard): not applied, in review,
// declined, approved, payout account pending, or owing money (why paid publishing is blocked).
export default async function SellPaidCard({ app, paidOpen }: { app: MyHostApplication | null; paidOpen: boolean }) {
  if (!app) return null;
  // Nothing to say while payments are off for everyone and the host never applied.
  if (!paidOpen && app.status === "none") return null;
  const t = await getTranslations("dashboard.sellPaid");
  if (app.canSellPaid && app.debts.length === 0) {
    return (
      <section className="panel pay-card" aria-labelledby="sell-paid">
        <div className="spread">
          <div>
            <div id="sell-paid" className="option-title">{t("title")}</div>
            <div className="muted small">{app.currency ? t("canSellIn", { currency: app.currency }) : t("canSell")}</div>
          </div>
          <Link href="/account/payouts" className="btn-small">{t("payoutDetails")}</Link>
        </div>
      </section>
    );
  }
  const root = await getTranslations();
  const format = await getFormat();
  const reason = sellReasonKey(app.reason);
  const amounts = app.debts.map((d) => format.money(d.owedMinor, d.currency));
  const owed = amounts.length === 0 ? "" : amounts.reduce((first, second) => t("and", { first, second }));
  return (
    <section className={`panel pay-card ${app.reason === "owes_money" ? "pay-card-warn" : ""}`} aria-labelledby="sell-paid">
      <div className="spread">
        <div>
          <div id="sell-paid" className="option-title">{app.reason === "owes_money" ? t("owe", { amount: owed }) : t("sellTitle")}</div>
          <div className="muted small">{root(reason.key)}</div>
          {app.reason === "application_declined" && app.decisionReason && <div className="small">{t("reason", { reason: app.decisionReason })}</div>}
        </div>
        {reason.actionKey && <Link href="/account/payouts" className={app.reason === "not_applied" ? "btn-white" : "btn-small"}>{root(reason.actionKey)}</Link>}
      </div>
    </section>
  );
}
