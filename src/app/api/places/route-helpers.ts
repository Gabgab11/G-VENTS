import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlacesError, rateLimited } from "@/lib/places";

// Shared checks for the /api/places routes: signed-in hosts only, rate limited,
// never cached, and errors returned as a short code the form can explain.

export const SESSION = /^[A-Za-z0-9-]{8,64}$/;

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function signedInUser(): Promise<{ id: string } | Response> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "signed_out" }, 401);
  if (await rateLimited(supabase, user.id)) return json({ error: "rate_limited" }, 429);
  return { id: user.id };
}

export function placesFailure(error: unknown) {
  if (error instanceof PlacesError && error.code === "not_configured") {
    return json({ error: "not_configured" }, 503);
  }
  console.error("[places]", error);
  return json({ error: "unavailable" }, 502);
}
