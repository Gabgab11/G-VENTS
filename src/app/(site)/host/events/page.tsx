import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarPlus, ExternalLink, ScanLine } from "lucide-react";
import { api, data } from "@/lib/api/server";
import type { components } from "@/lib/api/schema";
import { formatDateTime, formatMoney } from "@/lib/format";
import { themeBackground } from "@/lib/themes";
import { localizedPath } from "@/i18n/routing";
import type { Locale } from "@/i18n/languages";
import ShareButton from "@/components/ShareButton";
import { Badge, Banner, Button, Card, EmptyState, PageHeader, TabLink, TabLinks, type BadgeTone } from "@/design";
import { EVENT_FILTERS, filterOf, listHref, pageOf, roleCanCheckIn, roleCanEdit, soldText, sumByCurrency, type GrossLine } from "./events-list";
import RowMenu from "./RowMenu";
import styles from "./events.module.css";

// The API adds `capacity` and `gross` to GET /v1/me/events (chunk 3); optional until schema.d.ts is regenerated.
type HostEvent = components["schemas"]["HostEventDto"] & { capacity?: number | null; gross?: GrossLine[] };

const ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;
const SMALL_ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
const TONE: Record<HostEvent["status"], BadgeTone> = { draft: "warning", published: "success", cancelled: "danger" };

// The host's events (HA3): owned, or where they hold a role. Filters and pages are links, so
// Back works; quick settings (publish, visibility, attendee count) live in the event workspace.
export default async function HostEventsPage({ searchParams }: { searchParams: Promise<{ filter?: string; page?: string; deleted?: string }> }) {
  const sp = await searchParams;
  const filter = filterOf(sp.filter);
  const page = pageOf(sp.page);
  const query = { page, pageSize: 50, filter } as { page: number; pageSize: number };
  const [list, t, lang] = await Promise.all([
    (await api()).GET("/v1/me/events", { params: { query } }).then(data),
    getTranslations("dashboard"),
    getLocale() as Promise<Locale>,
  ]);
  const items = list.items as HostEvent[];
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const n = (x: number) => x.toLocaleString(lang);

  return (
    <>
      <PageHeader title={t("events.title")} actions={<Button href="/host/events/new" variant="primary">{t("events.create")}</Button>} />

      {sp.deleted === "1" && <Banner tone="success" title={t("list.deleted")} role="status" />}

      <TabLinks aria-label={t("events.filtersLabel")} className={styles.filters}>
        {EVENT_FILTERS.map((f) => <TabLink key={f} href={listHref(f)} active={f === filter}>{t(`events.filter.${f}`)}</TabLink>)}
      </TabLinks>

      {items.length === 0 ? (
        <Card>
          <EmptyState icon={<CalendarPlus {...ICON} />} title={t(`events.empty.${filter}.title`)}
            action={filter === "all" || filter === "upcoming" ? <Button href="/host/events/new" size="sm" variant="primary">{t("events.create")}</Button> : undefined}>
            {t(`events.empty.${filter}.body`)}
          </EmptyState>
        </Card>
      ) : (
        <ul className={styles.list} aria-label={t("events.listLabel")}>
          {items.map((e) => {
            const gross = sumByCurrency(e.gross);
            const scan = e.status === "published" && roleCanCheckIn(e.role);
            const publicPath = localizedPath(`/e/${encodeURIComponent(e.slug)}`, lang);
            const when = formatDateTime(e.startsAt, e.timeZone, lang, "short");
            const place = e.isOnline ? t("events.online") : [e.venueName, e.city].filter(Boolean).join(", ") || t("events.noPlace");
            return (
              <li key={e.id} className={styles.row}>
                <span className={styles.thumb} style={{ background: themeBackground(e.coverTheme) }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- flyers come from storage at arbitrary sizes */}
                  {e.coverUrl && <img src={e.coverUrl} alt="" />}
                </span>
                <div className={styles.main}>
                  <Link href={`/host/events/${e.id}`} className={styles.title}>{e.title}</Link>
                  <span className={styles.muted}>{when}</span>
                  <span className={styles.muted}>{place}</span>
                  <span className={styles.badges}>
                    <Badge tone={TONE[e.status]}>{t(`status.${e.status}`)}</Badge>
                    {e.visibility === "private" && <Badge tone="neutral">{t("visibility.private")}</Badge>}
                  </span>
                </div>
                <dl className={styles.figures}>
                  <div>
                    <dt>{t("events.sold")}</dt>
                    <dd>{soldText(e.confirmedCount, e.capacity, n)}</dd>
                  </div>
                  {gross.length > 0 && (
                    <div>
                      <dt>{t("events.revenue")}</dt>
                      {gross.map((g) => <dd key={g.currency}>{formatMoney(g.grossMinor, g.currency, lang, true)}</dd>)}
                    </div>
                  )}
                </dl>
                <div className={styles.actions}>
                  {e.status !== "draft" && (
                    <Button href={publicPath} size="sm" variant="ghost" className={styles.wide} aria-label={t("events.viewLabel", { title: e.title })}>
                      <ExternalLink {...SMALL_ICON} />{t("events.view")}
                    </Button>
                  )}
                  {e.status === "published" && (
                    <ShareButton variant="icon" path={publicPath} title={e.title} qr={{ title: e.title, subtitle: formatDateTime(e.startsAt, e.timeZone, lang, "long") }} />
                  )}
                  {scan && (
                    <Button href={`/host/events/${e.id}/scan`} size="sm" variant="secondary" className={styles.wide} aria-label={t("events.scanLabel", { title: e.title })}>
                      <ScanLine {...SMALL_ICON} />{t("events.scan")}
                    </Button>
                  )}
                  <RowMenu
                    id={e.id}
                    viewHref={e.status !== "draft" ? publicPath : null}
                    scan={scan}
                    edit={roleCanEdit(e.role)}
                    labels={{ more: t("events.moreLabel", { title: e.title }), manage: t("events.manage"), edit: t("events.edit"), view: t("events.view"), scan: t("events.scan") }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav className={styles.pages} aria-label={t("list.pagesLabel")}>
          {page > 1 ? <Button href={listHref(filter, page - 1)} size="sm">{t("pagination.previous")}</Button> : <span />}
          <span className={styles.muted}>{t("pagination.page", { page, pages })}</span>
          {page < pages ? <Button href={listHref(filter, page + 1)} size="sm">{t("pagination.next")}</Button> : <span />}
        </nav>
      )}
    </>
  );
}
