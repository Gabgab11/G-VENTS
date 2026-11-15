import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import RootShell, { baseMetadata, baseViewport } from "@/app/RootShell";
import { pickAreas, SITE_CLIENT_AREAS } from "@/i18n/messages";
import type { Catalogue } from "@/i18n/catalogue";
import type { Locale } from "@/i18n/languages";

// Root layout for everything that isn't a public page (sign-in, dashboard, account, orders, admin,
// ...): one address each, in the language the middleware chose from the cookie (synced with the
// profile at sign-in), the browser, or English; the admin dashboard is always English (FR-23, D69).
export const metadata = baseMetadata;
export const viewport = baseViewport;

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const lang = (await getLocale()) as Locale;
  const messages = (await getMessages()) as Catalogue;
  return (
    <RootShell lang={lang}>
      <NextIntlClientProvider messages={pickAreas(messages, SITE_CLIENT_AREAS)}>{children}</NextIntlClientProvider>
    </RootShell>
  );
}
