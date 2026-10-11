import { THEMES } from "@/lib/themes";
import { setDashboardTheme } from "./actions";

export default function ThemePanel({ current }: { current: string }) {
  return (
    <section className="panel">
      <div className="panel-label">Your dashboard style</div>
      <p className="muted small">Choose how your dashboard looks. Only you see this.</p>
      <form action={setDashboardTheme} className="theme-picks">
        {Object.entries(THEMES).map(([key, t]) => (
          <button key={key} type="submit" name="theme" value={key}
            className={`pick ${current === key ? "on" : ""}`}
            style={{ background: t.bg, color: t.text, borderColor: t.line }}>
            <span className="pick-dot" style={{ background: t.grad }} />
            {t.label}
          </button>
        ))}
      </form>
    </section>
  );
}
