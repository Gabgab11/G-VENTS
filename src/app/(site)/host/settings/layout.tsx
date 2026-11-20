import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/design";
import SettingsTabs from "./SettingsTabs";

// Settings (HA6): security, appearance (the dashboard style, D85) and language. Profile comes in chunk 4.
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("host.settings");
  return (
    <>
      <PageHeader title={t("title")} />
      <SettingsTabs label={t("tabsLabel")} tabs={[
        { href: "/host/settings/security", label: t("tabs.security") },
        { href: "/host/settings/appearance", label: t("tabs.appearance") },
        { href: "/host/settings/language", label: t("tabs.language") },
      ]} />
      {children}
    </>
  );
}
