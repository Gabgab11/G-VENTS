"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MANAGE_ROLES } from "@/lib/auth";
import { isUuid } from "@/lib/forms";
import { isThemeKey } from "@/lib/themes";

const ALLOWED: Record<string, (v: string) => boolean> = {
  visibility: (v) => v === "public" || v === "private",
  show_attendee_count: (v) => v === "true" || v === "false",
  status: (v) => v === "published",
};

// Quick toggles on the event list. The caller must manage the event; RLS and the
// events_guard trigger enforce the same rules in the database.
export async function updateEventSetting(eventId: string, field: string, value: string): Promise<{ error?: string }> {
  const check = Object.hasOwn(ALLOWED, field) ? ALLOWED[field] : undefined;
  if (!isUuid(eventId) || !check || !check(value)) return { error: "That setting cannot be changed." };

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has ended. Sign in again." };

  const { data: allowed } = await supabase.rpc("has_event_role", { p_event: eventId, p_roles: MANAGE_ROLES });
  if (!allowed) return { error: "You don't have permission to change this event." };

  const update = field === "show_attendee_count" ? { [field]: value === "true" } : { [field]: value };
  const { data, error } = await supabase.from("events").update(update).eq("id", eventId).select("id");
  if (error) {
    console.error(`[dashboard] update setting ${field}: ${error.message}`);
    return { error: "Couldn't save that change. Please try again." };
  }
  if (!data?.length) return { error: "Nothing was saved. You may not have permission to change this event." };

  revalidatePath("/dashboard");
  return {};
}

export async function setDashboardTheme(formData: FormData) {
  const theme = formData.get("theme");
  if (!isThemeKey(theme)) return;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from("profiles").update({ dashboard_theme: theme }).eq("id", user.id);
  if (error) console.error(`[dashboard] set theme: ${error.message}`);
  revalidatePath("/dashboard", "layout");
}
