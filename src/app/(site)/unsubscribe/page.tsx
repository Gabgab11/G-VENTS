import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { isUnsubscribeToken } from "@/lib/unsubscribe";
import UnsubscribeForm from "./UnsubscribeForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.unsubscribe");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const token = String((await searchParams).t ?? "").toLowerCase();
  const t = await getTranslations("auth.unsubscribe");
  return (
    <main className="auth-wrap">
      <div className="auth-card">
        {isUnsubscribeToken(token) ? (
          <UnsubscribeForm token={token} />
        ) : (
          <>
            <h1 className="auth-title">{t("invalidTitle")}</h1>
            <p className="muted">{t("invalidHint")}</p>
          </>
        )}
      </div>
    </main>
  );
}
