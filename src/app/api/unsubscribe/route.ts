import { unsubscribe, unsubscribeHost } from "@/lib/unsubscribe";

// One-click unsubscribe (RFC 8058): mail apps POST here from the List-Unsubscribe header of
// announcement emails (?t=) and followed hosts' "new event" emails (?h=, FR-32). Always 200 for a
// well-formed request, so the mail app doesn't retry.
export async function POST(request: Request): Promise<Response> {
  const search = new URL(request.url).searchParams;
  const host = search.get("h");
  const token = (host ?? search.get("t") ?? "").toLowerCase();
  const result = host !== null ? await unsubscribeHost(token) : await unsubscribe(token);
  if (!result.ok && result.reason === "failed") return new Response(null, { status: 503 });
  return new Response(null, { status: 200 });
}
