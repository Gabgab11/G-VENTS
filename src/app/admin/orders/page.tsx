import Link from "next/link";
import { api, data } from "@/lib/api/server";
import { adminCall, formatDate, formatMinor } from "@/lib/admin";

const STATUSES = ["completed", "pending_approval", "waitlisted", "declined", "cancelled", "awaiting_payment", "expired"] as const;
type Status = (typeof STATUSES)[number];
const label = (s: string) => s.replace(/_/g, " ");

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; cursor?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const status = STATUSES.includes(sp.status as Status) ? (sp.status as Status) : undefined;
  const filters = { ...(q ? { q } : {}), ...(status ? { status } : {}) };
  const page = await adminCall(
    async () => data(await (await api()).GET("/v1/admin/orders", { params: { query: { ...filters, ...(sp.cursor ? { cursor: sp.cursor } : {}), limit: 50 } } })),
    `/admin/orders?${new URLSearchParams(filters)}`,
  );
  const exportQuery = new URLSearchParams(filters).toString();

  return (
    <div className="stack ad-section">
      <div className="ad-toolbar">
        <form className="ad-search" role="search">
          <input className="input" name="q" defaultValue={q} placeholder="Order id, buyer email or event" aria-label="Search orders" />
          <select className="input" name="status" defaultValue={status ?? ""} aria-label="Status">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
          <button className="btn-ghost" type="submit">Filter</button>
        </form>
        <a className="dc-link" href={`/admin/export/orders${exportQuery ? `?${exportQuery}` : ""}`}>Export CSV</a>
      </div>
      <p className="muted small">Refunds are issued by hosts from their event dashboard. Open a paid order for its payment, refunds, disputes and webhooks.</p>

      {page.items.length === 0 ? <p className="muted">No orders match.</p> : (
        <div className="ad-scroll">
          <table className="ad-table">
            <thead><tr><th scope="col">Placed</th><th scope="col">Order</th><th scope="col">Event</th><th scope="col">Buyer</th><th scope="col">Kind</th><th scope="col">Status</th><th scope="col" className="num">Tickets</th><th scope="col" className="num">Amount</th></tr></thead>
            <tbody>
              {page.items.map((o) => (
                <tr key={o.id}>
                  <td>{formatDate(o.createdAt, true)}</td>
                  <td>
                    {o.kind === "paid" ? <Link href={`/admin/orders/${o.id}`} aria-label={`Payment details for order ${o.id.slice(0, 8)}`}><code className="ad-code">{o.id.slice(0, 8)}</code></Link> : <code className="ad-code">{o.id.slice(0, 8)}</code>}
                    {o.reference && <div className="muted small">{o.reference}</div>}
                  </td>
                  <td>{o.event.title}</td>
                  <td>{o.buyerEmail ?? "—"}</td>
                  <td>{o.kind}</td>
                  <td><span className={`ad-pill ${o.status}`}>{label(o.status)}</span></td>
                  <td className="num">{o.tickets}</td>
                  <td className="num">{o.kind === "free" ? "Free" : formatMinor(o.amountMinor, o.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {page.nextCursor && <Link className="btn-ghost ad-more" href={`/admin/orders?${new URLSearchParams({ ...filters, cursor: page.nextCursor })}`}>Next page</Link>}
    </div>
  );
}
