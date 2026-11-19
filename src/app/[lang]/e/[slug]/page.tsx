import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreditCard, Mail, RotateCcw } from "lucide-react";
import { withAlternates } from "@/i18n/seo";
import { localizedPath } from "@/i18n/routing";
import { getFormat } from "@/i18n/format-server";
import type { Locale } from "@/i18n/languages";
import { intlLocale, safeZone } from "@/lib/format";
import { categoryLabelKey, isCategory } from "@/lib/categories";
import { notFound } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { themeBackground } from "@/lib/themes";
import { eventDateParts, timezoneLabel } from "@/lib/dates";
import { loadEventPage } from "@/lib/event-page";
import { buildEventMetadata, clip, firstLine } from "@/lib/event-metadata";
import { lowestPrice, priceLabel } from "@/lib/price-label";
import { env } from "@/lib/env";
import { shareCardPath } from "@/lib/share";
import OrderForm from "./OrderForm";
import PaidOrderForm from "./PaidOrderForm";
import ThemeStage from "@/components/ThemeStage";
import VenueMap, { directionsUrl } from "@/components/VenueMap";
import SiteHeader from "@/components/SiteHeader";
import ShareButton from "@/components/ShareButton";
import { Avatar, Button } from "@/design";

// The public event page from gventz-api (U6a), laid out like Luma: the cover and host on the left;
// the date, place and tickets on the right; then the description and the venue map. The API decides
// who may see drafts and whether the attendee count is shown; the order form is for signed-in visitors.
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


/** The calendar tile and date line in the page's language; English keeps eventDateParts' exact output. */
function dateParts(startsAt: string, endsAt: string | null, timeZone: string | null | undefined, lang: Locale) {
  const en = eventDateParts(startsAt, endsAt, timeZone);
  if (lang === "en") return { month: en.month, day: en.day, dateLine: en.dateLine };
  const tz = safeZone(timeZone);
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intlLocale(lang, "date"), { ...o, timeZone: tz }).format(new Date(startsAt));
  return {
    month: fmt({ month: "short" }).toUpperCase(),
    day: fmt({ day: "numeric" }),
    dateLine: fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  };
}

export default async function EventPage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
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
  const me = signedIn ? await (await api()).GET("/v1/me").then(data).catch(() => null) : null;

  const date = {
    ...dateParts(event.startsAt, event.endsAt, event.timeZone, format.lang),
    timeLine: t("page.timeLine", { range: format.range(event.startsAt, event.endsAt, event.timeZone), zone: timezoneLabel(safeZone(event.timeZone)) }),
  };
  const path = localizedPath(`/e/${event.slug}`, format.lang);
  const back = encodeURIComponent(path);
  const signInHref = `/sign-in?next=${back}`;
  const signUpHref = `/sign-up?next=${back}`;
  const price = event.ticketTypes.length > 0 ? priceLabel(lowestPrice(event.ticketTypes), format.lang, (k, v) => shared(k, v)) : null;
  // Free and paid tickets are separate orders (M5, CK1): one form each, never mixed. Paid types are
  // offered only while the API says paid sales are open (Paystack on, the host can sell).
  const freeTypes = event.ticketTypes.filter((t) => t.priceMinor === 0);
  const paidTypes = event.ticketTypes.filter((t) => t.priceMinor > 0);
  const open = event.status === "published" && event.registrationOpen;
  const canOrderFree = open && freeTypes.length > 0;
  const canOrderPaid = open && paidTypes.length > 0 && event.paidSalesOpen;
  const canOrder = canOrderFree || canOrderPaid;
  const bothKinds = canOrderFree && canOrderPaid;
  const loc = event.location;
  const venue = loc.kind === "venue";
  const placeTitle = venue ? loc.venueName || loc.address || loc.city || t("page.place.venue") : t("page.place.online");
  const placeLine = venue ? [loc.venueName ? loc.address : null, loc.city, loc.country].filter(Boolean).join(", ") : t("page.place.onlineLine");
  const directions = directionsUrl(loc);
  const share = {
    path,
    title: event.title,
    cardUrl: shareCardPath(event.slug, event.updatedAt, format.lang),
    qr: { title: event.title, subtitle: [date.dateLine, venue ? loc.city : t("page.place.online")].filter(Boolean).join(" · ") },
  };
  // The phone's sticky bar: the price and the one thing to do next.
  const mainAction = event.canManage
    ? { href: `/dashboard/${event.id}`, label: t("host.manage") }
    : canOrder
      ? { href: signedIn ? "#tickets" : signInHref, label: t("signUp.cta") }
      : null;
  const hasPrice = event.ticketTypes.some((tt) => tt.priceMinor > 0);
  const refundShort = event.refundPolicy ? clip(firstLine(event.refundPolicy), 90) : null;

  return (
    <main className="ev stage-content">
      <ThemeStage theme={event.coverTheme ?? "minimal"} />
      <SiteHeader back="/discover" />

      {(event.status !== "published" || event.canManage) && (
        <div className="ev-notices">
          {event.status === "draft" && <p className="ev-notice">{t("page.notices.draft")}</p>}
          {event.status === "cancelled" && <p className="ev-notice ev-notice-warn">{t("page.notices.cancelled")}</p>}
          {event.canManage && <p className="ev-notice">{t.rich("page.notices.canManage", { link: (c) => <Link href={`/dashboard/${event.id}`} className="gold">{c}</Link> })}</p>}
        </div>
      )}

      <div className="ev-grid">
        <aside className="ev-side">
          <div className={`ev-cover ${event.coverUrl ? "ev-cover-flyer" : ""}`} style={{ background: themeBackground(event.coverTheme) }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- flyers come from Supabase Storage at arbitrary sizes */}
            {event.coverUrl ? <img src={event.coverUrl} alt={t("page.coverAlt", { title: event.title })} /> : <span className="ev-cover-title">{event.title}</span>}
          </div>

          {event.hostName && (
            <div className="ev-side-block">
              <div className="ev-label">{t("page.hostedBy")}</div>
              {/* TODO(chunk 4): link the host card to the host's profile, /h/{handle}, once it exists. */}
              <div className="ev-hostcard">
                <Avatar name={event.hostName} size={36} aria-hidden />
                <span>{event.hostName}</span>
              </div>
            </div>
          )}

          {event.attendeeCount !== null && event.attendeeCount > 0 && (
            <div className="ev-side-block">
              <div className="ev-label">{t("page.going", { count: event.attendeeCount })}</div>
            </div>
          )}

          <div className="ev-tags">
            <span className="ev-tag">{isCategory(event.category) ? root(categoryLabelKey(event.category)) : event.category}</span>
            {event.visibility === "private" && <span className="ev-tag">{t("page.privateEvent")}</span>}
          </div>
        </aside>

        <div className="ev-main">
          <div className="ev-titlerow">
            <h1 className="ev-title">{event.title}</h1>
            <span className="ev-share">
              <ShareButton {...share} variant="button" />
            </span>
          </div>

          <div className="ev-facts">
            <div className="ev-fact">
              <div className="ev-cal" aria-hidden="true"><span>{date.month}</span><b>{date.day}</b></div>
              <div>
                <div className="ev-fact-title">{date.dateLine}</div>
                <div className="ev-fact-sub">{date.timeLine}</div>
              </div>
            </div>
            <div className="ev-fact">
              <div className="ev-icon" aria-hidden="true">
                {venue ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
                )}
              </div>
              <div>
                <div className="ev-fact-title">
                  {directions ? <a href={directions} target="_blank" rel="noopener noreferrer">{placeTitle} <span aria-hidden="true">{"↗"}</span></a> : placeTitle}
                </div>
                {placeLine && <div className="ev-fact-sub">{placeLine}</div>}
              </div>
            </div>
          </div>

          <section className="ev-card" id="tickets" aria-labelledby="tickets-title">
            <div className="ev-card-head" id="tickets-title">{event.canManage ? t("tickets.headManage") : canOrder ? t("tickets.headGet") : t("tickets.head")}</div>
            <div className="ev-card-body">
              {event.status === "cancelled" && <p className="muted">{t("tickets.cancelled")}</p>}
              {event.status === "published" && !event.registrationOpen && <p className="muted">{t("tickets.closed")}</p>}
              {open && !canOrder && (
                <p className="muted">{t("tickets.notOnSale")}</p>
              )}
              {open && canOrderFree && paidTypes.length > 0 && !event.paidSalesOpen && !event.canManage && (
                <p className="muted small">{t("tickets.paidUnavailable")}</p>
              )}
              {/* Hosts and their team see what's on sale and how it's going, not a ticket form for themselves. */}
              {event.canManage && (
                <div className="ev-host">
                  <ul className="ev-host-types">
                    {event.ticketTypes.map((tt) => (
                      <li key={tt.id}>
                        <span className="ev-host-name">{tt.name}</span>
                        <span className="muted small">
                          {tt.priceMinor === 0 ? t("host.free") : format.money(tt.priceMinor, tt.currency)} · {tt.quantity !== null ? t("host.takenOf", { sold: tt.sold, quantity: tt.quantity }) : t("host.taken", { sold: tt.sold })}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="muted small">{t("host.note")}</p>
                  <div className="ev-host-actions">
                    <Button href={`/dashboard/${event.id}?tab=guests`} variant="accent" fullWidth className="ev-cta">{t("host.seeGuests")}</Button>
                    <Button href={`/dashboard/${event.id}`} variant="secondary" fullWidth className="ev-cta">{t("host.manage")}</Button>
                  </div>
                </div>
              )}
              {/* Everyone sees what's on sale and for how much; signing in comes when they get tickets. */}
              {!event.canManage && !signedIn && event.status !== "cancelled" && event.ticketTypes.length > 0 && (
                <ul className="ev-types">
                  {event.ticketTypes.map((tt) => (
                    <li key={tt.id}>
                      <span className="ev-type-name">{tt.name}</span>
                      <span className="ev-type-price">
                        {tt.remaining === 0 ? <span className="muted">{t("order.soldOut")}</span> : tt.priceMinor === 0 ? t("order.free") : format.money(tt.priceMinor, tt.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {!event.canManage && canOrder && !signedIn && (
                <div className="ev-signup">
                  <Button href={signInHref} variant="accent" fullWidth>{t("signUp.cta")}</Button>
                  <p className="muted small">{t.rich("signUp.newHere", { link: (c) => <Link href={signUpHref} className="gold">{c}</Link> })}</p>
                </div>
              )}
              {!event.canManage && signedIn && bothKinds && (
                <p className="muted small">{t("tickets.separateOrders")}</p>
              )}
              {!event.canManage && canOrderFree && signedIn && (
                <section className="pay-kind" aria-labelledby={bothKinds ? "free-title" : undefined}>
                  {bothKinds && <h3 className="pay-kind-title" id="free-title">{t("tickets.freeTitle")}</h3>}
                  <OrderForm
                    eventId={event.id}
                    ticketTypes={freeTypes}
                    questions={event.questions}
                    perBuyerLimit={event.perBuyerLimit}
                    userEmail={me?.email ?? session.user.email ?? ""}
                    defaultName={me?.fullName ?? ""}
                    requireApproval={event.requireApproval}
                  />
                </section>
              )}
              {!event.canManage && canOrderPaid && signedIn && (
                <section className="pay-kind" aria-labelledby={bothKinds ? "paid-title" : undefined}>
                  {bothKinds && <h3 className="pay-kind-title" id="paid-title">{t("tickets.paidTitle")}</h3>}
                  <PaidOrderForm
                    eventId={event.id}
                    ticketTypes={paidTypes}
                    questions={event.questions}
                    perBuyerLimit={event.perBuyerLimit}
                    userEmail={me?.email ?? session.user.email ?? ""}
                    defaultName={me?.fullName ?? ""}
                    refundPolicy={event.refundPolicy}
                    feeChoice={event.feeChoice}
                  />
                </section>
              )}
              {!event.canManage && event.requireApproval && canOrderFree && <p className="muted small">{t("tickets.approvalNote")}</p>}
              {!event.canManage && canOrder && (
                <ul className="ev-trust">
                  {hasPrice && (
                    <li><CreditCard size={16} strokeWidth={1.75} aria-hidden />{t("trust.paystack")}</li>
                  )}
                  <li>
                    <RotateCcw size={16} strokeWidth={1.75} aria-hidden />
                    {refundShort ? <a href="#refunds">{t("trust.refunds", { policy: refundShort })}</a> : <Link href={localizedPath("/refunds", format.lang)}>{t("trust.refundsLink")}</Link>}
                  </li>
                  <li><Mail size={16} strokeWidth={1.75} aria-hidden />{t("trust.email")}</li>
                </ul>
              )}
            </div>
          </section>

          {event.description && (
            <section className="ev-section">
              <h2 className="ev-h2">{t("page.about")}</h2>
              <p className="ev-desc">{event.description}</p>
            </section>
          )}

          {venue && directions && (
            <section className="ev-section">
              <h2 className="ev-h2">{t("page.location")}</h2>
              <VenueMap
                location={loc}
                title={placeTitle}
                subtitle={placeLine || undefined}
                labels={{ open: t("map.open"), show: t("map.show"), mapTitle: t("map.title", { place: placeTitle }), imageAlt: t("map.imageAlt", { place: placeTitle }) }}
              />
            </section>
          )}

          {event.refundPolicy && (
            <section className="ev-section" id="refunds">
              <h2 className="ev-h2">{t("page.refunds")}</h2>
              <p className="ev-desc muted">{event.refundPolicy}</p>
            </section>
          )}
        </div>
      </div>

      <div className="ev-sticky">
        {price && <span className="ev-sticky-price">{price}</span>}
        <span className="ev-sticky-actions">
          <ShareButton {...share} variant="icon" />
          {mainAction && <Button href={mainAction.href} variant="accent">{mainAction.label}</Button>}
        </span>
      </div>
    </main>
  );
}
