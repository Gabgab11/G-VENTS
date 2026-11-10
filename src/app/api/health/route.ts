import { serverEnv } from "@/lib/env";

// Website → API wiring check for the release pipeline (promote.yml smoke test) and uptime monitors:
// 200 only when this deployment can reach gventz-api and the API reports itself ready.
// Pages stream behind a loading screen, so their status codes don't show an API outage.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  let ok = false;
  try {
    const res = await fetch(`${serverEnv().apiUrl}/health/ready`, { cache: "no-store", signal: AbortSignal.timeout(5_000) });
    ok = res.ok;
  } catch {
    ok = false;
  }
  return Response.json({ website: "ok", api: ok ? "ok" : "unavailable" }, { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
