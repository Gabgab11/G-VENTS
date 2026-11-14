import { cookies } from "next/headers";

// Whether this browser has a sign-in session, for pages that are cached and shared by every
// visitor (the home page) and so can't decide "Sign in" or "Dashboard" on the server.
// The session cookie is httpOnly, so the browser's JavaScript can't see it; this asks the server.
// Only the cookie's presence is checked (no call to Supabase): an expired session just means the
// dashboard sends the visitor through sign-in.
export const dynamic = "force-dynamic";

const SESSION_COOKIE = /^sb-[^=]+-auth-token(?:\.\d+)?$/;

export async function GET() {
  const signedIn = (await cookies()).getAll().some((c) => SESSION_COOKIE.test(c.name) && c.value !== "");
  return Response.json({ signedIn }, { headers: { "Cache-Control": "private, no-store" } });
}
