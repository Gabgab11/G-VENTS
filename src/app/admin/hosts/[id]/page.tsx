import Link from "next/link";
import { notFound } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { adminCall, formatDate, formatMinor, formatMoneyList } from "@/lib/admin";
import { APPLICATION_STATUS, PAYOUT_COUNTRIES } from "@/lib/payment-text";
import { isUuid } from "@/lib/forms";
import { suspendHost, unsuspendHost } from "../../actions";
import Notice from "../../Notice";

export default async function AdminHost({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();
  const h = await adminCall(async () => data(await (await api()).GET("/v1/admin/hosts/{id}", { params: { path: { id } } })), `/admin/hosts/${id}`);

  return (
    <div className="stack ad-section">
      <Link href="/admin/hosts" className="dc-link">← All hosts</Link>
      <Notice ok={sp.ok} err={sp.err} />
      <section className="panel stack">
        <div className="ad-panel-head">
          <div>
            <h2 className="ad-h2">{h.name || "No name"}</h2>
            <div className="muted">{h.email ?? "—"} · joined {formatDate(h.joinedAt)}</div>
          </div>
          {h.suspendedAt ? <span className="ad-pill bad">Suspended</span> : <span className="ad-pill">Active</span>}
        </div>
        <div className="ad-tiles">
          <div className="ad-tile"><span className="ad-tile-label">Events</span><b className="ad-tile-value">{h.eventsCount}</b></div>
          <div className="ad-tile"><span className="ad-tile-label">Tickets issued</span><b className="ad-tile-value">{h.ticketsIssued.toLocaleString("en-GB")}</b></div>
          <div className="ad-tile"><span className="ad-tile-label">Revenue</span><b className="ad-tile-value ad-tile-money">{formatMoneyList(h.gross)}</b></div>
        </div>
        {h.suspendedAt && <p className="muted">Suspended {formatDate(h.suspendedAt, true)}{h.suspendedReason ? `: ${h.suspendedReason}` : ""}</p>}
      </section>

      {/* M5 HostMoney: the paid-ticket application, payout account and money owed (RF6). */}
      <section className="panel stack" aria-labelledby="ad-host-money">
        <h2 id="ad-host-money" className="ad-h2">Paid tickets</h2>
        {!h.application ? <p className="muted">Hasn&apos;t applied to sell paid tickets.</p> : (
          <p>
            <Link href={`/admin/hosts/applications/${h.application.id}`} className="ad-strong">Application</Link>{" "}
            <span className={`ad-pill ${h.application.status === "approved" ? "completed" : h.application.status === "submitted" ? "warn" : "bad"}`}>{APPLICATION_STATUS[h.application.status]}</span>
            <span className="muted small"> · {PAYOUT_COUNTRIES[h.application.payoutCountry].name} · applied {formatDate(h.application.submittedAt)}</span>
          </p>
        )}
        {h.payoutAccount && (
          <p>
            Payout account: {h.payoutAccount.bankName ?? h.payoutAccount.bankCode} · ending {h.payoutAccount.accountNumberLast4}{h.payoutAccount.accountName ? ` · ${h.payoutAccount.accountName}` : ""}{" "}
            <span className={`ad-pill ${h.payoutAccount.status === "active" ? "completed" : "warn"}`}>{h.payoutAccount.status}</span>
            {h.payoutAccount.subaccountCode && <> <code className="ad-code">{h.payoutAccount.subaccountCode}</code></>}
            {h.payoutAccount.activatedAt && <span className="muted small"> · active since {formatDate(h.payoutAccount.activatedAt)}</span>}
          </p>
        )}
        {h.debts.length === 0 ? <p className="muted small">Owes nothing.</p> : (
          <div className="ad-scroll">
            <table className="ad-table">
              <thead><tr><th scope="col">Currency</th><th scope="col" className="num">Owed now</th><th scope="col" className="num">Recovered from sales</th></tr></thead>
              <tbody>{h.debts.map((d) => (
                <tr key={d.currency}><td>{d.currency}</td><td className="num">{formatMinor(d.owedMinor, d.currency)}</td><td className="num">{formatMinor(d.recoveredMinor, d.currency)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {h.debts.some((d) => d.owedMinor > 0) && <p className="muted small">While anything is owed, this host can&apos;t publish new paid events; it&apos;s recovered from their next Paystack sales.</p>}
      </section>

      <section className="panel stack" aria-labelledby="ad-host-events">
        <h2 id="ad-host-events" className="ad-h2">Events</h2>
        {h.events.length === 0 ? <p className="muted">No events yet.</p> : (
          <div className="ad-scroll">
            <table className="ad-table">
              <thead><tr><th scope="col">Event</th><th scope="col">Starts</th><th scope="col">Status</th></tr></thead>
              <tbody>{h.events.map((e) => (
                <tr key={e.id}><td><Link href={`/e/${e.slug}`} className="ad-strong">{e.title}</Link></td><td>{formatDate(e.startsAt, true)}</td><td><span className={`ad-pill ${e.status}`}>{e.status}</span></td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel stack" aria-labelledby="ad-host-standing">
        <h2 id="ad-host-standing" className="ad-h2">Standing</h2>
        {h.suspendedAt ? (
          <form action={unsuspendHost} className="stack">
            <input type="hidden" name="host_id" value={h.id} />
            <p className="muted small">Lifting the suspension lets this host create and publish events and take registrations again.</p>
            <button type="submit" className="btn-white">Lift suspension</button>
          </form>
        ) : (
          <form action={suspendHost} className="stack">
            <input type="hidden" name="host_id" value={h.id} />
            <p className="muted small">A suspended host can&apos;t create, publish or edit events, and their events take no new registrations. Tickets already issued still work.</p>
            <label className="field"><span>Reason (kept in the audit log)</span><input className="input" name="reason" maxLength={500} required minLength={3} /></label>
            <button type="submit" className="btn-ghost ad-danger">Suspend host</button>
          </form>
        )}
      </section>
    </div>
  );
}
