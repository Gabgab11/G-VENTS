// Discover only: unknown event and ticket pages need a real 404 status, which a loading screen above
// them would prevent (streaming sends 200 first), so [lang] itself has none (Change 4, FR-30.5).
import { useTranslations } from "next-intl";

export default function Loading() {
  const t = useTranslations("shared");
  return (
    <main className="wrap page" aria-busy="true">
      <p className="muted" role="status">{t("loading")}</p>
    </main>
  );
}
