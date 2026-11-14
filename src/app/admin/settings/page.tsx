import { api, data } from "@/lib/api/server";
import { adminCall, formatDate, formatMinor } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { clearDefaultFee, inviteStaff, removeFee, removeStaff, removeVat, revokeInvite, setDefaultFee, setFee, setPaystackCountry, setProvider, setSettlementDelay, setVat } from "../actions";
import { bpsToPercent } from "@/lib/money";
import { PAYOUT_COUNTRIES, type PayoutCountry } from "@/lib/payment-text";
import Notice from "../Notice";

// Paystack is switched per country (M5, PR1/PR2: each country its own Paystack account and keys).
const PROVIDERS = [
  { key: "interswitch", name: "Interswitch", note: "NGN only. Collected by G-ventZ, settled to hosts in batches." },
  { key: "stripe", name: "Stripe", note: "Other currencies, through Stripe Connect." },
] as const;

export default async function AdminSettings({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const { user } = await requireUser("/admin/settings");
  const myEmail = (user.email ?? "").toLowerCase();
  const s = await adminCall(async () => data(await (await api()).GET("/v1/admin/settings")), "/admin/settings");
  const fees = Object.entries(s.fees).sort(([a], [b]) => a.localeCompare(b));
  const vat = Object.entries(s.vat ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const countries = Object.keys(PAYOUT_COUNTRIES) as PayoutCountry[];

  return (
    <div className="stack ad-section">
      <Notice ok={sp.ok} err={sp.err} />

      <section className="panel stack" aria-labelledby="ad-pay-title">
        <div className="ad-panel-head">
          <h2 id="ad-pay-title" className="ad-h2">Payments</h2>
          <span className="muted small">Off by default. A provider can be switched on only when its live keys are set on the server.</span>
        </div>
        <div className="panel-label">Paystack · per country</div>
        <p className="muted small">Each country has its own Paystack account. Hosts sell in their payout country&apos;s currency, and the sale is split to their subaccount.</p>
        <ul className="ad-switches">
          {countries.map((c) => {
            const st = s.paystackCountries?.[c];
            if (!st) return null;
            return (
              <li key={c}>
                <div>
                  <b>{PAYOUT_COUNTRIES[c].name}</b> <span className="muted small">{st.currency}</span>{" "}
                  {st.enabled ? <span className="ad-pill completed">On</span> : <span className="ad-pill">Off</span>}{" "}
                  {!st.configured && <span className="ad-pill warn">Keys not set</span>}
                </div>
                <form action={setPaystackCountry}>
                  <input type="hidden" name="country" value={c} />
                  <input type="hidden" name="enabled" value={st.enabled ? "false" : "true"} />
                  <button type="submit" className={st.enabled ? "btn-ghost ad-danger" : "btn-white"} disabled={!st.enabled && !st.configured}
                    aria-label={`${st.enabled ? "Switch off" : "Switch on"} Paystack in ${PAYOUT_COUNTRIES[c].name}`}
                    title={!st.enabled && !st.configured ? "Add this country's Paystack keys on the server first" : undefined}>
                    {st.enabled ? "Switch off" : "Switch on"}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
        <div className="panel-label">Other providers</div>
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
          <span className="muted small">Per paid ticket: a percentage plus a fixed amount. Free tickets carry no fee.</span>
        </div>
        <p className="muted small">
          Each sale uses its currency&apos;s own rate if one is set below; otherwise the standard fee; otherwise no fee.
          Set NGN for Paystack and Interswitch, and the standard fee (or USD, GBP, EUR…) for Stripe currencies.
        </p>

        <div className="ad-fee-block">
          <div className="panel-label">Standard fee · all currencies</div>
          {s.defaultFee ? (
            <p><b>{(s.defaultFee.percentBps / 100).toFixed(2)}%</b> + <b>{(s.defaultFee.fixedMinor / 100).toFixed(2)}</b> <span className="muted small">(fixed part in each currency&apos;s main unit, e.g. 1.00 = ₦1 or $1)</span></p>
          ) : <p className="muted">Not set. Currencies without their own rate pay no fee.</p>}
          <form action={setDefaultFee} className="ad-inline-form">
            <label className="field"><span>Percentage (%)</span><input className="input" name="percent" inputMode="decimal" defaultValue={s.defaultFee ? (s.defaultFee.percentBps / 100).toString() : ""} placeholder="3" required /></label>
            <label className="field"><span>Fixed amount</span><input className="input" name="fixed" inputMode="decimal" defaultValue={s.defaultFee ? (s.defaultFee.fixedMinor / 100).toString() : ""} placeholder="0.50" required /></label>
            <button type="submit" className="btn-white">{s.defaultFee ? "Update standard fee" : "Set standard fee"}</button>
          </form>
          {s.defaultFee && <form action={clearDefaultFee}><button type="submit" className="link-btn">Remove standard fee</button></form>}
        </div>

        <div className="ad-fee-block">
          <div className="panel-label">Per-currency rates · override the standard fee</div>
          {fees.length === 0 ? <p className="muted">None yet: every currency uses the standard fee.</p> : (
            <div className="ad-scroll">
              <table className="ad-table">
                <thead><tr><th scope="col">Currency</th><th scope="col" className="num">Percentage</th><th scope="col" className="num">Fixed</th><th scope="col"><span className="sr-only">Remove</span></th></tr></thead>
                <tbody>{fees.map(([cur, f]) => (
                  <tr key={cur}>
                    <td>{cur}</td><td className="num">{(f.percentBps / 100).toFixed(2)}%</td><td className="num">{formatMinor(f.fixedMinor, cur)}</td>
                    <td><form action={removeFee}><input type="hidden" name="currency" value={cur} /><button type="submit" className="link-btn" aria-label={`Remove the ${cur} rate`}>Use standard</button></form></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <form action={setFee} className="ad-inline-form">
            <label className="field"><span>Currency</span><input className="input" name="currency" placeholder="NGN" maxLength={3} required /></label>
            <label className="field"><span>Percentage (%)</span><input className="input" name="percent" inputMode="decimal" placeholder="1.5" required /></label>
            <label className="field"><span>Fixed amount</span><input className="input" name="fixed" inputMode="decimal" placeholder="100" required /></label>
            <button type="submit" className="btn-white">Save currency rate</button>
          </form>
        </div>
      </section>

      <section className="panel stack" aria-labelledby="ad-vat-title">
        <div className="ad-panel-head">
          <h2 id="ad-vat-title" className="ad-h2">VAT on the G-ventZ fee</h2>
          <span className="muted small">Per currency, charged on G-ventZ&apos;s fee only. A currency not listed has 0%.</span>
        </div>
        {vat.length === 0 ? <p className="muted">No VAT rates set: every currency is 0%.</p> : (
          <div className="ad-scroll">
            <table className="ad-table">
              <thead><tr><th scope="col">Currency</th><th scope="col" className="num">VAT</th><th scope="col"><span className="sr-only">Remove</span></th></tr></thead>
              <tbody>{vat.map(([cur, v]) => (
                <tr key={cur}>
                  <td>{cur}</td><td className="num">{bpsToPercent(v.rateBps)}%</td>
                  <td><form action={removeVat}><input type="hidden" name="currency" value={cur} /><button type="submit" className="link-btn" aria-label={`Remove the ${cur} VAT rate`}>Remove (0%)</button></form></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <form action={setVat} className="ad-inline-form">
          <label className="field"><span>Currency</span><input className="input" name="currency" placeholder="NGN" maxLength={3} required /></label>
          <label className="field"><span>VAT (%)</span><input className="input" name="percent" inputMode="decimal" placeholder="7.5" required /></label>
          <button type="submit" className="btn-white">Save VAT rate</button>
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
          <span className="muted small">Everyone here can see and manage the whole platform, and needs two-step sign-in.</span>
        </div>
        <ul className="ad-staff">
          {s.staff.map((m) => {
            const me = m.email.toLowerCase() === myEmail;
            return (
              <li key={m.email} className="ad-staff-row">
                <span><b>{m.email}</b>{me && <span className="ad-pill">You</span>}{m.note ? <span className="muted"> · {m.note}</span> : null}<span className="muted small"> · since {formatDate(m.addedAt)}</span></span>
                {!me && s.staff.length > 1 && (
                  <details className="ad-actions">
                    <summary>Remove</summary>
                    <form action={removeStaff} className="ad-actions-body stack">
                      <input type="hidden" name="email" value={m.email} />
                      <label className="ad-check"><input type="checkbox" name="confirm" value="yes" required /> Remove {m.email} from staff</label>
                      <button type="submit" className="btn-ghost ad-danger">Remove</button>
                    </form>
                  </details>
                )}
              </li>
            );
          })}
        </ul>

        <div className="ad-fee-block">
          <div className="panel-label">Invite someone</div>
          <p className="muted small">They get an email, sign in with exactly this address, accept, and set up two-step sign-in. Invitations expire after 7 days.</p>
          <form action={inviteStaff} className="ad-inline-form">
            <label className="field"><span>Email</span><input className="input" name="email" type="email" autoComplete="off" placeholder="name@example.com" required /></label>
            <button type="submit" className="btn-white">Send invitation</button>
          </form>
          {s.invites.length > 0 && (
            <ul className="ad-staff">
              {s.invites.map((i) => (
                <li key={i.id} className="ad-staff-row">
                  <span><b>{i.email}</b> <span className="ad-pill pending_approval">Invited</span><span className="muted small"> · by {i.invitedBy?.name || i.invitedBy?.email || "staff"} · expires {formatDate(i.expiresAt, true)}</span></span>
                  <form action={revokeInvite}><input type="hidden" name="invite_id" value={i.id} /><button type="submit" className="link-btn">Withdraw</button></form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
