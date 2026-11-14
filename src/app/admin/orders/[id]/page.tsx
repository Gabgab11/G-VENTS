import Link from "next/link";
import { notFound } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { adminCall, formatDate, formatMinor } from "@/lib/admin";
import { isUuid } from "@/lib/forms";
import { REFUND_STATUS } from "@/lib/payment-text";

const label = (s: string) => s.replace(/_/g, " ");

// One order's payment (M5 PaymentDetail, read-only): reference, quote, Paystack payments and their
// verification, refunds, disputes and the webhooks received. Refunds are issued by hosts; disputes
// are answered in the Paystack dashboard (DS3).
export default async function AdminOrderPayment({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const o = await adminCall(async () => data(await (await api()).GET("/v1/admin/orders/{id}/payment", { params: { path: { id } } })), `/admin/orders/${id}`);
  const q = o.quote;

  return (
    <div className="stack ad-section">
      <Link href="/admin/orders" className="dc-link">← All orders</Link>
      <section className="panel stack" aria-labelledby="ad-order">
        <div className="ad-panel-head">
          <div>
            <h2 id="ad-order" className="ad-h2">Order <code className="ad-code">{o.orderId}</code></h2>
            <div className="muted">{o.kind === "paid" ? "Paid" : "Free"}{o.country ? ` · Paystack ${o.country}` : ""}{o.reference ? <> · reference <code className="ad-code">{o.reference}</code></> : null}</div>
          </div>
          <span className={`ad-pill ${o.status}`}>{label(o.status)}</span>
        </div>
        <div className="ad-scroll">
          <table className="ad-table">
            <tbody>
              {o.holdExpiresAt && <tr><th scope="row">Hold until</th><td>{formatDate(o.holdExpiresAt, true)}</td></tr>}
              <tr><th scope="row">Non-refundable accepted</th><td>{o.nonRefundableAcceptedAt ? formatDate(o.nonRefundableAcceptedAt, true) : "—"}</td></tr>
              {q && <>
                <tr><th scope="row">Who pays fees</th><td>{q.feeChoice === "guest_pays" ? "Guest" : "Host"}</td></tr>
                <tr><th scope="row">Ticket prices</th><td>{formatMinor(q.pricesMinor, q.currency)} <span className="muted small">({q.lines.map((l) => `${l.quantity} × ${l.name}`).join(", ")})</span></td></tr>
                <tr><th scope="row">G-ventZ fees</th><td>{formatMinor(q.feesMinor, q.currency)}</td></tr>
                <tr><th scope="row">VAT on fees</th><td>{formatMinor(q.vatMinor, q.currency)}</td></tr>
                <tr><th scope="row">Service fee to guest</th><td>{formatMinor(q.serviceFeeMinor, q.currency)}</td></tr>
                <tr><th scope="row">Guest total</th><td className="ad-strong">{formatMinor(q.totalMinor, q.currency)}</td></tr>
              </>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel stack" aria-labelledby="ad-order-payments">
        <h2 id="ad-order-payments" className="ad-h2">Payments</h2>
        {o.payments.length === 0 ? <p className="muted">None.</p> : (
          <div className="ad-scroll">
            <table className="ad-table">
              <thead><tr><th scope="col">Reference</th><th scope="col">Status</th><th scope="col" className="num">Amount</th><th scope="col" className="num">Paystack charge</th><th scope="col">Channel</th><th scope="col">Verified</th></tr></thead>
              <tbody>{o.payments.map((p) => (
                <tr key={p.reference}>
                  <td><code className="ad-code">{p.reference}</code><div className="muted small">{formatDate(p.createdAt, true)}</div></td>
                  <td><span className={`ad-pill ${p.status === "success" ? "completed" : p.status === "pending" ? "warn" : "bad"}`}>{label(p.status)}</span></td>
                  <td className="num">{formatMinor(p.amountMinor, p.currency)}</td>
                  <td className="num">{p.providerChargeMinor === null ? "—" : formatMinor(p.providerChargeMinor, p.currency)}</td>
                  <td>{p.channel ?? "—"}</td>
                  <td>{formatDate(p.verifiedAt, true)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel stack" aria-labelledby="ad-order-refunds">
        <h2 id="ad-order-refunds" className="ad-h2">Refunds and disputes</h2>
        {o.refunds.length === 0 && o.disputes.length === 0 ? <p className="muted">None.</p> : (
          <div className="ad-scroll">
            <table className="ad-table">
              <thead><tr><th scope="col">What</th><th scope="col">Status</th><th scope="col" className="num">Amount</th><th scope="col">When</th></tr></thead>
              <tbody>
                {o.refunds.map((r) => (
                  <tr key={r.id}><td>Refund · {label(r.reason)} · {r.ticketIds.length} {r.ticketIds.length === 1 ? "ticket" : "tickets"}</td><td><span className={`ad-pill ${r.status === "refunded" ? "completed" : r.status === "failed" ? "bad" : "warn"}`}>{REFUND_STATUS[r.status] ?? r.status}</span></td><td className="num">{formatMinor(r.amountMinor, r.currency)}</td><td>{formatDate(r.createdAt, true)}</td></tr>
                ))}
                {o.disputes.map((d) => (
                  <tr key={d.id}><td>Dispute (chargeback)</td><td><span className={`ad-pill ${d.status === "won" ? "completed" : d.status === "lost" ? "bad" : "warn"}`}>{d.status}</span></td><td className="num">{formatMinor(d.amountMinor, d.currency)}</td><td>{formatDate(d.openedAt, true)}{d.resolvedAt ? ` → ${formatDate(d.resolvedAt, true)}` : ""}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {o.disputes.some((d) => d.status === "open") && <p className="muted small">Answer open disputes with evidence in the Paystack dashboard for {o.country ?? "this country"}.</p>}
      </section>

      <section className="panel stack" aria-labelledby="ad-order-hooks">
        <h2 id="ad-order-hooks" className="ad-h2">Webhooks received</h2>
        {o.webhooks.length === 0 ? <p className="muted">None.</p> : (
          <div className="ad-scroll">
            <table className="ad-table">
              <thead><tr><th scope="col">Event</th><th scope="col">Received</th><th scope="col">Processed</th><th scope="col">Outcome</th></tr></thead>
              <tbody>{o.webhooks.map((w, i) => (
                <tr key={`${w.type}-${w.receivedAt}-${i}`}><td><code className="ad-code">{w.type}</code></td><td>{formatDate(w.receivedAt, true)}</td><td>{formatDate(w.processedAt, true)}</td><td>{w.outcome ?? "—"}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
