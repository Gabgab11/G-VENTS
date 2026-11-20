import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardHeader } from "@/design";
import { LANGUAGE_INFO, enabledLanguages, type Locale } from "@/i18n/languages";
import LanguageChoice from "./LanguageChoice";
import styles from "../settings.module.css";

// Settings → Language: the same setting as the footer's language menu (saved to the profile at sign-in).
export default async function LanguagePage() {
  const [t, lang] = await Promise.all([getTranslations("host.settings.language"), getLocale() as Promise<Locale>]);
  const options = enabledLanguages().map((l) => ({ code: l, name: LANGUAGE_INFO[l].name }));
  return (
    <Card as="section">
      <CardHeader title={t("title")} />
      <p className={styles.lead}>{t("hint")}</p>
      <LanguageChoice current={lang} options={options} label={t("title")} />
    </Card>
  );
}
