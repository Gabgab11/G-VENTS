import { getElsewhereReport } from "@/lib/external";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos",
  });
}

// Loads separately from the rest of the page, so G-vents content shows first.
export default async function ElsewhereEvents() {
  const { events, sources } = await getElsewhereReport();

  if (events.length === 0) {
    return (
      <section className="elsewhere">
        <div className="section-head">
          <h2>Happening elsewhere</h2>
          <p className="muted small">No upcoming events from connected sources yet.</p>
        </div>
        <div className="debug-panel">
          <b>Event sources</b>
          {sources.map((s, i) => (
            <div className="q-row" key={`${s.name}-${i}`}>
              <span>{s.name}</span>
              <span className="muted small">
                {!s.configured ? "Not connected (no key or feed)" : `${s.count} events${s.error ? ` · ${s.error}` : ""}`}
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="elsewhere">
      <div className="section-head">
        <h2>Happening elsewhere</h2>
        <p className="muted small">Listed from other platforms. Tickets are sold on the original site.</p>
      </div>
      <div className="ext-grid">
        {events.map((e) => (
          <a key={e.id} href={e.url} target="_blank" rel="noopener noreferrer" className="ext-card">
            <span className="source-tag">{e.source}</span>
            <b className="ext-title">{e.title}</b>
            <span className="muted small">{fmt(e.startsAt)}{e.place ? ` · ${e.place}` : ""}</span>
            <span className="ext-cta">View event →</span>
          </a>
        ))}
      </div>
    </section>
  );
}
