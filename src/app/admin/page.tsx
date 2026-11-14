import Link from "next/link";
import { api, data } from "@/lib/api/server";
import { adminCall, formatMinor } from "@/lib/admin";
import { BarList, ColumnChart, Meter, SplitBar, type Point } from "./charts";

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

const n = (v: number) => v.toLocaleString("en-GB");
const statusLabel = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const range = RANGES.find((r) => String(r.days) === sp.days) ?? RANGES[1];
  const to = new Date();
  const from = new Date(to.getTime() - range.days * 86_400_000);
  const o = await adminCall(
    async () => data(await (await api()).GET("/v1/admin/overview", { params: { query: { from: from.toISOString(), to: to.toISOString(), interval: range.interval } } })),
    `/admin?days=${range.days}`,
  );
  const b = o.breakdowns;
  const per = `per ${range.interval}`;
  const series = (pick: (p: (typeof o.series)[number]) => number): Point[] =>
    o.series.map((p) => ({ key: p.start, label: bucketLabel(p.start, range.interval), value: pick(p) }));
  const sum = (pick: (p: (typeof o.series)[number]) => number) => o.series.reduce((t, p) => t + pick(p), 0);
  const ordersPlaced = sum((p) => p.ordersPlaced);
  // Revenue: one chart per currency (amounts in different currencies never share an axis).
  const currencies = [...new Set(o.series.flatMap((p) => p.revenue.map((r) => r.currency)))].sort();

  return (
    <div className="stack ad-section">
      <div className="ad-toolbar">
        <div className="seg" role="group" aria-label="Period">
          {RANGES.map((r) => (
            <Link key={r.days} href={`/admin?days=${r.days}`} className={r === range ? "on" : ""} aria-current={r === range ? "true" : undefined}>{r.label}</Link>
          ))}
        </div>
        <span className="muted small">Last {range.label} · events and hosts are all-time totals</span>
      </div>

      <div className="ad-tiles">
        <div className="ad-tile"><span className="ad-tile-label">Tickets issued</span><b className="ad-tile-value">{n(o.ticketsIssued)}</b><span className="ad-tile-sub">{n(b.ticketsByKind.free)} free · {n(b.ticketsByKind.paid)} paid</span></div>
        <div className="ad-tile"><span className="ad-tile-label">Orders placed</span><b className="ad-tile-value">{n(ordersPlaced)}</b><span className="ad-tile-sub">in the last {range.label}</span></div>
        <div className="ad-tile"><span className="ad-tile-label">Check-ins</span><b className="ad-tile-value">{n(o.checkIns)}</b><span className="ad-tile-sub">in the last {range.label}</span></div>
        <div className="ad-tile"><span className="ad-tile-label">Events</span><b className="ad-tile-value">{n(o.events.total)}</b><span className="ad-tile-sub">{n(o.events.published)} published · {n(o.events.upcoming)} upcoming</span></div>
        <div className="ad-tile"><span className="ad-tile-label">Hosts</span><b className="ad-tile-value">{n(o.hosts.total)}</b><span className="ad-tile-sub">{n(o.hosts.suspended)} suspended</span></div>
        {o.money.map((m) => (
          <div key={m.currency} className="ad-tile"><span className="ad-tile-label">Gross sales · {m.currency}</span><b className="ad-tile-value ad-tile-money">{formatMinor(m.grossMinor, m.currency)}</b><span className="ad-tile-sub">G-ventZ fees {formatMinor(m.feesMinor, m.currency)}</span></div>
        ))}
      </div>

      <h2 className="ad-group">Activity over time</h2>
      <div className="ad-grid">
        <ColumnChart id="ch-tickets" title="Tickets issued" sub={`Free and paid, confirmed, ${per}`} points={series((p) => p.ticketsIssued)} total={n(o.ticketsIssued)} />
        <ColumnChart id="ch-checkins" title="Check-ins" sub={`Guests scanned in at the door, ${per}`} points={series((p) => p.checkIns)} total={n(o.checkIns)} />
        <ColumnChart id="ch-orders" title="Orders placed" sub={`All orders, any status, ${per}`} points={series((p) => p.ordersPlaced)} total={n(ordersPlaced)} />
        <ColumnChart id="ch-events" title="Events created" sub={`New events, ${per}`} points={series((p) => p.eventsCreated)} total={n(sum((p) => p.eventsCreated))} />
        <ColumnChart id="ch-hosts" title="New hosts" sub={`Hosts whose first event was created, ${per}`} points={series((p) => p.newHosts)} total={n(sum((p) => p.newHosts))} />
      </div>

      <h2 className="ad-group">Revenue</h2>
      {currencies.length === 0 ? (
        <section className="panel"><p className="muted">No paid sales yet. Paid tickets start when payments are switched on in Settings.</p></section>
      ) : (
        <>
          <div className="ad-grid">
            {currencies.map((cur) => {
              const pts = o.series.map((p) => {
                const v = p.revenue.find((r) => r.currency === cur)?.amountMinor ?? 0;
                return { key: p.start, label: bucketLabel(p.start, range.interval), value: v, display: formatMinor(v, cur) };
              });
              const total = pts.reduce((t, p) => t + p.value, 0);
              return <ColumnChart key={cur} id={`ch-rev-${cur}`} title={`Gross sales · ${cur}`} sub={`Paid, completed orders, ${per}`} points={pts} total={formatMinor(total, cur)} />;
            })}
          </div>
          <section className="panel stack" aria-labelledby="ad-money-title">
            <h2 id="ad-money-title" className="ad-h2">Money per currency</h2>
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
          </section>
        </>
      )}

      <h2 className="ad-group">Breakdowns</h2>
      <div className="ad-grid">
        <SplitBar id="br-kind" title="Free vs paid tickets" parts={[{ label: "Free", value: b.ticketsByKind.free }, { label: "Paid", value: b.ticketsByKind.paid }]} />
        <Meter id="br-checkin" title="Check-in rate" part={b.checkInRate.checkedIn} whole={b.checkInRate.tickets} caption="tickets checked in, for events that started in this period" empty="No events have started in this period yet." />
        <BarList id="br-category" title="Tickets by category" sub="Events in brackets" empty="No tickets in this period."
          rows={b.byCategory.map((c) => ({ key: c.category, label: c.category, value: c.tickets, note: `${n(c.events)} event${c.events === 1 ? "" : "s"}`, href: `/discover?category=${encodeURIComponent(c.category)}` }))} />
        <BarList id="br-top" title="Top events" sub="By tickets issued" empty="No tickets in this period."
          rows={b.topEvents.map((e) => ({ key: e.id, label: e.title, value: e.tickets, note: `${n(e.checkedIn)} checked in`, href: `/e/${e.slug}` }))} />
        <BarList id="br-city" title="Top cities" sub="By tickets issued" empty="No tickets in this period."
          rows={b.byCity.map((c) => ({ key: `${c.city}|${c.country ?? ""}`, label: [c.city, c.country].filter(Boolean).join(", "), value: c.tickets }))} />
        <BarList id="br-orders" title="Orders by status" sub="Orders created in this period" empty="No orders in this period."
          rows={b.ordersByStatus.map((s) => ({ key: s.status, label: statusLabel(s.status), value: s.count, href: `/admin/orders?status=${s.status}` }))} />
      </div>
    </div>
  );
}
