import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/languages";
import { getFormat } from "@/i18n/format-server";
import { api, data } from "@/lib/api/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadEventPage, type EventPage } from "@/lib/event-page";
import { getEventPaidSales } from "@/lib/payments";
import { themeBackground } from "@/lib/themes";
import SiteHeader from "@/components/SiteHeader";
import { Banner, Button } from "@/design";
import OrderForm from "../OrderForm";
import PaidOrderForm from "../PaidOrderForm";
import UnlockGate from "../UnlockGate";
import { eventCta, orderableTypes, ticketsLeft } from "../event-cta";
import AboutSection from "../AboutSection";
import { eventDate, eventPath, eventPlace } from "../event-view";
import { codeParam } from "./discount-code";
import { tokenParam, unlockCookieName } from "./registration-token";
import { isPhoneCountry, phoneCountryOptions } from "@/lib/phone";
import b from "./Booking.module.css";

// The booking page (Change 4 chunk 3b, step 2): a clean page for getting tickets, opened from the event
// page's one button. Signed-out visitors book here too and confirm their email with the inline code
// (chunk 3d, D88); after it the page refreshes and is worked out again for the account (the team goes
// to the event page; at the per-person limit the limit note replaces the form). `?code=` applies a
// discount code (D91). The order forms, their
// server actions, holds and errors are the ones the event page used to have.
// Like the event page, the metadata calls notFound() before anything streams, so an unknown event is
// a real 404; the event is loaded once per request (loadEventPage is React-cached).
export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }): Promise<Metadata> {
  const { lang, slug } = await params;
  const event = await loadEventPage(slug);
  if (!event) notFound();
  const t = await getTranslations({ locale: lang as Locale, namespace: "event.booking" });
  return { title: `${t("metaTitle", { title: event.title })} · G-ventZ`, robots: { index: false, follow: false }, openGraph: null, twitter: null };
}

const UNAVAILABLE = { soldOut: "summary.soldOutNote", closed: "tickets.closed", cancelled: "tickets.cancelled", notOnSale: "tickets.notOnSale" } as const;

/** A small flyer, or the event's cover style when it has none. */
function Thumb({ event, className }: { event: EventPage; className: string }) {
  return (
    <div className={className} style={event.coverUrl ? undefined : { background: themeBackground(event.coverTheme) }} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- flyers come from storage at arbitrary sizes */}
      {event.coverUrl && <img src={event.coverUrl} alt="" />}
    </div>
  );
}

type PageProps = { params: Promise<{ lang: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function BookingPage({ params, searchParams }: PageProps) {
  const [{ lang, slug }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(lang);
  const r = tokenParam(query.r);
  const [t, format, supabase] = await Promise.all([getTranslations("event"), getFormat(), createSupabaseServerClient()]);
  const [{ data: { session } }, event] = await Promise.all([supabase.auth.getSession(), loadEventPage(slug, r)]);
  if (!event) notFound();

  // Change 6 (FR-40): a code-gated link shows the unlock step until the guest has cleared it (cookie).
  const unlocked =
    event.accessRequired && event.registrationLinkToken ? !!(await cookies()).get(unlockCookieName(event.id, event.registrationLinkToken)) : false;
  const gated = event.accessRequired && !unlocked;

  const back = eventPath(event.slug, format.lang);
  const signedIn = !!session;
  const cta = eventCta({ ...event, signedIn });
  if (cta.kind === "manage") redirect(back);

  const { free, paid } = orderableTypes(event);
  const [me, paidSales] = await Promise.all([
    session ? (await api()).GET("/v1/me").then(data).catch(() => null) : null,
    // PS4–PS6: the provider a checkout uses now, and whether paid types are paused.
    paid.length > 0 ? getEventPaidSales(event.id) : null,
  ]);
  const date = eventDate(event, format.lang, format.range(event.startsAt, event.endsAt, event.timeZone), t);
  const place = eventPlace(event.location, t);
  const left = ticketsLeft(event);
  const held = event.viewerTickets ?? 0;
  const open = cta.kind === "get" || cta.kind === "waitlist";
  // Free and paid tickets are separate orders (M5, CK1): one form each, never mixed.
  const both = open && free.length > 0 && paid.length > 0;
  const buyer = { signedIn, email: me?.email ?? session?.user.email ?? "", name: me?.fullName ?? "", phone: me?.phone ?? null, gender: me?.gender ?? null };
  // The phone picker starts on the event's country (4b), else the account's, else Nigeria.
  const venueCountry = event.location.kind === "venue" ? event.location.countryCode : null;
  const phone = {
    countries: phoneCountryOptions(format.lang),
    country: [venueCountry, me?.country].find((c): c is string => isPhoneCountry(c))?.toUpperCase() ?? "NG",
  };
  const code = codeParam(query.code);

  const summary = (
    <div className={b.event} key="summary">
      <Thumb event={event} className={b.eventThumb} />
      <div className={b.eventText}>
        <p className={b.eventTitle}>{event.title}</p>
        <p className={b.eventFact}><CalendarDays size={16} strokeWidth={1.75} aria-hidden /><span>{date.dateLine}<br />{date.timeLine}</span></p>
        <p className={b.eventFact}>
          <MapPin size={16} strokeWidth={1.75} aria-hidden />
          {place.directions ? <a href={place.directions} target="_blank" rel="noopener noreferrer">{place.title} <span aria-hidden="true">{"↗"}</span></a> : <span>{place.title}</span>}
        </p>
      </div>
    </div>
  );

  return (
    <main className={b.page}>
      <SiteHeader back={false} />
      <div className={b.body}>
        <div className={b.bar}>
          <Button href={back} variant="ghost" icon={<ArrowLeft size={20} strokeWidth={1.75} aria-hidden />} aria-label={t("booking.back")} className={b.back} />
          <Thumb event={event} className={b.thumb} />
          <div className={b.barText}>
            <h1 className={b.barTitle}>{event.title}</h1>
            <p className={b.barSub}>{`${date.dateLine} · ${date.timeLine}`}</p>
          </div>
        </div>

        {cta.kind === "limit" && (
          <Banner className={b.notice} tone="info" title={t("order.maxReached", { count: event.perBuyerLimit })} action={<Button href="/my-tickets" size="sm" variant="secondary">{t("order.seeMyTickets")}</Button>}>
            {t("order.maxReachedHint")}
          </Banner>
        )}
        {(cta.kind === "soldOut" || cta.kind === "closed" || cta.kind === "cancelled" || cta.kind === "notOnSale") && (
          <Banner className={b.notice} tone="warning" title={t("booking.unavailable")} action={<Button href={back} size="sm" variant="secondary">{t("booking.back")}</Button>}>
            {t(UNAVAILABLE[cta.kind])}
          </Banner>
        )}

        {open && gated && event.registrationLinkToken && (
          <UnlockGate eventId={event.id} linkToken={event.registrationLinkToken} linkName={event.registrationLinkName} />
        )}

        {open && !gated && (
          <div className={b.kinds}>
            {both && <p className={b.note}>{t("tickets.separateOrders")}</p>}
            {free.length > 0 && (
              <section className={b.kind} aria-labelledby={both ? "free-title" : undefined}>
                {both && <h2 className={b.kindTitle} id="free-title">{t("tickets.freeTitle")}</h2>}
                <OrderForm
                  eventId={event.id}
                  ticketTypes={free}
                  questions={event.questions}
                  perBuyerLimit={left}
                  held={held}
                  buyer={buyer}
                  phone={phone}
                  requireApproval={event.requireApproval}
                  registrationLinkToken={event.registrationLinkToken}
                  summary={summary}
                />
              </section>
            )}
            {paid.length > 0 && (
              <section className={b.kind} aria-labelledby={both ? "paid-title" : undefined}>
                {both && <h2 className={b.kindTitle} id="paid-title">{t("tickets.paidTitle")}</h2>}
                <PaidOrderForm
                  eventId={event.id}
                  ticketTypes={paid}
                  questions={event.questions}
                  perBuyerLimit={left}
                  held={held}
                  buyer={buyer}
                  phone={phone}
                  initialCode={code}
                  refundPolicy={event.refundPolicy}
                  feeChoice={event.feeChoice}
                  provider={paidSales?.provider ?? null}
                  paused={paidSales?.paidTicketsPaused ?? false}
                  summary={summary}
                />
              </section>
            )}
          </div>
        )}
      </div>
      <AboutSection event={event} />
    </main>
  );
}
