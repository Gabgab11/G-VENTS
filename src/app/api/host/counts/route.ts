import { apiFetch } from "@/lib/api/server";
import { NO_COUNTS, normalizeCounts } from "@/app/(site)/host/shell/nav";

// The host sidebar's counts (Change 5, FR-36.6): the browser asks here every 60 s and this asks
// gventz-api's GET /v1/host/counts with the signed-in user's token, so the browser never talks to the
// API (AD13). Until the API has the endpoint (404) the answer is all zeros, so the shell shows no
// badges rather than breaking. "private, no-store": the counts are the caller's own and change often.
export const dynamic = "force-dynamic";

const reply = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET() {
  try {
    const res = await apiFetch("/v1/host/counts");
    if (res.status === 404) return reply(NO_COUNTS);
    if (res.status === 401) return reply({ error: "signed_out" }, 401);
    if (!res.ok) {
      console.error(`[host-counts] API answered ${res.status}`);
      return reply({ error: "unavailable" }, 502);
    }
    return reply(normalizeCounts(await res.json().catch(() => null)));
  } catch (error) {
    console.error(`[host-counts] ${(error as Error).message}`);
    return reply({ error: "unavailable" }, 502);
  }
}
