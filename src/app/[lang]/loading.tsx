import { useTranslations } from "next-intl";

export default function Loading() {
  const t = useTranslations("shared");
  return (
    <main className="wrap page" aria-busy="true">
      <p className="muted" role="status">{t("loading")}</p>
    </main>
  );
}
