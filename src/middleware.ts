import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, supabaseSecretKey } from "@/lib/env";
import { onCloudflare } from "@/lib/platform";
import { authCookieOptions, forwardedIp, supabaseKeyAndHeaders } from "@/lib/supabase/options";

// Refreshes the signed-in session cookie so users stay logged in.
// Visitors without a Supabase session cookie have nothing to refresh, so they skip the auth round trip.
// Maintenance switch for the go-live cut-over (gventz-api docs/runbooks/go-live.md): with
// MAINTENANCE_MODE=1 every page answers 503 with a short notice, so nothing writes while the data moves.
// Staff checking the new setup get through with a `gventz_bypass` cookie equal to MAINTENANCE_BYPASS.
const MAINTENANCE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>G-ventZ is updating</title></head><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f0f0f;color:#f4f4f4;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;text-align:center;padding:24px"><div><h1 style="font-size:28px;margin:0 0 12px">We're updating G-ventZ</h1><p style="margin:0;color:#a8a8a8;font-size:16px;line-height:1.6">We'll be back in a few minutes. Your tickets are safe.</p></div></body></html>`;

// Plain http → https on this site's own hosts. Vercel did this at its edge; on Cloudflare it is a zone
// setting (Always Use HTTPS) that the app can't see or test, so the app enforces it too. Only the
// site's host and its www (from NEXT_PUBLIC_SITE_URL, never the request's Host header, so this can't
// redirect anywhere else) and only when the site is https, so localhost and previews are untouched.
// The target is always the site's own origin, which also folds http://www into the apex.
export function httpsRedirect(request: NextRequest): NextResponse | null {
  let site: URL;
  try {
    site = new URL(env.siteUrl);
  } catch {
    return null;
  }
  if (site.protocol !== "https:") return null;
  const host = request.nextUrl.hostname;
  if (host !== site.hostname && host !== `www.${site.hostname}`) return null;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim().toLowerCase() || request.nextUrl.protocol.replace(/:$/, "");
  if (proto !== "http") return null;
  return NextResponse.redirect(new URL(request.nextUrl.pathname + request.nextUrl.search, site.origin), 301);
}

// Information pages: no session and no maintenance notice (they were outside the matcher before the
// https redirect needed every page).
const INFO_PAGE = /^\/(?:pricing|help|terms|privacy|refunds)/;

export async function middleware(request: NextRequest) {
  const toHttps = httpsRedirect(request);
  if (toHttps) return toHttps;
  if (INFO_PAGE.test(request.nextUrl.pathname)) return NextResponse.next();

  const bypass = process.env.MAINTENANCE_BYPASS;
  const staff = !!bypass && bypass.length >= 16 && request.cookies.get("gventz_bypass")?.value === bypass;
  if (process.env.MAINTENANCE_MODE === "1" && !staff) {
    return new NextResponse(MAINTENANCE_HTML, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "retry-after": "600", "cache-control": "no-store" } });
  }
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!hasSession) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  // Same key, forwarded IP and cookie flags as src/lib/supabase/server.ts: session refreshes are
  // rate-limited per IP too.
  const { key, headers } = supabaseKeyAndHeaders({
    secretKey: supabaseSecretKey(),
    publishableKey: env.supabaseAnonKey,
    ip: forwardedIp((name) => request.headers.get(name), onCloudflare()),
  });
  const supabase = createServerClient(env.supabaseUrl, key, {
    cookieOptions: authCookieOptions(env.siteUrl),
    global: { headers },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Every page (for the https redirect); static assets are served before the Worker runs anyway.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
