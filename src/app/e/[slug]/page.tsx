import Link from "next/link";
import { notFound } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { themeBackground } from "@/lib/themes";
import { eventDateParts } from "@/lib/dates";
import { getEventPage } from "@/lib/event-page";
import OrderForm from "./OrderForm";
import BackLink from "@/components/BackLink";
import ThemeStage from "@/components/ThemeStage";
import VenueMap, { directionsUrl } from "@/components/VenueMap";

// The public event page from gventz-api (U6a), laid out like Luma: the cover and host on the left;
// the date, place and tickets on the right; then the description and the venue map. The API decides
// who may see drafts and whether the attendee count is shown; the order form is for signed-in visitors.
export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  // The session cookie is enough to choose what to show; the API verifies the token on each call.
  const [{ data: { session } }, event] = await Promise.all([supabase.auth.getSession(), getEventPage(slug)]);
  if (!event) notFound();

  const signedIn = !!session;
  const me = signedIn ? await (await api()).GET("/v1/me").then(data).catch(() => null) : null;

  const date = eventDateParts(event.startsAt, event.endsAt, event.timeZone);
  const signInHref = `/sign-in?next=${encodeURIComponent(`/e/${event.slug}`)}`;
  // Paid tickets arrive with payments (U7); until then they're shown but not offered.
  const freeTypes = event.ticketTypes.filter((t) => t.priceMinor === 0);
  const canOrder = event.status === "published" && event.registrationOpen && freeTypes.length > 0;
  const loc = event.location;
  const venue = loc.kind === "venue";
  const placeTitle = venue ? loc.venueName || loc.address || loc.city || "Venue" : "Online";
  const placeLine = venue ? [loc.venueName ? loc.address : null, loc.city, loc.country].filter(Boolean).join(", ") : "The host shares the link with guests";
  const directions = directionsUrl(loc);

  return (
    <main className="ev stage-content">
      <ThemeStage theme={event.coverTheme ?? "minimal"} />
      <div className="ev-top"><BackLink fallback="/discover" label="← Back" /></div>

      {(event.status !== "published" || event.canManage) && (
        <div className="ev-notices">
          {event.status === "draft" && <p className="ev-notice">Draft. Only you and your team can see this page.</p>}
          {event.status === "cancelled" && <p className="ev-notice ev-notice-warn">This event has been cancelled.</p>}
          {event.canManage && <p className="ev-notice">You can edit this event. <Link href={`/dashboard/${event.id}`} className="gold">Manage event</Link></p>}
        </div>
      )}

      <div className="ev-grid">
        <aside className="ev-side">
          <div className="ev-cover" style={{ background: themeBackground(event.coverTheme) }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- flyers come from Supabase Storage at arbitrary sizes */}
            {event.coverUrl ? <img src={event.coverUrl} alt={`Flyer for ${event.title}`} /> : <span className="ev-cover-title">{event.title}</span>}
          </div>

          {event.hostName && (
            <div className="ev-side-block">
              <div className="ev-label">Hosted by</div>
              <div className="ev-host">
                <span className="ev-avatar" aria-hidden="true">{event.hostName.trim().charAt(0).toUpperCase()}</span>
                <span>{event.hostName}</span>
              </div>
            </div>
          )}

          {event.attendeeCount !== null && event.attendeeCount > 0 && (
            <div className="ev-side-block">
              <div className="ev-label">{event.attendeeCount} {event.attendeeCount === 1 ? "person" : "people"} going</div>
            </div>
          )}

          <div className="ev-tags">
            <span className="ev-tag">{event.category}</span>
            {event.visibility === "private" && <span className="ev-tag">Private event</span>}
          </div>
        </aside>

        <div className="ev-main">
          <h1 className="ev-title">{event.title}</h1>

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
                  {directions ? <a href={directions} target="_blank" rel="noopener noreferrer">{placeTitle} <span aria-hidden="true">↗</span></a> : placeTitle}
                </div>
                {placeLine && <div className="ev-fact-sub">{placeLine}</div>}
              </div>
            </div>
          </div>

          <section className="ev-card" aria-labelledby="tickets-title">
            <div className="ev-card-head" id="tickets-title">{canOrder ? "Get tickets" : "Tickets"}</div>
            <div className="ev-card-body">
              {event.status === "cancelled" && <p className="muted">This event was cancelled, so tickets are no longer available.</p>}
              {event.status === "published" && !event.registrationOpen && <p className="muted">Registration for this event is closed.</p>}
              {event.status === "published" && event.registrationOpen && freeTypes.length === 0 && (
                <p className="muted">Tickets for this event aren&apos;t on sale yet. Check back soon.</p>
              )}
              {canOrder && !signedIn && (
                <div className="ev-signup">
                  <p>Welcome! Create a free account or sign in to get your tickets. It takes a few seconds with Google or a 6-digit email code.</p>
                  <Link href={signInHref} className="btn-grad ev-cta">Get tickets</Link>
                  <p className="muted small">Already have an account? <Link href={signInHref} className="gold">Sign in</Link></p>
                </div>
              )}
              {canOrder && signedIn && (
                <OrderForm
                  eventId={event.id}
                  ticketTypes={freeTypes}
                  questions={event.questions}
                  perBuyerLimit={event.perBuyerLimit}
                  userEmail={me?.email ?? session.user.email ?? ""}
                  defaultName={me?.fullName ?? ""}
                  requireApproval={event.requireApproval}
                />
              )}
              {event.requireApproval && canOrder && <p className="muted small">The host approves each request before tickets are issued.</p>}
            </div>
          </section>

          {event.description && (
            <section className="ev-section">
              <h2 className="ev-h2">About</h2>
              <p className="ev-desc">{event.description}</p>
            </section>
          )}

          {venue && directions && (
            <section className="ev-section">
              <h2 className="ev-h2">Location</h2>
              <div className="ev-fact-title">{placeTitle}</div>
              {placeLine && <div className="ev-fact-sub">{placeLine}</div>}
              <VenueMap location={loc} title={placeTitle} />
              <a className="ev-directions" href={directions} target="_blank" rel="noopener noreferrer">Get directions ↗</a>
            </section>
          )}

          {event.refundPolicy && (
            <section className="ev-section">
              <h2 className="ev-h2">Refunds</h2>
              <p className="ev-desc muted">{event.refundPolicy}</p>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
