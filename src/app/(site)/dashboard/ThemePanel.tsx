import { getTranslations } from "next-intl/server";
import { THEMES } from "@/lib/themes";
import { setDashboardTheme } from "./actions";

export default async function ThemePanel({ current }: { current: string }) {
  const t = await getTranslations("dashboard");
  return (
    <section className="panel">
      <div className="panel-label">{t("themePanel.title")}</div>
      <p className="muted small">{t("themePanel.hint")}</p>
      <form action={setDashboardTheme} className="theme-picks">
        {Object.entries(THEMES).map(([key, theme]) => (
          <button key={key} type="submit" name="theme" value={key}
            className={`pick ${current === key ? "on" : ""}`} aria-pressed={current === key}
            style={{ background: theme.bg, color: theme.text, borderColor: theme.line }}>
            <span className="pick-dot" style={{ background: theme.grad }} />
            {t.has(`themes.${key}`) ? t(`themes.${key}`) : theme.label}
          </button>
        ))}
      </form>
    </section>
  );
}
