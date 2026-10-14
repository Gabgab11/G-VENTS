import type { SupabaseServerClient } from "@/lib/supabase/server";
import { isThemeKey } from "@/lib/themes";

// The organizer's chosen dashboard style, saved to their profile.
export async function getDashboardTheme(supabase: SupabaseServerClient, userId: string) {
  const { data } = await supabase.from("profiles").select("dashboard_theme").eq("id", userId).maybeSingle();
  const theme = data?.dashboard_theme;
  return isThemeKey(theme) ? theme : "minimal";
}
