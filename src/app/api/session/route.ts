import { cookies, headers } from "next/headers";
import { LANGUAGE_COOKIE, preferredLanguage } from "@/i18n/resolve";
import { api } from "@/lib/api/server";

// Whether this browser has a sign-in session, and whether it belongs to G-ventZ staff, for pages
// that are cached and shared by every visitor (the home page) and so can't decide "Sign in",
// "Dashboard" or "Admin" on the server. The session cookie is httpOnly, so the browser's
// JavaScript can't see it; this asks the server.
// Signed-in visitors cost two API calls in parallel (staff, and whether they host any event); everyone else, none.
// An expired session just means the dashboard sends the visitor through sign-in.
export const dynamic = "force-dynamic";

const SESSION_COOKIE = /^sb-[^=]+-auth-token(?:\.\d+)?$/;

export async function GET() {
  const jar = await cookies();
  // The visitor's preferred language (cookie, then browser), for the "also in …" hint on cached pages (W8).
  const language = preferredLanguage(jar.get(LANGUAGE_COOKIE)?.value, (await headers()).get("accept-language"));
  const signedIn = jar.getAll().some((c) => SESSION_COOKIE.test(c.name) && c.value !== "");
  let isStaff = false;
  let isHost = false;
  if (signedIn) {
    const client = await api();
    // isHost: owns or helps run at least one event, so the Dashboard link and "Create event"
    // (not "Create your first event") make sense for them.
    const [me, events] = await Promise.all([
      client.GET("/v1/me").then((r) => r.data ?? null).catch(() => null),
      client.GET("/v1/me/events", { params: { query: { page: 1, pageSize: 1 } } }).then((r) => r.data ?? null).catch(() => null),
    ]);
    isStaff = me?.isStaff === true;
    isHost = (events?.total ?? 0) > 0;
  }
  return Response.json({ signedIn, isStaff, isHost, language }, { headers: { "Cache-Control": "private, no-store" } });
}
