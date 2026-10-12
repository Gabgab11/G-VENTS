import Link from "next/link";
import { Suspense } from "react";
import { getFeaturedEvents } from "@/lib/events";
import { themeBackground } from "@/lib/themes";
import ElsewhereEvents from "@/components/ElsewhereEvents";
import { getElsewhereReport } from "@/lib/external";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos",
  });
}

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ debug?: string }> }) {
  const sp = await searchParams;
  const { events, live } = await getFeaturedEvents(12);
  const report = await getElsewhereReport();

  return (
    <main className="wrap page wide">
      <div className="section-head">
        <h1>Discover</h1>
        <p className="muted">Events on G-vents, and what&apos;s happening elsewhere.</p>
      </div>

      <section>
        <h2>On G-vents</h2>
        {live && events.length > 0 ? (
          <div className="ext-grid">
            {events.map((e) => (
              <Link key={e.id} href={`/e/${e.slug}`} className="event-card">
                <div className="event-card-cover" style={{ background: themeBackground(e.cover_theme) }} />
                <span className="source-tag">{e.category}</span>
                <b className="ext-title">{e.title}</b>
                <span className="muted small">{fmt(e.starts_at)}{e.city ? ` · ${e.city}` : ""}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted">No public G-vents events yet. Hosts can publish one from their dashboard.</p>
        )}
      </section>

      <Suspense fallback={<p className="muted small">Loading more events…</p>}>
        <ElsewhereEvents />
      </Suspense>

      {report && (
        <section className="debug-panel">
          <b>Event sources</b>
          {report.sources.map((s) => (
            <div className="q-row" key={s.name}>
              <span>{s.name}</span>
              <span className="muted small">
                {!s.configured ? "Not connected (no key or feed)" : `${s.count} events${s.error ? ` · ${s.error}` : ""}`}
              </span>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
