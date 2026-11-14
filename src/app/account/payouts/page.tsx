import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { requireUser } from "@/lib/auth";
import { formatMinor } from "@/lib/money";
import { getAvailability, getMyHostApplication } from "@/lib/payments";
import { APPLICATION_STATUS, PAYOUT_COUNTRIES, isPayoutCountry, sellReasonText } from "@/lib/payment-text";
import { HostApplicationForm, PayoutChangeForm } from "./HostApplicationForm";

export const metadata: Metadata = { title: "Get paid · G-ventZ", robots: { index: false } };

const OK: Record<string, string> = {
  submitted: "Application sent. We'll email you when it's decided.",
  payout_changed: "Payout details changed. Paid sales pause until G-ventZ confirms the new account; we've emailed you.",
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }) : "";

// Selling paid tickets (M5, FR-20): apply once with payout details and a document; staff approve;
// then the host's Paystack payout account is created. Changing payout details needs two-step sign-in.
export default async function PayoutsPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const { user } = await requireUser("/account/payouts");
  const [app, availability] = await Promise.all([getMyHostApplication(), getAvailability()]);
  const ok = sp.ok && Object.hasOwn(OK, sp.ok) ? OK[sp.ok] : null;
  const countries = (availability?.countries ?? []).filter(isPayoutCountry);
  const canApply = !!app && (app.status === "none" || app.status === "declined");
  const reason = app && !app.canSellPaid ? sellReasonText(app.reason) : null;
  const payout = app?.payoutAccount ?? null;

  return (
    <main className="wrap page">
      <SiteHeader back="/dashboard" />
      <h1>Get paid</h1>
      <p className="muted">Sell paid tickets on G-ventZ. Guests pay with Paystack and your share goes straight to your bank account.</p>

      {ok && <p className="ok-note" role="status">{ok}</p>}
      {!app && <p className="error" role="alert">We couldn&apos;t load your payout details. Please refresh the page.</p>}

      {app && app.status !== "none" && (
        <section className="panel stack" aria-labelledby="pay-status">
          <div className="spread">
            <div id="pay-status" className="panel-label">Paid tickets</div>
            <span className={`pay-pill ${app.canSellPaid ? "ok" : app.status}`}>{app.canSellPaid ? "You can sell paid tickets" : APPLICATION_STATUS[app.status] ?? app.status}</span>
          </div>
          {reason && <p className="muted">{reason.text}</p>}
          {app.decisionReason && (app.status === "declined" || app.status === "revoked") && (
            <p><b>Reason from G-ventZ:</b> {app.decisionReason}</p>
          )}
          <dl className="pay-facts">
            {app.legalName && <><dt>Name</dt><dd>{app.legalName}</dd></>}
            {app.payoutCountry && <><dt>Country</dt><dd>{PAYOUT_COUNTRIES[app.payoutCountry].name} · sells in {app.currency}</dd></>}
            {app.submittedAt && <><dt>Applied</dt><dd>{fmtDate(app.submittedAt)}</dd></>}
            {app.decidedAt && <><dt>Decided</dt><dd>{fmtDate(app.decidedAt)}</dd></>}
          </dl>
          {app.debts.length > 0 && (
            <div className="pay-owed" role="note">
              <b>You owe G-ventZ {app.debts.map((d) => formatMinor(d.owedMinor, d.currency)).join(" and ")}</b>
              <p className="muted small">This is your share of refunded tickets or lost chargebacks. It&apos;s taken from your next paid sales automatically. Until it&apos;s paid back you can&apos;t publish new paid events; your existing events keep selling.</p>
            </div>
          )}
        </section>
      )}

      {app && payout && (
        <section className="panel stack" aria-labelledby="pay-account">
          <div className="spread">
            <div id="pay-account" className="panel-label">Payout account</div>
            <span className={`pay-pill ${payout.status === "active" ? "ok" : "submitted"}`}>{payout.status === "active" ? "Active" : payout.status === "pending" ? "Being set up" : "Replaced"}</span>
          </div>
          <p>{payout.bankName ?? payout.bankCode} · ending {payout.accountNumberLast4}{payout.accountName ? ` · ${payout.accountName}` : ""}</p>
          {payout.status === "pending" && <p className="muted small">G-ventZ is setting this account up with Paystack. You can sell paid tickets once it&apos;s active.</p>}
          {app.status === "approved" && (
            <details className="pay-details">
              <summary>Change payout details</summary>
              <PayoutChangeForm country={payout.country} />
            </details>
          )}
        </section>
      )}

      {app && canApply && (
        <section className="panel stack" aria-labelledby="pay-apply">
          <div id="pay-apply" className="panel-label">{app.status === "declined" ? "Apply again" : "Apply to sell paid tickets"}</div>
          {countries.length === 0 ? (
            <p className="muted">Paid tickets aren&apos;t open on G-ventZ yet. Every ticket is free for now; check back soon.</p>
          ) : (
            <HostApplicationForm countries={countries} defaults={{ legalName: app.legalName ?? "", phone: app.phone ?? "" }} />
          )}
        </section>
      )}

      <p className="muted small">
        Signed in as {user.email}. Money questions? See <Link href="/pricing" className="gold">fees</Link> and <Link href="/refunds" className="gold">refunds</Link>.
      </p>
    </main>
  );
}
