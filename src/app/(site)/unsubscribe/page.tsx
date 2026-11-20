import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { isUnsubscribeToken } from "@/lib/unsubscribe";
import UnsubscribeForm from "./UnsubscribeForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.unsubscribe");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string; h?: string }> }) {
  // ?t= from announcement emails; ?h= from a followed host's "new event" email (FR-32).
  const sp = await searchParams;
  const kind = sp.h !== undefined && sp.t === undefined ? "host" : "event";
  const token = String((kind === "host" ? sp.h : sp.t) ?? "").toLowerCase();
  const t = await getTranslations("auth.unsubscribe");
  return (
    <main className="auth-wrap">
      <div className="auth-card">
        {isUnsubscribeToken(token) ? (
          <UnsubscribeForm token={token} kind={kind} />
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
