import Link from "next/link";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("shared.notFound");
  return (
    <main className="wrap page">
      <h1>{t("title")}</h1>
      <p className="muted">{t("body")}</p>
      <div className="actions">
        <Link href="/discover" className="btn-white">{t("discover")}</Link>
        <Link href="/" className="btn-ghost">{t("home")}</Link>
      </div>
    </main>
  );
}
