import { NextResponse, type NextRequest } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { apiFetch } from "@/lib/api/server";
import { isUuid } from "@/lib/forms";
import { COLUMNS, translateHeader } from "../guests-csv";

// The guest list as CSV (I3), streamed from gventz-api with the signed-in user's token. The API
// allows owners, admins and finance; it audits each export and caps it at 50,000 rows. The header
// row's fixed columns are shown in the reader's language; the data stays as the API writes it.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("dashboard.csv");
  if (!isUuid(id)) return new NextResponse(t("notFound"), { status: 404 });
  const res = await apiFetch(`/v1/events/${id}/guests.csv`);
  if (!res.ok || !res.body) {
    const message = res.status === 403 ? t("forbidden") : res.status === 404 ? t("notFound") : t("failed");
    return new NextResponse(message, { status: res.status === 403 || res.status === 404 ? res.status : 502, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const lang = await getLocale();
  const body = lang === "en" ? res.body : translateHeader(res.body, COLUMNS.map((c) => t(`header.${c}`)));
  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": res.headers.get("content-disposition") ?? 'attachment; filename="guests.csv"',
      "cache-control": "no-store",
    },
  });
}
