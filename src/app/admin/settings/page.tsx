import { api, data } from "@/lib/api/server";
import { adminCall, formatDate, formatMinor } from "@/lib/admin";
import { setFee, setProvider, setSettlementDelay } from "../actions";
import Notice from "../Notice";

const PROVIDERS = [
  { key: "paystack", name: "Paystack", note: "Splits each sale to the host's subaccount." },
  { key: "interswitch", name: "Interswitch", note: "NGN only. Collected by G-ventZ, settled to hosts in batches." },
  { key: "stripe", name: "Stripe", note: "Other currencies, through Stripe Connect." },
] as const;

export default async function AdminSettings({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const s = await adminCall(async () => data(await (await api()).GET("/v1/admin/settings")), "/admin/settings");
  const fees = Object.entries(s.fees).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="stack ad-section">
      <Notice ok={sp.ok} err={sp.err} />

      <section className="panel stack" aria-labelledby="ad-pay-title">
        <div className="ad-panel-head">
          <h2 id="ad-pay-title" className="ad-h2">Payments</h2>
          <span className="muted small">Off by default. A provider can be switched on only when its live keys are set on the server.</span>
        </div>
        <ul className="ad-switches">
          {PROVIDERS.map((p) => {
            const st = s.payments[p.key];
            return (
              <li key={p.key}>
                <div>
                  <b>{p.name}</b>{" "}
                  {st.enabled ? <span className="ad-pill completed">On</span> : <span className="ad-pill">Off</span>}{" "}
                  {!st.configured && <span className="ad-pill warn">Keys not set</span>}
                  <div className="muted small">{p.note}</div>
                </div>
                <form action={setProvider}>
                  <input type="hidden" name="provider" value={p.key} />
                  <input type="hidden" name="enabled" value={st.enabled ? "false" : "true"} />
                  <button type="submit" className={st.enabled ? "btn-ghost ad-danger" : "btn-white"} disabled={!st.enabled && !st.configured}
                    title={!st.enabled && !st.configured ? "Add this provider's keys on the server first" : undefined}>
                    {st.enabled ? "Switch off" : "Switch on"}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel stack" aria-labelledby="ad-fee-title">
        <div className="ad-panel-head">
          <h2 id="ad-fee-title" className="ad-h2">G-ventZ fee</h2>
          <span className="muted small">Per paid ticket: a percentage plus a fixed amount, per currency. Free tickets carry no fee.</span>
        </div>
        {fees.length === 0 ? <p className="muted">No fee rates yet (fees are zero until set).</p> : (
          <div className="ad-scroll">
            <table className="ad-table">
              <thead><tr><th scope="col">Currency</th><th scope="col" className="num">Percentage</th><th scope="col" className="num">Fixed</th></tr></thead>
              <tbody>{fees.map(([cur, f]) => (
                <tr key={cur}><td>{cur}</td><td className="num">{(f.percentBps / 100).toFixed(2)}%</td><td className="num">{formatMinor(f.fixedMinor, cur)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <form action={setFee} className="ad-inline-form">
          <label className="field"><span>Currency</span><input className="input" name="currency" placeholder="NGN" maxLength={3} required /></label>
          <label className="field"><span>Percentage (%)</span><input className="input" name="percent" inputMode="decimal" placeholder="1.5" required /></label>
          <label className="field"><span>Fixed amount</span><input className="input" name="fixed" inputMode="decimal" placeholder="100" required /></label>
          <button type="submit" className="btn-white">Save fee</button>
        </form>
      </section>

      <section className="panel stack" aria-labelledby="ad-settle-title">
        <div className="ad-panel-head">
          <h2 id="ad-settle-title" className="ad-h2">Interswitch settlements</h2>
          <span className="muted small">Hosts are paid this many working days after their event ends, so refunds and disputes can settle first.</span>
        </div>
        <form action={setSettlementDelay} className="ad-inline-form">
          <label className="field"><span>Working days</span><input className="input" name="days" type="number" min={0} max={30} defaultValue={s.settlementDelayWorkingDays} required /></label>
          <button type="submit" className="btn-white">Save</button>
        </form>
      </section>

      <section className="panel stack" aria-labelledby="ad-staff-title">
        <div className="ad-panel-head">
          <h2 id="ad-staff-title" className="ad-h2">Platform staff</h2>
          <span className="muted small">Changed by a database migration only. Everyone here needs two-step sign-in.</span>
        </div>
        <ul className="ad-staff">
          {s.staff.map((m) => <li key={m.email}><b>{m.email}</b>{m.note ? <span className="muted"> · {m.note}</span> : null}<span className="muted small"> · since {formatDate(m.addedAt)}</span></li>)}
        </ul>
      </section>
    </div>
  );
}
