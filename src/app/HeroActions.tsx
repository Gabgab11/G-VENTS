"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSession } from "@/lib/use-session";

// The home hero's buttons. The page is cached and shared, so who's looking is decided in the
// browser: hosts (who already have an event) get "Create event" and their dashboard instead of
// "Create your first event".
export default function HeroActions({ createHref }: { createHref: string }) {
  const t = useTranslations("home.hero");
  const { isHost } = useSession();
  return (
    <div className="hp-actions">
      <Link href={createHref} className="hp-btn">{isHost ? t("createEvent") : t("createFirst")}</Link>
      {isHost
        ? <Link href="/host" className="hp-ghost">{t("dashboard")}</Link>
        : <Link href="/discover" className="hp-ghost">{t("browse")}</Link>}
    </div>
  );
}
