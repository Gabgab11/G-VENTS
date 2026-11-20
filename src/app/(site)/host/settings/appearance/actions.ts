"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/server";
import { isThemeKey } from "@/lib/themes";

// The host area's style (D85), saved to the profile; it paints every /host page.
export async function setHostTheme(formData: FormData) {
  const theme = formData.get("theme");
  if (!isThemeKey(theme)) return;
  try {
    await (await api()).PATCH("/v1/me", { body: { dashboardTheme: theme as never } });
  } catch (error) {
    console.error("[host] set theme:", error);
  }
  revalidatePath("/host", "layout");
}
