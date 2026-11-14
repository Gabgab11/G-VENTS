import type { components } from "@/lib/api/schema";
import { formatMinor } from "@/lib/money";
import { FEE_CHOICES, type FeeChoice } from "@/lib/payment-text";

type Sales = components["schemas"]["EventSalesDto"];
type Dispute = components["schemas"]["EventDisputeDto"];

// Paid ticket sales for the event (M5 SalesPanel), per currency, from the API's ledger.
export function SalesPanel({ sales, feeChoice }: { sales: Sales; feeChoice: FeeChoice }) {
  return (
    <section className="panel stack" aria-labelledby="sales-title">
      <div className="spread">
        <div id="sales-title" className="panel-label">Paid ticket sales</div>
        <span className="muted small">{FEE_CHOICES[feeChoice].label}</span>
      </div>
      {sales.currencies.length === 0 && <p className="muted">No paid tickets sold yet.</p>}
      {sales.currencies.map((c) => {
        const f = (n: number) => formatMinor(n, c.currency);
        return (
          <div className="stack" key={c.currency}>
            <div className="stats">
              <div className="stat"><b>{c.ticketsSold}</b><span>Paid tickets sold</span></div>
              <div className="stat"><b className="pay-money">{f(c.netMinor)}</b><span>You received</span></div>
            </div>
            <dl className="pay-ledger">
              <dt>Guests paid ({c.ordersPaid} {c.ordersPaid === 1 ? "order" : "orders"})</dt><dd>{f(c.grossMinor)}</dd>
              <dt>G-ventZ fees</dt><dd>− {f(c.feesMinor)}</dd>
              {c.vatMinor > 0 && <><dt>VAT on fees</dt><dd>− {f(c.vatMinor)}</dd></>}
              <dt>Paystack charges</dt><dd>− {f(c.providerChargesMinor)}</dd>
              {c.debtRecoveredMinor > 0 && <><dt>Owed amounts taken from sales</dt><dd>− {f(c.debtRecoveredMinor)}</dd></>}
              <dt className="pay-total">You received</dt><dd className="pay-total">{f(c.netMinor)}</dd>
              {c.refundsMinor > 0 && <><dt>Refunded to guests</dt><dd>{f(c.refundsMinor)}</dd></>}
              {c.debtMinor > 0 && <><dt>You owe G-ventZ (refunds and chargebacks)</dt><dd>{f(c.debtMinor)}</dd></>}
            </dl>
          </div>
        );
      })}
      {(sales.refundsPending > 0 || sales.refundsFailed > 0) && (
        <p className="small">
          {sales.refundsPending > 0 && <>{sales.refundsPending} {sales.refundsPending === 1 ? "refund is" : "refunds are"} still being processed. </>}
          {sales.refundsFailed > 0 && <span className="error">{sales.refundsFailed} {sales.refundsFailed === 1 ? "refund" : "refunds"} failed; G-ventZ has been alerted and will follow up.</span>}
        </p>
      )}
      <p className="muted small">Your share of each sale goes to your payout account through Paystack. When you refund a ticket, the guest gets their share back; G-ventZ&apos;s fee and Paystack&apos;s charge aren&apos;t returned, and your share is taken from your next sales.</p>
    </section>
  );
}

// Open chargebacks on the event's orders (M5 DisputeBanner, DS1–DS3).
export function DisputeBanner({ disputes }: { disputes: Dispute[] }) {
  const open = disputes.filter((d) => d.status === "open");
  if (open.length === 0) return null;
  const total = new Map<string, number>();
  for (const d of open) total.set(d.currency, (total.get(d.currency) ?? 0) + d.amountMinor);
  return (
    <section className="pay-banner" role="alert" aria-labelledby="disputes-title">
      <b id="disputes-title">{open.length === 1 ? "A guest's bank disputed a payment" : `${open.length} payments are disputed`} ({[...total].map(([c, n]) => formatMinor(n, c)).join(" · ")})</b>
      <p className="small">
        The tickets still work while it&apos;s looked into. We&apos;ve emailed you: reply with proof the guest got what they paid for (their ticket and check-in, messages with them, the event details).
        If the dispute is lost, those tickets stop working and the amount is taken from your next sales.
      </p>
    </section>
  );
}
