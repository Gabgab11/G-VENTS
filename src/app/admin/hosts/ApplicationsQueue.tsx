import Link from "next/link";
import { api, data } from "@/lib/api/server";
import { ApiError } from "@/lib/api/problem";
import { adminCall, formatDate } from "@/lib/admin";
import { APPLICATION_STATUS, PAYOUT_COUNTRIES } from "@/lib/payment-text";

export const QUEUES = ["submitted", "payout_pending", "approved", "declined", "revoked"] as const;
export type Queue = (typeof QUEUES)[number];

// Applications to sell paid tickets (M5 ApplicationsQueue, HA2/HA3): in review first, then
// approved hosts whose Paystack payout account still needs creating. Each opens its detail page.
export default async function ApplicationsQueue({ queue }: { queue: Queue }) {
  const page = await adminCall(async () => {
    try {
      return data(await (await api()).GET("/v1/admin/host-applications", { params: { query: { status: queue, limit: 50 } } }));
    } catch (error) {
      // Keep the hosts list usable if only the applications can't be loaded.
      if (error instanceof ApiError && error.status >= 500) return null;
      throw error;
    }
  }, `/admin/hosts?apps=${queue}`);

  return (
    <section className="panel stack" aria-labelledby="ad-apps">
      <div className="ad-panel-head">
        <h2 id="ad-apps" className="ad-h2">Applications to sell paid tickets</h2>
        <nav className="seg ad-seg" aria-label="Application status">
          {QUEUES.map((q) => (
            <Link key={q} href={`/admin/hosts?apps=${q}`} className={q === queue ? "on" : ""} aria-current={q === queue ? "page" : undefined}>{APPLICATION_STATUS[q]}</Link>
          ))}
        </nav>
      </div>
      {page === null ? <p className="muted">Applications couldn&apos;t be loaded right now.</p> : page.items.length === 0 ? (
        <p className="muted">{queue === "submitted" ? "Nothing waiting for review." : "None."}</p>
      ) : (
        <div className="ad-scroll">
          <table className="ad-table">
            <thead><tr><th scope="col">Applicant</th><th scope="col">Country</th><th scope="col">Bank account</th><th scope="col">Applied</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {page.items.map((a) => (
                <tr key={a.id}>
                  <td><Link href={`/admin/hosts/applications/${a.id}`} className="ad-strong">{a.legalName}</Link><div className="muted small">{a.host.email ?? "—"}</div></td>
                  <td>{PAYOUT_COUNTRIES[a.payoutCountry].name}</td>
                  <td>{a.bankName ?? a.bankCode} · {a.accountNumber}<div className="muted small">{a.resolvedAccountName ?? "Name not checked"}</div></td>
                  <td>{formatDate(a.submittedAt, true)}</td>
                  <td>
                    <span className={`ad-pill ${a.status === "submitted" ? "warn" : a.status === "approved" ? "completed" : "bad"}`}>{APPLICATION_STATUS[a.status]}</span>
                    {a.payoutAccountError && <div className="muted small">Paystack: {a.payoutAccountError}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
