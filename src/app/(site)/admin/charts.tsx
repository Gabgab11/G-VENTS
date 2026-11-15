import Link from "next/link";

// Admin charts (FR-21), plain HTML/CSS so they render on the server and follow the theme.
// One series per chart and one axis (no dual axes); single-series charts use the brand gold;
// every bar has a hover/focus tooltip and every chart has a table view or direct labels.

export type Point = { key: string; label: string; value: number; display?: string };

/** Columns over time for one measure. */
export function ColumnChart({ id, title, sub, points, total }: { id: string; title: string; sub?: string; points: Point[]; total?: string }) {
  const peak = Math.max(0, ...points.map((p) => p.value));
  const top = peak || 1;
  const fmt = (p: Point) => p.display ?? p.value.toLocaleString("en-GB");
  return (
    <section className="panel stack ad-chart-card" aria-labelledby={id}>
      <div className="ad-panel-head">
        <h2 id={id} className="ad-h2">{title}</h2>
        {total && <b className="ad-chart-total">{total}</b>}
      </div>
      {sub && <p className="muted small ad-chart-sub">{sub}</p>}
      {points.length === 0 ? <p className="muted">No data for this period.</p> : (
        <div className="ad-chart" role="img" aria-label={`${title}: ${points.length} periods, highest ${peak}`}>
          <div className="ad-chart-grid" aria-hidden="true"><span>{peak}</span><span>{peak > 1 ? Math.round(peak / 2) : ""}</span><span>0</span></div>
          <div className="ad-bars">
            {points.map((p) => (
              <div key={p.key} className="ad-bar-slot" tabIndex={0} aria-label={`${p.label}: ${fmt(p)}`}>
                {p.value > 0 && <span className="ad-bar" style={{ height: `${(p.value / top) * 100}%` }} />}
                <span className="ad-tip" role="tooltip">{p.label} · <b>{fmt(p)}</b></span>
              </div>
            ))}
          </div>
          <div className="ad-axis" aria-hidden="true"><span>{points[0]!.label}</span><span>{points[points.length - 1]!.label}</span></div>
        </div>
      )}
      {points.length > 0 && (
        <details className="ad-details">
          <summary>Show as a table</summary>
          <table className="ad-table">
            <thead><tr><th scope="col">Period</th><th scope="col" className="num">{title}</th></tr></thead>
            <tbody>{points.map((p) => <tr key={p.key}><td>{p.label}</td><td className="num">{fmt(p)}</td></tr>)}</tbody>
          </table>
        </details>
      )}
    </section>
  );
}

export type Row = { key: string; label: string; value: number; display?: string; note?: string; href?: string };

/** Ranked horizontal bars with the value written on each row (direct labels, no legend). */
export function BarList({ id, title, sub, rows, empty }: { id: string; title: string; sub?: string; rows: Row[]; empty: string }) {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const top = Math.max(1, ...sorted.map((r) => r.value));
  return (
    <section className="panel stack" aria-labelledby={id}>
      <div className="ad-panel-head"><h2 id={id} className="ad-h2">{title}</h2>{sub && <span className="muted small">{sub}</span>}</div>
      {sorted.length === 0 ? <p className="muted">{empty}</p> : (
        <ol className="ad-barlist">
          {sorted.map((r) => (
            <li key={r.key}>
              <div className="ad-barlist-text">
                <span className="ad-barlist-label">{r.href ? <Link href={r.href}>{r.label}</Link> : r.label}{r.note && <span className="muted small"> · {r.note}</span>}</span>
                <b className="ad-barlist-value">{r.display ?? r.value.toLocaleString("en-GB")}</b>
              </div>
              <span className="ad-barlist-track" aria-hidden="true"><span className="ad-barlist-bar" style={{ width: `${(r.value / top) * 100}%` }} /></span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Two parts of one whole (free vs paid tickets): one bar, two validated categorical colours, legend + labels. */
export function SplitBar({ id, title, parts }: { id: string; title: string; parts: [{ label: string; value: number }, { label: string; value: number }] }) {
  const total = parts[0].value + parts[1].value;
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  return (
    <section className="panel stack" aria-labelledby={id}>
      <div className="ad-panel-head"><h2 id={id} className="ad-h2">{title}</h2><span className="muted small">{total.toLocaleString("en-GB")} tickets</span></div>
      <div className="ad-split" role="img" aria-label={parts.map((p) => `${p.label} ${p.value} (${pct(p.value)}%)`).join(", ")}>
        {total === 0 ? <span className="ad-split-empty" /> : parts.map((p, i) => p.value > 0 && <span key={p.label} className={`ad-split-part s${i + 1}`} style={{ flexGrow: p.value }} />)}
      </div>
      <ul className="ad-legend">
        {parts.map((p, i) => (
          <li key={p.label}><span className={`ad-swatch s${i + 1}`} aria-hidden="true" />{p.label}: <b>{p.value.toLocaleString("en-GB")}</b> <span className="muted">({pct(p.value)}%)</span></li>
        ))}
      </ul>
    </section>
  );
}

/** A headline rate with a meter (single hue). */
export function Meter({ id, title, part, whole, caption, empty }: { id: string; title: string; part: number; whole: number; caption: string; empty: string }) {
  const rate = whole ? part / whole : 0;
  return (
    <section className="panel stack" aria-labelledby={id}>
      <h2 id={id} className="ad-h2">{title}</h2>
      <b className="ad-hero">{whole ? `${Math.round(rate * 100)}%` : "—"}</b>
      <span className="ad-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rate * 100)} aria-label={title}>
        <span style={{ width: `${rate * 100}%` }} />
      </span>
      <span className="muted small">{whole ? `${part.toLocaleString("en-GB")} of ${whole.toLocaleString("en-GB")} ${caption}` : empty}</span>
    </section>
  );
}
