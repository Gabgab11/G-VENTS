import { createSupabaseServerClient } from "@/lib/supabase/server";

// The organizer's chosen dashboard style, saved to their profile.
export async function getDashboardTheme(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string) {
  const { data } = await supabase.from("profiles").select("dashboard_theme").eq("id", userId).maybeSingle();
  return data?.dashboard_theme ?? "minimal";
}
