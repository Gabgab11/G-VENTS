import { cleanQuery, NO_RESULTS } from "@/components/search/types";
import { searchApi, SearchUnavailable } from "@/components/search/server";
import { DEFAULT_LANGUAGE, isLanguage } from "@/i18n/languages";

// The command palette's search (FR-34): the browser asks here and this asks gventz-api's public
// GET /v1/search, so the browser never talks to the API (AD13). The browser keeps an answer for
// 30 seconds (retyping the same text costs nothing); "private", because the middleware may attach a
// refreshed session cookie to any response, which a shared cache must never store.
export const dynamic = "force-dynamic";

const LIMIT = 6;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = cleanQuery(params.get("q"));
  const langParam = params.get("lang");
  const lang = isLanguage(langParam) ? langParam : DEFAULT_LANGUAGE;
  if (!q) return Response.json(NO_RESULTS, { headers: { "Cache-Control": "private, max-age=300" } });
  try {
    const results = await searchApi(q, lang, LIMIT);
    return Response.json(results, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch (error) {
    const status = error instanceof SearchUnavailable && error.status === 429 ? 429 : 502;
    if (!(error instanceof SearchUnavailable)) console.error("[search] API call failed", error);
    return Response.json({ error: status === 429 ? "rate_limited" : "unavailable" }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
