import Link from "next/link";
import { api, data } from "@/lib/api/server";
import { adminCall, formatDate, formatMoneyList } from "@/lib/admin";
import { cancelEvent, unpublishEvent } from "../actions";
import Notice from "../Notice";

const STATUSES = ["published", "draft", "cancelled"] as const;
type Status = (typeof STATUSES)[number];

export default async function AdminEvents({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; cursor?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const status = STATUSES.includes(sp.status as Status) ? (sp.status as Status) : undefined;
  const here = `/admin/events?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}) })}`;
  const page = await adminCall(
    async () => data(await (await api()).GET("/v1/admin/events", { params: { query: { ...(q ? { q } : {}), ...(status ? { status } : {}), ...(sp.cursor ? { cursor: sp.cursor } : {}), limit: 50 } } })),
    here,
  );
  const exportQuery = new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}) }).toString();

  return (
    <div className="stack ad-section">
      <Notice ok={sp.ok} err={sp.err} />
      <div className="ad-toolbar">
        <form className="ad-search" role="search">
          <input className="input" name="q" defaultValue={q} placeholder="Search event or host" aria-label="Search events" />
          <select className="input" name="status" defaultValue={status ?? ""} aria-label="Status">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)}</option>)}
          </select>
          <button className="btn-ghost" type="submit">Filter</button>
        </form>
        <a className="dc-link" href={`/admin/export/events${exportQuery ? `?${exportQuery}` : ""}`}>Export CSV</a>
      </div>

      {page.items.length === 0 ? <p className="muted">No events match.</p> : (
        <div className="ad-scroll">
          <table className="ad-table">
            <thead><tr><th scope="col">Event</th><th scope="col">Host</th><th scope="col">Starts</th><th scope="col">Status</th><th scope="col" className="num">Tickets</th><th scope="col" className="num">Checked in</th><th scope="col">Revenue</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {page.items.map((e) => (
                <tr key={e.id}>
                  <td><Link href={`/e/${e.slug}`} className="ad-strong">{e.title}</Link><div className="muted small">{e.visibility}</div></td>
                  <td><Link href={`/admin/hosts/${e.owner.id}`}>{e.owner.name || e.owner.email || "—"}</Link></td>
                  <td>{formatDate(e.startsAt, true)}</td>
                  <td><span className={`ad-pill ${e.status}`}>{e.status}</span></td>
                  <td className="num">{e.ticketsIssued.toLocaleString("en-GB")}</td>
                  <td className="num">{e.checkedIn.toLocaleString("en-GB")}</td>
                  <td>{formatMoneyList(e.gross)}</td>
                  <td>
                    {e.status !== "cancelled" && (
                      <details className="ad-actions">
                        <summary>Actions</summary>
                        <div className="ad-actions-body stack">
                          {e.status === "published" && (
                            <form action={unpublishEvent}>
                              <input type="hidden" name="event_id" value={e.id} />
                              <input type="hidden" name="return_to" value={here} />
                              <button type="submit" className="btn-ghost">Unpublish (back to draft)</button>
                            </form>
                          )}
                          <form action={cancelEvent} className="stack">
                            <input type="hidden" name="event_id" value={e.id} />
                            <input type="hidden" name="return_to" value={here} />
                            <label className="field"><span>Reason</span><input className="input" name="reason" required minLength={3} maxLength={500} /></label>
                            <label className="ad-check"><input type="checkbox" name="confirm" value="yes" required /> Cancel this event for everyone</label>
                            <button type="submit" className="btn-ghost ad-danger">Cancel event</button>
                          </form>
                        </div>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {page.nextCursor && <Link className="btn-ghost ad-more" href={`/admin/events?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), cursor: page.nextCursor })}`}>Next page</Link>}
    </div>
  );
}
