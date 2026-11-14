import Link from "next/link";
import type { components } from "@/lib/api/schema";
import { formatMinor } from "@/lib/money";
import { REFUND_STATUS, paymentIsFinal } from "@/lib/payment-text";
import { PayButton, PaymentWatcher } from "./PaymentWatcher";

type Payment = components["schemas"]["OrderPaymentDto"];

const TITLE: Record<Payment["status"], { title: string; body: string }> = {
  awaiting_payment: { title: "Waiting for your payment", body: "If you've just paid, this page updates by itself in a few seconds. Don't pay twice." },
  completed: { title: "Paid", body: "Your payment went through and your tickets are below. We've emailed them with your receipt." },
  expired: { title: "Your hold ran out", body: "We didn't get your payment within 10 minutes, so the tickets went back on sale. If money left your account, it's returned automatically." },
  failed: { title: "Payment didn't go through", body: "Paystack couldn't take the payment. Nothing was charged." },
  refunded: { title: "Refunded", body: "This order was refunded. The tickets no longer work." },
  partially_refunded: { title: "Partly refunded", body: "Some tickets in this order were refunded; the others still work." },
  disputed: { title: "Payment disputed", body: "Your bank told us this payment is disputed. Your tickets still work while it's looked into." },
  waitlisted: { title: "You're on the waiting list", body: "We'll email you if a place frees up. You'll then have 24 hours to pay." },
};

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

// The payment part of the order page (M5 PaymentStatus). Everything shown comes from the API's view
// of the order; the page never trusts the query string Paystack adds to the return link (CK5).
export default function PaymentStatus({ orderId, payment, eventSlug }: { orderId: string; payment: Payment; eventSlug: string | null }) {
  const t = TITLE[payment.status];
  const q = payment.quote;
  const offer = payment.status === "waitlisted" && payment.offerExpiresAt && payment.canPay;
  return (
    <section className={`panel stack pay-status pay-${payment.status}`} aria-labelledby="pay-status-title">
      <div className="spread">
        <h2 id="pay-status-title" className="pay-status-title">{offer ? "A place is yours" : t.title}</h2>
        {payment.reference && <code className="pay-ref" aria-label="Payment reference">{payment.reference}</code>}
      </div>
      <p className="muted" role="status">
        {offer ? `Pay before ${when(payment.offerExpiresAt!)} to get your tickets; after that the place goes to the next person.` : t.body}
      </p>

      {!paymentIsFinal(payment.status) && <PaymentWatcher holdExpiresAt={payment.holdExpiresAt} />}

      {payment.canPay && (
        <PayButton orderId={orderId} label={payment.status === "failed" ? "Try again with Paystack" : `Pay with Paystack${q ? ` · ${formatMinor(q.totalMinor, q.currency)}` : ""}`} />
      )}
      {payment.status === "expired" && eventSlug && <Link href={`/e/${eventSlug}`} className="btn-white pay-cta">Start again</Link>}

      {q && (
        <div className="pay-breakdown">
          {q.lines.map((l) => (
            <div className="pay-line" key={l.ticketTypeId}><span>{l.name} × {l.quantity}</span><span>{formatMinor(l.unitPriceMinor * l.quantity, q.currency)}</span></div>
          ))}
          {q.serviceFeeMinor > 0 && (
            <div className="pay-line">
              <span>Service fee{q.vatMinor > 0 ? <span className="muted small"> (includes VAT {formatMinor(q.vatMinor, q.currency)})</span> : null}</span>
              <span>{formatMinor(q.serviceFeeMinor, q.currency)}</span>
            </div>
          )}
          <div className="pay-line pay-total"><span>{payment.status === "completed" ? "Paid" : "Total"}</span><span>{formatMinor(q.totalMinor, q.currency)}</span></div>
          {payment.paidAt && <p className="muted small">Paid {when(payment.paidAt)}</p>}
        </div>
      )}

      {payment.refunds.length > 0 && (
        <div className="stack">
          <div className="panel-label">Refunds</div>
          <ul className="pay-refunds">
            {payment.refunds.map((r) => (
              <li key={r.id}>
                <span>{formatMinor(r.amountMinor, r.currency)} · {r.ticketIds.length} {r.ticketIds.length === 1 ? "ticket" : "tickets"}{r.reason === "cancellation" ? " · event cancelled" : r.reason === "late_payment" ? " · paid after the hold" : ""}</span>
                <span className={`pay-pill ${r.status}`}>{REFUND_STATUS[r.status] ?? r.status}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">Refunds go back to the card or account you paid with. Banks usually take 5 to 10 working days.</p>
        </div>
      )}
    </section>
  );
}
