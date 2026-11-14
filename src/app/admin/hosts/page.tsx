import Link from "next/link";
import { api, data } from "@/lib/api/server";
import { adminCall, formatDate, formatMoneyList } from "@/lib/admin";
import Notice from "../Notice";
import ApplicationsQueue, { QUEUES, type Queue } from "./ApplicationsQueue";

export default async function AdminHosts({ searchParams }: { searchParams: Promise<{ q?: string; cursor?: string; ok?: string; err?: string; apps?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const queue: Queue = QUEUES.find((x) => x === sp.apps) ?? "submitted";
  const page = await adminCall(
    async () => data(await (await api()).GET("/v1/admin/hosts", { params: { query: { ...(q ? { q } : {}), ...(sp.cursor ? { cursor: sp.cursor } : {}), limit: 50 } } })),
    "/admin/hosts",
  );

  return (
    <div className="stack ad-section">
      <Notice ok={sp.ok} err={sp.err} />
      <ApplicationsQueue queue={queue} />
      <div className="ad-toolbar">
        <form className="ad-search" role="search">
          <input className="input" name="q" defaultValue={q} placeholder="Search name or email" aria-label="Search hosts" />
          <button className="btn-ghost" type="submit">Search</button>
        </form>
        <a className="dc-link" href={`/admin/export/hosts${q ? `?q=${encodeURIComponent(q)}` : ""}`}>Export CSV</a>
      </div>

      {page.items.length === 0 ? (
        <p className="muted">{q ? `No hosts match "${q}".` : "No hosts yet."}</p>
      ) : (
        <div className="ad-scroll">
          <table className="ad-table">
            <thead><tr><th scope="col">Host</th><th scope="col">Joined</th><th scope="col" className="num">Events</th><th scope="col" className="num">Tickets</th><th scope="col">Revenue</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {page.items.map((h) => (
                <tr key={h.id}>
                  <td><Link href={`/admin/hosts/${h.id}`} className="ad-strong">{h.name || "No name"}</Link><div className="muted small">{h.email ?? "—"}</div></td>
                  <td>{formatDate(h.joinedAt)}</td>
                  <td className="num">{h.eventsCount}</td>
                  <td className="num">{h.ticketsIssued.toLocaleString("en-GB")}</td>
                  <td>{formatMoneyList(h.gross)}</td>
                  <td>{h.suspendedAt ? <span className="ad-pill bad">Suspended</span> : <span className="ad-pill">Active</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {page.nextCursor && <Link className="btn-ghost ad-more" href={`/admin/hosts?${new URLSearchParams({ ...(q ? { q } : {}), cursor: page.nextCursor })}`}>Next page</Link>}
    </div>
  );
}
