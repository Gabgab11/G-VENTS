import { cookies } from "next/headers";
import { api } from "@/lib/api/server";

// Whether this browser has a sign-in session, and whether it belongs to G-ventZ staff, for pages
// that are cached and shared by every visitor (the home page) and so can't decide "Sign in",
// "Dashboard" or "Admin" on the server. The session cookie is httpOnly, so the browser's
// JavaScript can't see it; this asks the server.
// Signed-in visitors cost one /v1/me call (the API decides who is staff); everyone else, none.
// An expired session just means the dashboard sends the visitor through sign-in.
export const dynamic = "force-dynamic";

const SESSION_COOKIE = /^sb-[^=]+-auth-token(?:\.\d+)?$/;

export async function GET() {
  const signedIn = (await cookies()).getAll().some((c) => SESSION_COOKIE.test(c.name) && c.value !== "");
  let isStaff = false;
  if (signedIn) {
    const me = await (await api()).GET("/v1/me").then((r) => r.data ?? null).catch(() => null);
    isStaff = me?.isStaff === true;
  }
  return Response.json({ signedIn, isStaff }, { headers: { "Cache-Control": "private, no-store" } });
}
