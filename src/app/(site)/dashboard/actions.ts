"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/server";
import { getLocale, getTranslations } from "next-intl/server";
import { problemMessage } from "@/lib/api/problem";
import { isUuid } from "@/lib/forms";
import { isThemeKey } from "@/lib/themes";

const ALLOWED: Record<string, (v: string) => boolean> = {
  visibility: (v) => v === "public" || v === "private",
  show_attendee_count: (v) => v === "true" || v === "false",
  status: (v) => v === "published",
};

// Quick toggles on the event list, through gventz-api (U6a). The API checks the caller's role on
// the event (publish: owner or admin; the others: event.edit) and answers with a message to show.
export async function updateEventSetting(eventId: string, field: string, value: string): Promise<{ error?: string }> {
  const check = Object.hasOwn(ALLOWED, field) ? ALLOWED[field] : undefined;
  const t = await getTranslations("dashboard.actions");
  if (!isUuid(eventId) || !check || !check(value)) return { error: t("settingLocked") };

  try {
    const client = await api();
    const params = { path: { id: eventId } };
    if (field === "status") await client.POST("/v1/events/{id}/publish", { params });
    else if (field === "visibility") await client.PATCH("/v1/events/{id}", { params, body: { visibility: value as "public" | "private" } });
    else await client.PATCH("/v1/events/{id}/settings", { params, body: { showAttendeeCount: value === "true" } });
  } catch (error) {
    return { error: problemMessage(error, await getTranslations("errors"), await getLocale(), t("saveFailed")) };
  }

  revalidatePath("/dashboard");
  return {};
}

export async function setDashboardTheme(formData: FormData) {
  const theme = formData.get("theme");
  if (!isThemeKey(theme)) return;
  try {
    await (await api()).PATCH("/v1/me", { body: { dashboardTheme: theme as never } });
  } catch (error) {
    console.error("[dashboard] set theme:", error);
  }
  revalidatePath("/dashboard", "layout");
}
