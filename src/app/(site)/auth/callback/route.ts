import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/redirect";

// Google sign-in returns here with a one-time code. Exchanging it sets the session cookie, then
// the visitor continues to where they were going (same-site paths only).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error("[auth] google callback:", error.message);
  }
  const back = new URL("/sign-in", origin);
  back.searchParams.set("error", "google");
  back.searchParams.set("next", next);
  return NextResponse.redirect(back);
}
