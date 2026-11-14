import Link from "next/link";
import { formatMinor } from "@/lib/money";
import type { MyHostApplication } from "@/lib/payments";
import { sellReasonText } from "@/lib/payment-text";

// The host's paid-ticket status on the dashboard (M5 SellPaidCard): not applied, in review,
// declined, approved, payout account pending, or owing money (why paid publishing is blocked).
export default function SellPaidCard({ app, paidOpen }: { app: MyHostApplication | null; paidOpen: boolean }) {
  if (!app) return null;
  // Nothing to say while payments are off for everyone and the host never applied.
  if (!paidOpen && app.status === "none") return null;
  if (app.canSellPaid && app.debts.length === 0) {
    return (
      <section className="panel pay-card" aria-labelledby="sell-paid">
        <div className="spread">
          <div>
            <div id="sell-paid" className="option-title">Paid tickets</div>
            <div className="muted small">You can sell paid tickets{app.currency ? ` in ${app.currency}` : ""}. Guests pay with Paystack.</div>
          </div>
          <Link href="/account/payouts" className="btn-small">Payout details</Link>
        </div>
      </section>
    );
  }
  const reason = sellReasonText(app.reason);
  const owed = app.debts.map((d) => formatMinor(d.owedMinor, d.currency)).join(" and ");
  return (
    <section className={`panel pay-card ${app.reason === "owes_money" ? "pay-card-warn" : ""}`} aria-labelledby="sell-paid">
      <div className="spread">
        <div>
          <div id="sell-paid" className="option-title">{app.reason === "owes_money" ? `You owe ${owed}` : "Sell paid tickets"}</div>
          <div className="muted small">{reason.text}</div>
          {app.reason === "application_declined" && app.decisionReason && <div className="small">Reason: {app.decisionReason}</div>}
        </div>
        {reason.action && <Link href="/account/payouts" className={app.reason === "not_applied" ? "btn-white" : "btn-small"}>{reason.action}</Link>}
      </div>
    </section>
  );
}
