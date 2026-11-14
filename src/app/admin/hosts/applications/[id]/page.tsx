import Link from "next/link";
import { notFound } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { adminCall, formatDate, formatMinor } from "@/lib/admin";
import { isUuid } from "@/lib/forms";
import { APPLICATION_STATUS, PAYOUT_COUNTRIES } from "@/lib/payment-text";
import { approveApplication, declineApplication, retryPayoutAccount, revokeApplication } from "../../../actions";
import Notice from "../../../Notice";

// One application to sell paid tickets (M5, HA2–HA6): the details, a 5-minute link to the private
// document, and the staff decisions. Every decision is audited and emails the host (the API does both).
export default async function AdminApplication({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();
  const path = `/admin/hosts/applications/${id}`;
  const a = await adminCall(async () => data(await (await api()).GET("/v1/admin/host-applications/{id}", { params: { path: { id } } })), path);
  const payout = a.payoutAccount;

  return (
    <div className="stack ad-section">
      <Link href="/admin/hosts" className="dc-link">← Hosts and applications</Link>
      <Notice ok={sp.ok} err={sp.err} />

      <section className="panel stack" aria-labelledby="ad-app">
        <div className="ad-panel-head">
          <div>
            <h2 id="ad-app" className="ad-h2">{a.legalName}</h2>
            <div className="muted"><Link href={`/admin/hosts/${a.host.id}`}>{a.host.name || a.host.email || "Host"}</Link>{a.host.email ? ` · ${a.host.email}` : ""}</div>
          </div>
          <span className={`ad-pill ${a.status === "submitted" ? "warn" : a.status === "approved" ? "completed" : "bad"}`}>{APPLICATION_STATUS[a.status]}</span>
        </div>
        <div className="ad-scroll">
          <table className="ad-table">
            <tbody>
              <tr><th scope="row">Phone</th><td>{a.phone}</td></tr>
              <tr><th scope="row">Payout country</th><td>{PAYOUT_COUNTRIES[a.payoutCountry].name} · {a.currency}</td></tr>
              <tr><th scope="row">Bank</th><td>{a.bankName ?? "—"} <span className="ad-code">{a.bankCode}</span></td></tr>
              <tr><th scope="row">Account number</th><td><code className="ad-code">{a.accountNumber}</code></td></tr>
              <tr><th scope="row">Name at the bank</th><td>{a.resolvedAccountName ?? <span className="muted">Not checked (Paystack can&apos;t check names in this country)</span>}</td></tr>
              <tr><th scope="row">Applied</th><td>{formatDate(a.submittedAt, true)}</td></tr>
              {a.decidedAt && <tr><th scope="row">Decided</th><td>{formatDate(a.decidedAt, true)}{a.decidedBy ? ` by ${a.decidedBy.name || a.decidedBy.email}` : ""}{a.decisionReason ? ` · ${a.decisionReason}` : ""}</td></tr>}
              <tr>
                <th scope="row">Document</th>
                <td>
                  {a.documentUrl ? (
                    <><a href={a.documentUrl} target="_blank" rel="noopener noreferrer" className="ad-strong">Open document ↗</a> <span className="muted small">link works until {formatDate(a.documentUrlExpiresAt, true)}; reload for a new one</span></>
                  ) : a.documentAvailable ? <span className="muted">Reload the page for a link</span> : <span className="muted">Missing</span>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {a.debts.length > 0 && <p><b>Owes:</b> {a.debts.map((d) => formatMinor(d.owedMinor, d.currency)).join(" · ")}</p>}
      </section>

      {payout && (
        <section className="panel stack" aria-labelledby="ad-app-payout">
          <h2 id="ad-app-payout" className="ad-h2">Payout account</h2>
          <p>{payout.bankName ?? payout.bankCode} · ending {payout.accountNumberLast4}{payout.accountName ? ` · ${payout.accountName}` : ""} <span className={`ad-pill ${payout.status === "active" ? "completed" : "warn"}`}>{payout.status}</span></p>
          {a.payoutAccountError && <p className="error">Paystack refused: {a.payoutAccountError}</p>}
          {payout.status === "pending" && (
            <form action={retryPayoutAccount}>
              <input type="hidden" name="application_id" value={a.id} />
              <button type="submit" className="btn-white">Retry creating the payout account</button>
            </form>
          )}
        </section>
      )}

      {a.status === "submitted" && (
        <section className="panel stack" aria-labelledby="ad-app-decide">
          <h2 id="ad-app-decide" className="ad-h2">Decide</h2>
          <p className="muted small">Check the document matches the name, and the name at the bank matches too. Approving creates the host&apos;s Paystack subaccount.</p>
          <form action={approveApplication}>
            <input type="hidden" name="application_id" value={a.id} />
            <button type="submit" className="btn-white">Approve</button>
          </form>
          <form action={declineApplication} className="stack">
            <input type="hidden" name="application_id" value={a.id} />
            <label className="field"><span>Reason for declining (the host sees it)</span><input className="input" name="reason" minLength={3} maxLength={500} required /></label>
            <button type="submit" className="btn-ghost ad-danger">Decline</button>
          </form>
        </section>
      )}

      {a.status === "approved" && (
        <section className="panel stack" aria-labelledby="ad-app-revoke">
          <h2 id="ad-app-revoke" className="ad-h2">Withdraw approval</h2>
          <form action={revokeApplication} className="stack">
            <input type="hidden" name="application_id" value={a.id} />
            <p className="muted small">The host can&apos;t create paid tickets or take paid orders any more. Tickets already sold still work.</p>
            <label className="field"><span>Reason (the host sees it)</span><input className="input" name="reason" minLength={3} maxLength={500} required /></label>
            <label className="ad-check"><input type="checkbox" name="confirm" value="yes" required /> Withdraw this host&apos;s approval</label>
            <button type="submit" className="btn-ghost ad-danger">Withdraw approval</button>
          </form>
        </section>
      )}
    </div>
  );
}
