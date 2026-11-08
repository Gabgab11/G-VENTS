import "server-only";

import { api, data } from "@/lib/api/server";
import { isThemeKey } from "@/lib/themes";

// The organizer's chosen dashboard style, saved to their profile (GET /v1/me).
export async function getDashboardTheme(): Promise<string> {
  const me = await (await api()).GET("/v1/me").then(data).catch(() => null);
  const theme = me?.dashboardTheme;
  return isThemeKey(theme) ? theme : "minimal";
}
