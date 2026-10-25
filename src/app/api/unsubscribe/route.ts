import { unsubscribe } from "@/lib/unsubscribe";

// One-click unsubscribe (RFC 8058): mail apps POST here from the List-Unsubscribe header of
// announcement emails. Always 200 for a well-formed request, so the mail app doesn't retry.
export async function POST(request: Request): Promise<Response> {
  const token = (new URL(request.url).searchParams.get("t") ?? "").toLowerCase();
  const result = await unsubscribe(token);
  if (!result.ok && result.reason === "failed") return new Response(null, { status: 503 });
  return new Response(null, { status: 200 });
}
