import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getFormat } from "@/i18n/format-server";
import type { components } from "@/lib/api/schema";
import { paymentIsFinal, refundStatusKey } from "@/lib/payment-text";
import { PayButton, PaymentWatcher } from "./PaymentWatcher";
import { intlLocale } from "@/lib/format";

type Payment = components["schemas"]["OrderPaymentDto"];

// Message ids under tickets.payment.status.
const TITLE: Record<Payment["status"], string> = {
  awaiting_payment: "awaitingPayment",
  completed: "completed",
  expired: "expired",
  failed: "failed",
  refunded: "refunded",
  partially_refunded: "partiallyRefunded",
  disputed: "disputed",
  waitlisted: "waitlisted",
};

const WHEN: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" };

// The payment part of the order page (M5 PaymentStatus). Everything shown comes from the API's view
// of the order; the page never trusts the query string Paystack adds to the return link (CK5).
export default async function PaymentStatus({ orderId, payment, eventSlug }: { orderId: string; payment: Payment; eventSlug: string | null }) {
  const tr = await getTranslations("tickets.payment");
  const root = await getTranslations();
  const format = await getFormat();
  const formatMinor = format.money;
  const locale = format.lang === "en" ? "en-GB" : intlLocale(format.lang, "date");
  const when = (iso: string) => new Date(iso).toLocaleString(locale, WHEN);
  const t = { title: tr(`status.${TITLE[payment.status]}.title`), body: tr(`status.${TITLE[payment.status]}.body`) };
  const q = payment.quote;
  const offer = payment.status === "waitlisted" && payment.offerExpiresAt && payment.canPay;
  return (
    <section className={`panel stack pay-status pay-${payment.status}`} aria-labelledby="pay-status-title">
      <div className="spread">
        <h2 id="pay-status-title" className="pay-status-title">{offer ? tr("offerTitle") : t.title}</h2>
        {payment.reference && <code className="pay-ref" aria-label={tr("reference")}>{payment.reference}</code>}
      </div>
      <p className="muted" role="status">
        {offer ? tr("offerBody", { time: when(payment.offerExpiresAt!) }) : t.body}
      </p>

      {!paymentIsFinal(payment.status) && <PaymentWatcher holdExpiresAt={payment.holdExpiresAt} />}

      {payment.canPay && (
        <PayButton orderId={orderId} label={payment.status === "failed" ? tr("tryAgain") : q ? tr("payTotal", { total: formatMinor(q.totalMinor, q.currency) }) : tr("pay")} />
      )}
      {payment.status === "expired" && eventSlug && <Link href={`/e/${eventSlug}`} className="btn-white pay-cta">{tr("startAgain")}</Link>}

      {q && (
        <div className="pay-breakdown">
          {q.lines.map((l) => (
            <div className="pay-line" key={l.ticketTypeId}><span>{l.name} × {l.quantity}</span><span>{formatMinor(l.unitPriceMinor * l.quantity, q.currency)}</span></div>
          ))}
          {q.serviceFeeMinor > 0 && (
            <div className="pay-line">
              <span>{tr("serviceFee")}{q.vatMinor > 0 ? <span className="muted small">{` ${tr("includesVat", { amount: formatMinor(q.vatMinor, q.currency) })}`}</span> : null}</span>
              <span>{formatMinor(q.serviceFeeMinor, q.currency)}</span>
            </div>
          )}
          <div className="pay-line pay-total"><span>{payment.status === "completed" ? tr("paid") : tr("total")}</span><span>{formatMinor(q.totalMinor, q.currency)}</span></div>
          {payment.paidAt && <p className="muted small">{tr("paidAt", { time: when(payment.paidAt) })}</p>}
        </div>
      )}

      {payment.refunds.length > 0 && (
        <div className="stack">
          <div className="panel-label">{tr("refunds")}</div>
          <ul className="pay-refunds">
            {payment.refunds.map((r) => (
              <li key={r.id}>
                <span>{tr("refundLine", { amount: formatMinor(r.amountMinor, r.currency), count: r.ticketIds.length })}{r.reason === "cancellation" ? ` · ${tr("refundCancelled")}` : r.reason === "late_payment" ? ` · ${tr("refundLate")}` : ""}</span>
                <span className={`pay-pill ${r.status}`}>{refundStatusKey(r.status) ? root(refundStatusKey(r.status)!) : r.status}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">{tr("refundsNote")}</p>
        </div>
      )}
    </section>
  );
}
