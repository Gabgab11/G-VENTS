import { Button } from "@/design";
import { useTranslations } from "next-intl";

// The branded not-found page, answered with status 404 (unknown events and tickets call notFound()
// from their metadata, before anything streams).
export default function NotFound() {
  const t = useTranslations("shared.notFound");
  return (
    <main className="wrap page">
      {/* React hoists these into <head>: a not-found page has no metadata of its own. */}
      <title>{`${t("title")} · G-ventZ`}</title>
      <meta name="robots" content="noindex" />
      <h1>{t("title")}</h1>
      <p className="muted">{t("body")}</p>
      <div className="actions">
        <Button href="/discover" variant="primary">{t("discover")}</Button>
        <Button href="/" variant="secondary">{t("home")}</Button>
      </div>
    </main>
  );
}
