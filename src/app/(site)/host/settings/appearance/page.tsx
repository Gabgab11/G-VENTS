import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { api, data } from "@/lib/api/server";
import { THEMES, isThemeKey } from "@/lib/themes";
import { Card, CardHeader } from "@/design";
import { setHostTheme } from "./actions";
import styles from "../settings.module.css";

// Settings → Appearance (D85): the style of the host area, moved here from the event dashboard.
export default async function AppearancePage() {
  const [me, t, names] = await Promise.all([
    (await api()).GET("/v1/me").then(data).catch(() => null),
    getTranslations("host.settings.appearance"),
    getTranslations("dashboard.themes"),
  ]);
  const current = isThemeKey(me?.dashboardTheme) ? me.dashboardTheme : "minimal";
  return (
    <Card as="section">
      <CardHeader title={t("title")} />
      <p className={styles.lead}>{t("hint")}</p>
      <form action={setHostTheme} className={styles.themes}>
        {Object.entries(THEMES).map(([key, theme]) => (
          <button key={key} type="submit" name="theme" value={key} className={styles.theme} aria-pressed={current === key}>
            <span className={styles.swatch} style={{ background: theme.grad }} aria-hidden="true" />
            <span>{names.has(key) ? names(key) : theme.label}</span>
            {current === key && <Check size={16} strokeWidth={1.75} aria-hidden className={styles.check} />}
          </button>
        ))}
      </form>
    </Card>
  );
}
