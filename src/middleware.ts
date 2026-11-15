import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, supabaseSecretKey } from "@/lib/env";
import { onCloudflare } from "@/lib/platform";
import { authCookieOptions, forwardedIp, supabaseKeyAndHeaders } from "@/lib/supabase/options";
import createIntlMiddleware from "next-intl/middleware";
import { chosenLanguageRedirect, routing, isEnglishPrefixed, isPublicPath, splitPrefix } from "@/i18n/routing";
import { LANGUAGE_COOKIE, LANGUAGE_HEADER, resolveLanguage } from "@/i18n/resolve";

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
// https redirect needed every page). Matched after any language prefix.
const INFO_PAGE = /^\/(?:pricing|help|terms|privacy|refunds)/;

// Per-language public pages (Change 3, W2): /fr/e/x is served from the [lang] tree; English has no
// prefix and is rewritten to /en internally. No redirects by language (FR-24.3).
const intl = createIntlMiddleware(routing);

/**
 * The language step (W2, W3). Public pages: next-intl's rewrite (or its redirect from /en/... to
 * the unprefixed address). Other pages: the language chosen from cookie → Accept-Language →
 * English, passed to the page in a request header (always overwritten, so it can't be spoofed).
 */
function withLanguage(request: NextRequest): { response: NextResponse; rebuild: () => NextResponse } {
  const path = request.nextUrl.pathname;
  if (isPublicPath(path) || isEnglishPrefixed(path)) {
    // A visitor who chose a language keeps it: /discover → /fr/discover for them.
    const chosen = chosenLanguageRedirect(path, request.cookies.get(LANGUAGE_COOKIE)?.value, routing.locales);
    if (chosen) {
      const url = request.nextUrl.clone();
      url.pathname = chosen;
      return { response: NextResponse.redirect(url, 307), rebuild: () => NextResponse.redirect(url, 307) };
    }
    const response = intl(request);
    const rewrite = response.headers.get("x-middleware-rewrite");
    return {
      response,
      // After the session refresh changed the request's cookies, forward them with the same rewrite.
      rebuild: () => (rewrite ? NextResponse.rewrite(new URL(rewrite), { request }) : NextResponse.next({ request })),
    };
  }
  const lang = resolveLanguage({ pathname: path, cookie: request.cookies.get(LANGUAGE_COOKIE)?.value, acceptLanguage: request.headers.get("accept-language") });
  request.headers.set(LANGUAGE_HEADER, lang);
  return { response: NextResponse.next({ request }), rebuild: () => NextResponse.next({ request }) };
}

export async function middleware(request: NextRequest) {
  const toHttps = httpsRedirect(request);
  if (toHttps) return toHttps;
  const info = INFO_PAGE.test(splitPrefix(request.nextUrl.pathname).rest);

  if (!info) {
    const bypass = process.env.MAINTENANCE_BYPASS;
    const staff = !!bypass && bypass.length >= 16 && request.cookies.get("gventz_bypass")?.value === bypass;
    if (process.env.MAINTENANCE_MODE === "1" && !staff) {
      return new NextResponse(MAINTENANCE_HTML, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "retry-after": "600", "cache-control": "no-store" } });
    }
  }

  const language = withLanguage(request);
  let response = language.response;
  // A redirect (e.g. /en/discover → /discover) or a 404 for a switched-off language: nothing else to do.
  if (response.status >= 300 && response.status < 400) return response;
  if (info) return response;

  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!hasSession) return response;

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
        response = language.rebuild();
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
