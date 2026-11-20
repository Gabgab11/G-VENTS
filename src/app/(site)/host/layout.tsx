import { getTranslations } from "next-intl/server";
import { api, data } from "@/lib/api/server";
import { requireUser } from "@/lib/auth";
import { isThemeKey } from "@/lib/themes";
import ThemeStage from "@/components/ThemeStage";
import HostShell from "./HostShell";

// The host area (Change 4 chunk 3, HA1): one shell for every /host page, with a sidebar on desktop
// and a bottom tab bar on phones (D87). Signed-out visitors go to sign-in and come back here.
// The host's dashboard style (Settings → Appearance, D85) paints the whole area.
export default async function HostLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/host");
  const [me, t] = await Promise.all([
    (await api()).GET("/v1/me").then(data).catch(() => null),
    getTranslations("host.shell"),
  ]);
  const theme = isThemeKey(me?.dashboardTheme) ? me.dashboardTheme : "minimal";
  return (
    <>
      <ThemeStage theme={theme} />
      <HostShell
        name={me?.fullName || me?.email || ""}
        email={me?.email ?? ""}
        isStaff={me?.isStaff === true}
        labels={{
          skip: t("skip"), signOut: t("signOut"), homepage: t("homepage"), nav: t("nav"), home: t("home"), events: t("events"), orders: t("orders"),
          payouts: t("payouts"), settings: t("settings"), admin: t("admin"), scan: t("scan"), more: t("more"),
          viewSite: t("viewSite"), myTickets: t("myTickets"), account: t("account"), close: t("close"),
        }}
      >
        {children}
      </HostShell>
    </>
  );
}
