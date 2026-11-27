import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { api, data } from "@/lib/api/server";
import { requireUser } from "@/lib/auth";
import { intlLocale } from "@/lib/format";
import { mfaState } from "@/lib/mfa";
import { isPhoneCountry, phoneCountryOptions, splitPhone } from "@/lib/phone";
import { LANGUAGE_INFO, enabledLanguages, type Locale } from "@/i18n/languages";
import SiteHeader from "@/components/SiteHeader";
import ToastArea from "@/components/ToastArea";
import { PageHeader } from "@/design";
import { emailPreferencesFrom } from "./account-input";
import ProfileSection from "./ProfileSection";
import PreferencesSection from "./PreferencesSection";
import SecuritySection from "./SecuritySection";
import SessionsSection from "./SessionsSection";
import s from "./account.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.page");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

// Your account (Change 5 chunk 3, FR-35, D93) for everyone signed in, guests and hosts alike:
// profile, preferences, sign-in & security (passwordless, D94) and sessions. The normal site layout,
// not the host area. Hosts keep their public profile and Settings → Security under /host/settings.
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ security?: string; sessions?: string }> }) {
  const sp = await searchParams;
  await requireUser("/account");
  const [me, mfa, lang, t] = await Promise.all([
    (await api()).GET("/v1/me").then(data),
    mfaState(),
    getLocale() as Promise<Locale>,
    getTranslations("account.page"),
  ]);

  const country = isPhoneCountry(me.country) ? me.country.toUpperCase() : "NG";
  const phone = splitPhone(me.phone, country) ?? { country, national: "" };
  const languages = enabledLanguages().map((code) => ({ code, name: LANGUAGE_INFO[code].name }));
  const dateLocale = intlLocale(lang, "date");
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "numeric" });

  return (
    <ToastArea>
      <SiteHeader back="/" />
      <main className={s.page}>
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <ProfileSection
          email={me.email}
          fullName={me.fullName ?? ""}
          avatarUrl={me.avatarUrl}
          phone={phone}
          countries={phoneCountryOptions(lang)}
          gender={me.gender}
        />
        <PreferencesSection language={lang} options={languages} email={emailPreferencesFrom(me.emailPreferences)} />
        <SecuritySection mfa={mfa} status={sp.security} formatDate={formatDate} />
        <SessionsSection failed={sp.sessions === "failed"} />
      </main>
    </ToastArea>
  );
}
