import { Button } from "@/design";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("shared.notFound");
  return (
    <main className="wrap page">
      <h1>{t("title")}</h1>
      <p className="muted">{t("body")}</p>
      <div className="actions">
        <Button href="/discover" variant="primary">{t("discover")}</Button>
        <Button href="/" variant="secondary">{t("home")}</Button>
      </div>
    </main>
  );
}
