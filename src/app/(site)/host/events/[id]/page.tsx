import NextLink from "next/link";
import { ChevronLeft, ExternalLink, ScanLine } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { can, requireEvent } from "@/lib/auth";
import { env } from "@/lib/env";
import { api, data } from "@/lib/api/server";
import type { components } from "@/lib/api/schema";
import { formatDateTime } from "@/lib/format";
import { localizedPath } from "@/i18n/routing";
import type { Locale } from "@/i18n/languages";
import ShareButton from "@/components/ShareButton";
import { Badge, Banner, Button, PageHeader, TabLink, TabLinks, type BadgeTone } from "@/design";
import OverviewTab from "./OverviewTab";
import GuestsTab, { type GuestQuery } from "./GuestsTab";
import DetailsTab from "./DetailsTab";
import RegistrationTab from "./RegistrationTab";
import AnnouncementsTab from "./AnnouncementsTab";
import SettingsTab from "./SettingsTab";
import WorkspaceMenu from "./WorkspaceMenu";
import { DisputeBanner } from "./SalesPanel";
import { messageFor } from "./messages";
import styles from "./workspace.module.css";

type Sales = components["schemas"]["EventSalesDto"];

/** Paid sales from the ledger (M5), for roles that may see them; null otherwise or if unavailable. */
async function loadSales(event: Awaited<ReturnType<typeof requireEvent>>): Promise<Sales | null> {
  const paid = event.paymentCountry !== null || event.ticketTypes.some((t) => t.priceMinor > 0);
  if (!paid || !can(event, "sales.view")) return null;
  try {
    return data(await (await api()).GET("/v1/events/{id}/sales", { params: { path: { id: event.id } } }));
  } catch (error) {
    console.error(`[host/events] sales: ${(error as Error).message}`);
    return null;
  }
}

const TABS = ["overview", "guests", "details", "registration", "announcements", "settings"] as const;
type TabKey = (typeof TABS)[number];

const TONE: Record<"draft" | "published" | "cancelled", BadgeTone> = { draft: "warning", published: "success", cancelled: "danger" };
const SMALL_ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

// The event workspace (HA4), replacing /dashboard/{id}. Only the event's team gets here (others:
// 404); controls show according to the caller's permissions, and the API checks them again.
export default async function EventWorkspacePage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; ok?: string; err?: string } & GuestQuery>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const event = await requireEvent(id);
  const tabs = TABS.filter((k) => k !== "details" || can(event, "event.edit"));
  const tab: TabKey = tabs.find((k) => k === sp.tab) ?? "overview";

  const [sales, t, errors, lang] = await Promise.all([
    loadSales(event),
    getTranslations("dashboard"),
    getTranslations("errors"),
    getLocale() as Promise<Locale>,
  ]);
  const url = `${env.siteUrl}/e/${event.slug}`;
  const ok = messageFor(sp.ok, t, errors, lang);
  const err = messageFor(sp.err, t, errors, lang);
  const publicPath = localizedPath(`/e/${encodeURIComponent(event.slug)}`, lang);
  const scan = event.status === "published" && can(event, "guests.checkIn");

  return (
    <>
      <NextLink href="/host/events" className={styles.back}>
        <ChevronLeft {...SMALL_ICON} className={styles.backIcon} />{t("workspace.back")}
      </NextLink>
      <PageHeader
        title={event.title}
        subtitle={
          <span className={styles.meta}>
            <Badge tone={TONE[event.status]}>{t(`status.${event.status}`)}</Badge>
            <Badge tone="neutral" plain>{t(event.visibility === "private" ? "visibility.private" : "visibility.public")}</Badge>
            <span>{t("event.youAre", { role: event.role })}</span>
          </span>
        }
        actions={
          <>
            {event.status !== "draft" && (
              <Button href={publicPath} variant="secondary"><ExternalLink {...SMALL_ICON} />{t("workspace.view")}</Button>
            )}
            {event.status === "published" && (
              <ShareButton path={publicPath} title={event.title} qr={{ title: event.title, subtitle: formatDateTime(event.startsAt, event.timeZone, lang, "long") }} />
            )}
            {scan && <Button href={`/host/events/${id}/scan`} variant="accent"><ScanLine {...SMALL_ICON} />{t("workspace.scan")}</Button>}
            <WorkspaceMenu
              id={id}
              edit={can(event, "event.edit")}
              cancel={can(event, "event.cancel") && event.status !== "cancelled"}
              remove={can(event, "event.delete")}
              labels={{ more: t("workspace.more"), edit: t("workspace.edit"), cancel: t("workspace.cancel"), remove: t("workspace.delete") }}
            />
          </>
        }
      />

      {sales && <DisputeBanner disputes={sales.disputes} />}

      <TabLinks aria-label={t("event.tabsLabel")} className={styles.tabs}>
        {tabs.map((k) => (
          <TabLink key={k} href={`/host/events/${id}?tab=${k}`} active={tab === k} count={k === "guests" ? event.counts.confirmed.toLocaleString(lang) : undefined}>
            {t(`event.tabs.${k}`)}
          </TabLink>
        ))}
      </TabLinks>

      {ok && <Banner tone="success" title={ok} role="status" />}
      {err && <Banner tone="danger" title={err} />}

      {tab === "overview" && <OverviewTab event={event} url={url} sales={sales} />}
      {tab === "guests" && <GuestsTab event={event} query={sp} />}
      {tab === "details" && <DetailsTab event={event} />}
      {tab === "registration" && <RegistrationTab event={event} url={url} />}
      {tab === "announcements" && <AnnouncementsTab event={event} />}
      {tab === "settings" && <SettingsTab event={event} />}
    </>
  );
}
