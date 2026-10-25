import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { allowedPaths, verifySignature } from "@/lib/revalidate";

// Page refreshes requested by gventz-api after event changes and orders (U5). Signed with the
// shared REVALIDATE_SECRET; anything unsigned, stale or outside the public pages is refused.
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET ?? "";
  const body = await request.text();
  const timestamp = Number(request.headers.get("x-gventz-timestamp"));
  const signature = request.headers.get("x-gventz-signature") ?? "";
  if (body.length > 10_000 || !verifySignature(secret, body, timestamp, signature, Math.floor(Date.now() / 1000))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const paths = allowedPaths(body);
  if (!paths) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  for (const path of paths) revalidatePath(path);
  return NextResponse.json({ revalidated: paths });
}
