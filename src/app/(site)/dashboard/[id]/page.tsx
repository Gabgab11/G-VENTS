import Link from "next/link";
import { can, requireEvent } from "@/lib/auth";
import { env } from "@/lib/env";
import ThemeStage from "@/components/ThemeStage";
import ThemePanel from "../ThemePanel";
import { getDashboardTheme } from "../getTheme";
import OverviewTab from "./OverviewTab";
import GuestsTab, { type GuestQuery } from "./GuestsTab";
import RegistrationTab from "./RegistrationTab";
import AnnouncementsTab from "./AnnouncementsTab";
import SettingsTab from "./SettingsTab";
import { messageFor } from "./messages";
import SiteHeader from "@/components/SiteHeader";
import { api, data } from "@/lib/api/server";
import type { components } from "@/lib/api/schema";
import { DisputeBanner } from "./SalesPanel";
import { getLocale, getTranslations } from "next-intl/server";

type Sales = components["schemas"]["EventSalesDto"];

/** Paid sales from the ledger (M5), for roles that may see them; null otherwise or if unavailable. */
async function loadSales(event: Awaited<ReturnType<typeof requireEvent>>): Promise<Sales | null> {
  const paid = event.paymentCountry !== null || event.ticketTypes.some((t) => t.priceMinor > 0);
  if (!paid || !can(event, "sales.view")) return null;
  try {
    return data(await (await api()).GET("/v1/events/{id}/sales", { params: { path: { id: event.id } } }));
  } catch (error) {
    console.error(`[dashboard] sales: ${(error as Error).message}`);
    return null;
  }
}

const TABS = [
  { key: "overview" },
  { key: "guests" },
  { key: "registration" },
  { key: "announcements" },
  { key: "settings" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// The event dashboard, from gventz-api (U6b). Only the event's team gets here (others: 404);
// controls show according to the caller's permissions, and the API checks them again.
export default async function ManageEventPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; ok?: string; err?: string } & GuestQuery>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab: TabKey = TABS.find((t) => t.key === sp.tab)?.key ?? "overview";

  const [event, theme] = await Promise.all([requireEvent(id), getDashboardTheme()]);

  const sales = await loadSales(event);
  const url = `${env.siteUrl}/e/${event.slug}`;
  const [t, errors, lang] = await Promise.all([getTranslations("dashboard"), getTranslations("errors"), getLocale()]);
  const ok = messageFor(sp.ok, t, errors, lang);
  const err = messageFor(sp.err, t, errors, lang);
  const statusLabel = t(event.status === "draft" ? "status.draft" : event.status === "cancelled" ? "status.cancelled" : "status.published");

  return (
    <main className="wrap page wide stage-content">
      <ThemeStage theme={theme} />
      <SiteHeader back="/dashboard" />
      <h1>{event.title}</h1>
      <p className="muted small">{statusLabel} · {t(event.visibility === "private" ? "visibility.private" : "visibility.public")} · {t("event.youAre", { role: event.role })}</p>
      {event.status === "published" && can(event, "guests.checkIn") && (
        <p><Link href={`/dashboard/${id}/scan`} className="btn-grad">{t("event.scan")}</Link></p>
      )}

      {sales && <DisputeBanner disputes={sales.disputes} />}

      <nav className="tabs" aria-label={t("event.tabsLabel")}>
        {TABS.map((x) => (
          <Link key={x.key} href={`/dashboard/${id}?tab=${x.key}`} className={tab === x.key ? "on" : ""}
            aria-current={tab === x.key ? "page" : undefined}>{t(`event.tabs.${x.key}`)}</Link>
        ))}
      </nav>

      <ThemePanel current={theme} />

      {ok && <p className="ok" role="status">{ok}</p>}
      {err && <p className="error" role="alert">{err}</p>}

      {tab === "overview" && <OverviewTab event={event} url={url} sales={sales} />}
      {tab === "guests" && <GuestsTab event={event} query={sp} />}
      {tab === "registration" && <RegistrationTab event={event} url={url} />}
      {tab === "announcements" && <AnnouncementsTab event={event} />}
      {tab === "settings" && <SettingsTab event={event} />}
    </main>
  );
}
