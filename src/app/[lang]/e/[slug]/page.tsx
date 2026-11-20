import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreditCard, Mail, RotateCcw } from "lucide-react";
import { withAlternates } from "@/i18n/seo";
import { localizedPath } from "@/i18n/routing";
import { getFormat } from "@/i18n/format-server";
import type { Locale } from "@/i18n/languages";
import { categoryLabelKey, isCategory } from "@/lib/categories";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { themeBackground } from "@/lib/themes";
import { loadEventPage } from "@/lib/event-page";
import { buildEventMetadata, clip, firstLine } from "@/lib/event-metadata";
import { lowestPrice, priceLabel } from "@/lib/price-label";
import { env } from "@/lib/env";
import { shareCardPath } from "@/lib/share";
import { profilePath } from "@/lib/host-profile";
import ThemeStage from "@/components/ThemeStage";
import SiteHeader from "@/components/SiteHeader";
import ShareButton from "@/components/ShareButton";
import { Avatar, Badge, Banner, Button, Card, cx } from "@/design";
import { eventCta, orderableTypes, type EventCta } from "./event-cta";
import AboutSection from "./AboutSection";
import TicketTypeInfo from "./tickets/TicketTypeInfo";
import { groupSizeOf, isSoldOut } from "@/lib/group-tickets";
import Gallery from "./Gallery";
import { bookingPath, eventDate, eventPath, eventPlace } from "./event-view";
import { codeParam, withCode } from "./tickets/discount-code";
import s from "./EventPage.module.css";

// The public event page from gventz-api (U6a), as a summary (Change 4 chunk 3b): the pictures and host on
// the left; the date, place, a short description, the ticket types with their prices and ONE main
// button on the right; then "About & directions". Getting tickets happens on the booking page
// (./tickets). The API decides who may see drafts and whether the attendee count is shown.
// generateMetadata resolves before the page starts streaming (and before [lang]/loading.tsx is
// shown), so notFound() here makes an unknown event a real 404 (Step 11). The event is loaded once per
// request and shared with the page (loadEventPage is React-cached).
export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const event = await loadEventPage(slug);
  if (!event) notFound();
  const locale = lang as Locale;
  const [t, shared, { alternates }] = await Promise.all([
    getTranslations({ locale, namespace: "event" }),
    getTranslations({ locale, namespace: "shared" }),
    withAlternates(params, `/e/${event.slug}`),
  ]);
  return buildEventMetadata({
    event,
    lang: locale,
    url: `${env.siteUrl}${localizedPath(`/e/${event.slug}`, locale)}`,
    imageUrl: `${env.siteUrl}${shareCardPath(event.slug, event.updatedAt, locale)}`,
    price: priceLabel(lowestPrice(event.ticketTypes), locale, (k, v) => shared(k, v)),
    online: t("page.place.online"),
    imageAlt: t("meta.cardAlt", { title: event.title }),
    alternates,
  });
}

/** The words on a disabled main button. */
const DISABLED_LABEL = { soldOut: "summary.soldOut", closed: "summary.closed", cancelled: "summary.cancelled", notOnSale: "summary.notOnSale" } as const;
const DISABLED_NOTE = { soldOut: "summary.soldOutNote", closed: "tickets.closed", cancelled: "tickets.cancelled", notOnSale: "tickets.notOnSale" } as const;
const isDisabled = (c: EventCta): c is Extract<EventCta, { kind: keyof typeof DISABLED_LABEL }> => c.kind in DISABLED_LABEL;

export default async function EventPage({ params, searchParams }: { params: Promise<{ lang: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ lang, slug }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(lang);
  const t = await getTranslations("event");
  const shared = await getTranslations("shared");
  const root = await getTranslations();
  const format = await getFormat();
  const supabase = await createSupabaseServerClient();
  // The session cookie is enough to choose what to show; the API verifies the token on each call.
  const [{ data: { session } }, event] = await Promise.all([supabase.auth.getSession(), loadEventPage(slug)]);
  if (!event) notFound();

  const signedIn = !!session;
  const hostName = event.host.name?.trim() || event.hostName || t("page.hostFallback");
  const cta = eventCta({ ...event, signedIn });
  const team = cta.kind === "manage";
  const date = eventDate(event, format.lang, format.range(event.startsAt, event.endsAt, event.timeZone), t);
  const place = eventPlace(event.location, t);
  const path = eventPath(event.slug, format.lang);
  // Signed-out visitors go straight to booking and confirm their email there (D88); a `?code=` link
  // carries its discount code through (D91).
  const booking = withCode(bookingPath(event.slug, format.lang), codeParam(query.code));
  const manageHref = `/host/events/${event.id}`;

  const { free, paid } = orderableTypes(event);
  // The lowest price among the tickets that can be ordered now ("Free" or "From ₦5,000").
  const price = free.length + paid.length > 0 ? priceLabel(lowestPrice([...free, ...paid]), format.lang, (k, v) => shared(k, v)) : null;
  const hasPrice = paid.length > 0;
  // "Read more" only when the three-line excerpt is likely to cut something off.
  const longDescription = !!event.description && (event.description.length > 220 || event.description.split(/\r?\n/).filter((l) => l.trim()).length > 3);
  const refundShort = event.refundPolicy ? clip(firstLine(event.refundPolicy), 90) : null;
  const share = {
    path,
    title: event.title,
    cardUrl: shareCardPath(event.slug, event.updatedAt, format.lang),
    qr: { title: event.title, subtitle: [date.dateLine, place.venue ? event.location.city : t("page.place.online")].filter(Boolean).join(" · ") },
  };

  /** The one main button (and the sticky bar's copy of it on phones). */
  const mainButton = (c: EventCta, size: "md" | "lg") => {
    switch (c.kind) {
      case "manage":
        return <Button href={manageHref} variant="accent" size={size} fullWidth={size === "lg"}>{t("host.manage")}</Button>;
      case "get":
      case "waitlist": {
        const label = c.kind === "waitlist" ? t("summary.joinWaitlist") : c.label === "register" ? t("summary.register") : t("summary.getTickets");
        return <Button href={booking} variant="accent" size={size} fullWidth={size === "lg"}>{label}</Button>;
      }
      case "limit":
        return <Button href="/my-tickets" variant="secondary" size={size} fullWidth={size === "lg"}>{t("order.seeMyTickets")}</Button>;
      default:
        return <Button variant="secondary" size={size} fullWidth={size === "lg"} disabled>{t(DISABLED_LABEL[c.kind])}</Button>;
    }
  };

  return (
    <main className={cx("stage-content", s.page)}>
      <ThemeStage theme={event.coverTheme ?? "minimal"} />
      <SiteHeader back="/discover" />

      {(event.status !== "published" || event.canManage) && (
        <div className={s.notices}>
          {event.status === "draft" && <Banner tone="info" title={t("page.notices.draft")} />}
          {event.status === "cancelled" && <Banner tone="warning" title={t("page.notices.cancelled")} />}
          {event.canManage && <Banner tone="info" title={t.rich("page.notices.canManage", { link: (c) => <Link href={manageHref} className={s.inlineLink}>{c}</Link> })} />}
        </div>
      )}

      <div className={s.grid}>
        <aside className={s.side}>
          {/* Two or more pictures: the gallery (chunk 3c). One, or none, stays as it was: the flyer, or the cover style. */}
          {event.images.length > 1 ? (
            <div className={s.pictures}><Gallery pictures={event.images.map(({ url, width, height }) => ({ url, width, height }))} title={event.title} /></div>
          ) : (
            <div className={cx(s.cover, event.coverUrl && s.flyer)} style={event.coverUrl ? undefined : { background: themeBackground(event.coverTheme) }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- flyers come from storage at arbitrary sizes */}
              {event.coverUrl ? <img src={event.coverUrl} alt={t("page.coverAlt", { title: event.title })} /> : <span className={s.coverTitle}>{event.title}</span>}
            </div>
          )}

          {/* The host card, always under the picture (EventPorte-style): who's hosting, then the tags. */}
          <Card className={s.hostBox}>
            <div className={s.hostCard}>
              <Avatar name={hostName} src={event.host.avatarUrl} size={48} aria-hidden />
              <div className={s.hostText}>
                <span className={s.label}>{t("page.hostedBy")}</span>
                <span className={s.hostName}>
                  <strong>{hostName}</strong>
                  {event.host.verified && <Badge verified>{shared("hostProfile.verified")}</Badge>}
                </span>
                {/* The host's profile (Change 4 chunk 4, FR-32), once they have chosen a handle. */}
                {event.host.handle && (
                  <Link href={localizedPath(profilePath(event.host.handle), format.lang)} className={s.inlineLink}>{t("page.visitProfile")}</Link>
                )}
              </div>
            </div>
            <div className={s.tags}>
              <Badge plain>{isCategory(event.category) ? root(categoryLabelKey(event.category)) : event.category}</Badge>
              {event.visibility === "private" && <Badge plain>{t("page.privateEvent")}</Badge>}
            </div>
          </Card>

          {/* The API returns the count only to the event's team. */}
          {event.attendeeCount !== null && event.attendeeCount > 0 && (
            <div className={s.sideBlock}>
              <div className={s.label}>{t("page.going", { count: event.attendeeCount })}</div>
            </div>
          )}
        </aside>

        <div className={s.main}>
          <div className={s.titleRow}>
            <h1 className={s.title}>{event.title}</h1>
            <span className={s.share}>
              <ShareButton {...share} variant="button" />
            </span>
          </div>

          <div className={s.facts}>
            <div className={s.fact}>
              <div className={s.cal} aria-hidden="true"><span>{date.month}</span><b>{date.day}</b></div>
              <div>
                <div className={s.factTitle}>{date.dateLine}</div>
                <div className={s.factSub}>{date.timeLine}</div>
              </div>
            </div>
            <div className={s.fact}>
              <div className={s.icon} aria-hidden="true">
                {place.venue ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
                )}
              </div>
              <div>
                <div className={s.factTitle}>
                  {place.directions ? <a href={place.directions} target="_blank" rel="noopener noreferrer">{place.title} <span aria-hidden="true">{"↗"}</span></a> : place.title}
                </div>
                {place.line && <div className={s.factSub}>{place.line}</div>}
              </div>
            </div>
          </div>

          {event.description && (
            <div className={s.excerpt}>
              <p className={s.excerptText}>{event.description}</p>
              {longDescription && <a href="#about" className={s.inlineLink}>{t("summary.readMore")}</a>}
            </div>
          )}

          <Card as="section" className={s.tickets} aria-labelledby="tickets-title">
            <h2 className={s.cardTitle} id="tickets-title">{team ? t("tickets.headManage") : t("summary.ticketsTitle")}</h2>

            {/* Everyone sees what's on sale and for how much (FR-30); the team also sees how it's going. */}
            {event.ticketTypes.length > 0 && event.status !== "cancelled" && (
              <ul className={s.types}>
                {event.ticketTypes.map((tt) => (
                  <li key={tt.id}>
                    <TicketTypeInfo type={tt} />
                    <span className={s.typePrice}>
                      {team ? (
                        <>
                          {tt.priceMinor === 0 ? t("host.free") : format.money(tt.priceMinor, tt.currency)}
                          {groupSizeOf(tt) > 1 && ` · ${t("order.admits", { count: groupSizeOf(tt) })}`}
                          <span className={s.muted}>{` · ${tt.quantity !== null ? t("host.takenOf", { sold: tt.sold, quantity: tt.quantity }) : t("host.taken", { sold: tt.sold })}`}</span>
                        </>
                      ) : isSoldOut(tt) ? (
                        <span className={s.muted}>{t("order.soldOut")}</span>
                      ) : groupSizeOf(tt) > 1 ? (
                        t("order.priceAdmits", { price: tt.priceMinor === 0 ? t("order.free") : format.money(tt.priceMinor, tt.currency), count: groupSizeOf(tt) })
                      ) : tt.priceMinor === 0 ? t("order.free") : format.money(tt.priceMinor, tt.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {!team && free.length > 0 && event.ticketTypes.some((tt) => tt.priceMinor > 0) && !event.paidSalesOpen && cta.kind === "get" && (
              <p className={s.note}>{t("tickets.paidUnavailable")}</p>
            )}

            {cta.kind === "limit" ? (
              <Banner tone="info" title={t("order.maxReached", { count: event.perBuyerLimit })} action={<Button href="/my-tickets" size="sm" variant="secondary">{t("order.seeMyTickets")}</Button>}>
                {t("order.maxReachedHint")}
              </Banner>
            ) : (
              <div className={s.action}>
                {mainButton(cta, "lg")}
                {cta.kind === "get" && cta.label === "getTickets" && price && <p className={s.priceLine}>{price}</p>}
                {cta.kind === "waitlist" && <p className={s.note}>{t("summary.waitlistNote")}</p>}
                {isDisabled(cta) && <p className={s.note}>{t(DISABLED_NOTE[cta.kind])}</p>}
                {team && <Button href={`${manageHref}?tab=guests`} variant="secondary" size="lg" fullWidth>{t("host.seeGuests")}</Button>}
                {team && <p className={s.note}>{t("host.note")}</p>}
              </div>
            )}

            {!team && event.requireApproval && free.length > 0 && cta.kind === "get" && <p className={s.note}>{t("tickets.approvalNote")}</p>}

            {(cta.kind === "get" || cta.kind === "waitlist") && (
              <ul className={s.trust}>
                {hasPrice && <li><CreditCard size={16} strokeWidth={1.75} aria-hidden />{t("trust.paystack")}</li>}
                <li>
                  <RotateCcw size={16} strokeWidth={1.75} aria-hidden />
                  {refundShort ? <a href="#refunds">{t("trust.refunds", { policy: refundShort })}</a> : <Link href={localizedPath("/refunds", format.lang)}>{t("trust.refundsLink")}</Link>}
                </li>
                <li><Mail size={16} strokeWidth={1.75} aria-hidden />{t("trust.email")}</li>
              </ul>
            )}
          </Card>
        </div>
      </div>

      <AboutSection event={event} />

      <div className={s.sticky}>
        <span className={s.stickyPrice}>{cta.kind === "get" ? price : null}</span>
        <span className={s.stickyActions}>
          <ShareButton {...share} variant="icon" />
          {mainButton(cta, "md")}
        </span>
      </div>
    </main>
  );
}
