import { getTranslations } from "next-intl/server";
import { Button, Card, cx } from "@/design";
import type { MyHostApplication } from "@/lib/payments";
import { sellReasonKey } from "@/lib/payment-text";
import { getFormat } from "@/i18n/format-server";
import styles from "./dashboard.module.css";

// The host's paid-ticket status on the dashboard (M5 SellPaidCard): not applied, in review,
// declined, approved, payout account pending, or owing money (why paid publishing is blocked).
export default async function SellPaidCard({ app, paidOpen }: { app: MyHostApplication | null; paidOpen: boolean }) {
  if (!app) return null;
  // Nothing to say while payments are off for everyone and the host never applied.
  if (!paidOpen && app.status === "none") return null;
  const t = await getTranslations("dashboard.sellPaid");
  if (app.canSellPaid && app.debts.length === 0) {
    return (
      <Card as="section" aria-labelledby="sell-paid">
        <div className="spread">
          <div>
            <div id="sell-paid" className="option-title">{t("title")}</div>
            <div className="muted small">{app.currency ? t("canSellIn", { currency: app.currency }) : t("canSell")}</div>
          </div>
          <Button href="/account/payouts" size="sm">{t("payoutDetails")}</Button>
        </div>
      </Card>
    );
  }
  const root = await getTranslations();
  const format = await getFormat();
  const reason = sellReasonKey(app.reason);
  const amounts = app.debts.map((d) => format.money(d.owedMinor, d.currency));
  const owed = amounts.length === 0 ? "" : amounts.reduce((first, second) => t("and", { first, second }));
  return (
    <Card as="section" className={cx(app.reason === "owes_money" && styles.warn)} aria-labelledby="sell-paid">
      <div className="spread">
        <div>
          <div id="sell-paid" className="option-title">{app.reason === "owes_money" ? t("owe", { amount: owed }) : t("sellTitle")}</div>
          <div className="muted small">{root(reason.key)}</div>
          {app.reason === "application_declined" && app.decisionReason && <div className="small">{t("reason", { reason: app.decisionReason })}</div>}
        </div>
        {reason.actionKey && (app.reason === "not_applied"
          ? <Button href="/account/payouts" variant="primary">{root(reason.actionKey)}</Button>
          : <Button href="/account/payouts" size="sm">{root(reason.actionKey)}</Button>)}
      </div>
    </Card>
  );
}
