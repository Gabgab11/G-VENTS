import { api, data } from "@/lib/api/server";
import { ApiError } from "@/lib/api/problem";
import { formatMoneyList, toCsv } from "@/lib/admin";

// CSV export of an admin list (FR-21.8): follows the API's pages (the API checks staff and two-step
// sign-in on every call), up to MAX_ROWS rows, with formula-safe cells (src/lib/admin.ts).
export const dynamic = "force-dynamic";

const MAX_ROWS = 10_000;
const PAGE = 200;

type Fetcher = (cursor: string | undefined) => Promise<{ rows: unknown[][]; next: string | null }>;

function pick(url: URL, names: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const n of names) { const v = url.searchParams.get(n); if (v) out[n] = v.slice(0, 100); }
  return out;
}

export async function GET(request: Request, { params }: { params: Promise<{ list: string }> }) {
  const { list } = await params;
  const url = new URL(request.url);
  const client = await api();
  let header: string[];
  let fetchPage: Fetcher;

  if (list === "hosts") {
    const q = pick(url, ["q"]);
    header = ["id", "name", "email", "joined", "events", "tickets_issued", "revenue", "suspended_at", "suspended_reason"];
    fetchPage = async (cursor) => {
      const p = data(await client.GET("/v1/admin/hosts", { params: { query: { ...q, ...(cursor ? { cursor } : {}), limit: PAGE } } }));
      return { next: p.nextCursor, rows: p.items.map((h) => [h.id, h.name, h.email, h.joinedAt, h.eventsCount, h.ticketsIssued, formatMoneyList(h.gross), h.suspendedAt, h.suspendedReason]) };
    };
  } else if (list === "events") {
    const q = pick(url, ["q", "status"]) as { q?: string; status?: "draft" | "published" | "cancelled" };
    header = ["id", "title", "slug", "host_name", "host_email", "status", "visibility", "starts_at", "currency", "tickets_issued", "checked_in", "revenue"];
    fetchPage = async (cursor) => {
      const p = data(await client.GET("/v1/admin/events", { params: { query: { ...q, ...(cursor ? { cursor } : {}), limit: PAGE } } }));
      return { next: p.nextCursor, rows: p.items.map((e) => [e.id, e.title, e.slug, e.owner.name, e.owner.email, e.status, e.visibility, e.startsAt, e.currency, e.ticketsIssued, e.checkedIn, formatMoneyList(e.gross)]) };
    };
  } else if (list === "orders") {
    const q = pick(url, ["q", "status"]) as { q?: string; status?: "completed" | "pending_approval" | "waitlisted" | "declined" | "cancelled" | "awaiting_payment" | "expired" };
    header = ["id", "created_at", "event_id", "event_title", "buyer_email", "kind", "status", "tickets", "amount_minor", "currency"];
    fetchPage = async (cursor) => {
      const p = data(await client.GET("/v1/admin/orders", { params: { query: { ...q, ...(cursor ? { cursor } : {}), limit: PAGE } } }));
      return { next: p.nextCursor, rows: p.items.map((o) => [o.id, o.createdAt, o.event.id, o.event.title, o.buyerEmail, o.kind, o.status, o.tickets, o.amountMinor, o.currency]) };
    };
  } else {
    return new Response("Not found", { status: 404 });
  }

  const rows: unknown[][] = [];
  try {
    let cursor: string | undefined;
    do {
      const page = await fetchPage(cursor);
      rows.push(...page.rows);
      cursor = page.next ?? undefined;
    } while (cursor && rows.length < MAX_ROWS);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 401)) return new Response("Not found", { status: 404 });
    if (error instanceof ApiError && error.code === "auth.mfa_required") return Response.redirect(new URL(`/account/security?next=/admin/${list}`, url), 303);
    throw error;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(header, rows.slice(0, MAX_ROWS)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gventz-${list}-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
