"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED: Record<string, (v: string) => boolean> = {
  visibility: (v) => v === "public" || v === "private",
  show_attendee_count: (v) => v === "true" || v === "false",
  status: (v) => v === "published" || v === "draft" || v === "cancelled",
};

// Only the event owner or an admin/editor can change these (enforced by row-level security).
export async function updateEventSetting(eventId: string, field: string, value: string): Promise<{ error?: string }> {
  const check = ALLOWED[field];
  if (!check || !check(value)) return { error: "That setting cannot be changed." };

  const supabase = await createSupabaseServerClient();
  const update = field === "show_attendee_count" ? { [field]: value === "true" } : { [field]: value };
  const { error } = await supabase.from("events").update(update).eq("id", eventId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return {};
}

export async function setDashboardTheme(formData: FormData) {
  const theme = String(formData.get("theme") ?? "");
  const { THEMES } = await import("@/lib/themes");
  if (!(theme in THEMES)) return;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("profiles").update({ dashboard_theme: theme }).eq("id", user.id);
  revalidatePath("/dashboard", "layout");
}
