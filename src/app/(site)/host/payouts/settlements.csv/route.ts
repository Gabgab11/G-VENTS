import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { apiFetch } from "@/lib/api/server";

// Settlements across the host's events as CSV (D84), streamed from gventz-api with the signed-in
// user's token: one row per paid order, money in minor units, buyer emails masked. The API scopes it
// to events where the caller may see sales, caps it at 50,000 rows and logs each export.
export async function GET() {
  const t = await getTranslations("dashboard.csv");
  const res = await apiFetch("/v1/host/settlements.csv");
  if (!res.ok || !res.body) {
    return new NextResponse(res.status === 403 ? t("forbidden") : t("failed"), { status: res.status === 403 ? 403 : 502, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new NextResponse(res.body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": res.headers.get("content-disposition") ?? 'attachment; filename="settlements.csv"',
      "cache-control": "no-store",
    },
  });
}
