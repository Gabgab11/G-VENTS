import Link from "next/link";
import { api, data } from "@/lib/api/server";
import { adminCall, formatMinor } from "@/lib/admin";

const RANGES = [
  { days: 7, label: "7 days", interval: "day" },
  { days: 30, label: "30 days", interval: "day" },
  { days: 90, label: "90 days", interval: "week" },
  { days: 365, label: "12 months", interval: "month" },
] as const;

function bucketLabel(iso: string, interval: string): string {
  const d = new Date(iso);
  if (interval === "month") return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const range = RANGES.find((r) => String(r.days) === sp.days) ?? RANGES[1];
  const to = new Date();
  const from = new Date(to.getTime() - range.days * 86_400_000);
  const o = await adminCall(
    async () => data(await (await api()).GET("/v1/admin/overview", { params: { query: { from: from.toISOString(), to: to.toISOString(), interval: range.interval } } })),
    `/admin?days=${range.days}`,
  );
  const peak = Math.max(1, ...o.series.map((p) => p.ticketsIssued));

  return (
    <div className="stack ad-section">
      <div className="ad-toolbar">
        <div className="seg" role="group" aria-label="Period">
          {RANGES.map((r) => (
            <Link key={r.days} href={`/admin?days=${r.days}`} className={r === range ? "on" : ""} aria-current={r === range ? "true" : undefined}>{r.label}</Link>
          ))}
        </div>
      </div>

      <div className="ad-tiles">
        <div className="ad-tile"><span className="ad-tile-label">Tickets issued</span><b className="ad-tile-value">{o.ticketsIssued.toLocaleString("en-GB")}</b><span className="ad-tile-sub">in the last {range.label}</span></div>
        <div className="ad-tile"><span className="ad-tile-label">Check-ins</span><b className="ad-tile-value">{o.checkIns.toLocaleString("en-GB")}</b><span className="ad-tile-sub">in the last {range.label}</span></div>
        <div className="ad-tile"><span className="ad-tile-label">Events</span><b className="ad-tile-value">{o.events.total.toLocaleString("en-GB")}</b><span className="ad-tile-sub">{o.events.published} published · {o.events.upcoming} upcoming</span></div>
        <div className="ad-tile"><span className="ad-tile-label">Hosts</span><b className="ad-tile-value">{o.hosts.total.toLocaleString("en-GB")}</b><span className="ad-tile-sub">{o.hosts.suspended} suspended</span></div>
      </div>

      <section className="panel stack" aria-labelledby="ad-chart-title">
        <div className="ad-panel-head">
          <h2 id="ad-chart-title" className="ad-h2">Tickets issued per {range.interval}</h2>
          <span className="muted small">Free and paid, confirmed</span>
        </div>
        {o.series.length === 0 ? (
          <p className="muted">No data for this period.</p>
        ) : (
          <div className="ad-chart" role="img" aria-label={`Tickets issued per ${range.interval}, last ${range.label}. Peak ${peak}.`}>
            <div className="ad-chart-grid" aria-hidden="true"><span>{peak}</span><span>{Math.round(peak / 2)}</span><span>0</span></div>
            <div className="ad-bars">
              {o.series.map((p) => (
                <div key={p.start} className="ad-bar-slot" tabIndex={0} aria-label={`${bucketLabel(p.start, range.interval)}: ${p.ticketsIssued} tickets`}>
                  <span className="ad-bar" style={{ height: `${(p.ticketsIssued / peak) * 100}%` }} />
                  <span className="ad-tip" role="tooltip">{bucketLabel(p.start, range.interval)} · <b>{p.ticketsIssued}</b></span>
                </div>
              ))}
            </div>
            <div className="ad-axis" aria-hidden="true">
              <span>{bucketLabel(o.series[0]!.start, range.interval)}</span>
              <span>{bucketLabel(o.series[o.series.length - 1]!.start, range.interval)}</span>
            </div>
          </div>
        )}
        <details className="ad-details">
          <summary>Show as a table</summary>
          <table className="ad-table">
            <thead><tr><th scope="col">Period starting</th><th scope="col" className="num">Tickets</th></tr></thead>
            <tbody>{o.series.map((p) => <tr key={p.start}><td>{bucketLabel(p.start, range.interval)}</td><td className="num">{p.ticketsIssued}</td></tr>)}</tbody>
          </table>
        </details>
      </section>

      <section className="panel stack" aria-labelledby="ad-money-title">
        <div className="ad-panel-head">
          <h2 id="ad-money-title" className="ad-h2">Revenue</h2>
          <span className="muted small">Paid orders, per currency, last {range.label}</span>
        </div>
        {o.money.length === 0 ? (
          <p className="muted">No paid sales yet. Paid tickets start when payments are switched on (Settings).</p>
        ) : (
          <div className="ad-scroll">
            <table className="ad-table">
              <thead><tr><th scope="col">Currency</th><th scope="col" className="num">Gross</th><th scope="col" className="num">G-ventZ fees</th><th scope="col" className="num">Provider charges</th><th scope="col" className="num">Refunds</th><th scope="col" className="num">Net to hosts</th></tr></thead>
              <tbody>
                {o.money.map((m) => (
                  <tr key={m.currency}>
                    <td>{m.currency}</td>
                    <td className="num">{formatMinor(m.grossMinor, m.currency)}</td>
                    <td className="num">{formatMinor(m.feesMinor, m.currency)}</td>
                    <td className="num">{formatMinor(m.providerChargesMinor, m.currency)}</td>
                    <td className="num">{formatMinor(m.refundsMinor, m.currency)}</td>
                    <td className="num"><b>{formatMinor(m.netMinor, m.currency)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
