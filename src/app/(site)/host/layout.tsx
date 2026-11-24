import { api, data } from "@/lib/api/server";
import { requireUser } from "@/lib/auth";
import { isThemeKey } from "@/lib/themes";
import ThemeStage from "@/components/ThemeStage";
import HostShell from "./HostShell";
import { envBadge } from "./shell/nav";

// The host area (Change 4 chunk 3, HA1; Change 5, FR-36): one shell for every /host page, with the
// TMI-style rail and grouped panel on desktop and a bottom tab bar on phones (D87, D95). Signed-out
// visitors go to sign-in and come back here. The host's dashboard style (Settings → Appearance, D85)
// paints the whole area. The shell's words come from the host.shell messages on the client.
export default async function HostLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser("/host");
  const me = await (await api()).GET("/v1/me").then(data).catch(() => null);
  const theme = isThemeKey(me?.dashboardTheme) ? me.dashboardTheme : "minimal";
  return (
    <>
      <ThemeStage theme={theme} />
      <HostShell
        userId={user.id}
        name={me?.fullName || me?.email || user.email || ""}
        isStaff={me?.isStaff === true}
        env={envBadge(process.env.APP_ENV, process.env.NODE_ENV)}
      >
        {children}
      </HostShell>
    </>
  );
}
