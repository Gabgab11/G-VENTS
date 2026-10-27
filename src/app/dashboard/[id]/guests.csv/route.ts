import { NextResponse, type NextRequest } from "next/server";
import { apiFetch } from "@/lib/api/server";
import { isUuid } from "@/lib/forms";

// The guest list as CSV (I3), streamed from gventz-api with the signed-in user's token. The API
// allows owners, admins and finance; it audits each export and caps it at 50,000 rows.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return new NextResponse("Not found", { status: 404 });
  const res = await apiFetch(`/v1/events/${id}/guests.csv`);
  if (!res.ok || !res.body) {
    const message = res.status === 403 ? "Only the owner, admins and finance can export the guest list." : res.status === 404 ? "Not found" : "The export didn't work. Please try again.";
    return new NextResponse(message, { status: res.status === 403 || res.status === 404 ? res.status : 502, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new NextResponse(res.body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": res.headers.get("content-disposition") ?? 'attachment; filename="guests.csv"',
      "cache-control": "no-store",
    },
  });
}
