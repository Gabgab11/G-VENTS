import Link from "next/link";
import { notFound } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { themeBackground } from "@/lib/themes";
import { formatEventDate, timezoneLabel } from "@/lib/dates";
import { getEventPage, whereText } from "@/lib/event-page";
import OrderForm from "./OrderForm";
import BackLink from "@/components/BackLink";
import ThemeStage from "@/components/ThemeStage";

// The public event page from gventz-api (U6a). The API decides who may see drafts and whether the
// attendee count is shown; the order form appears for signed-in visitors.
export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  // The session cookie is enough to choose what to show; the API verifies the token on each call.
  const [{ data: { session } }, event] = await Promise.all([supabase.auth.getSession(), getEventPage(slug)]);
  if (!event) notFound();

  const signedIn = !!session;
  const me = signedIn ? await (await api()).GET("/v1/me").then(data).catch(() => null) : null;

  const when = formatEventDate(event.startsAt, event.timeZone, "long");
  const signInHref = `/sign-in?next=${encodeURIComponent(`/e/${event.slug}`)}`;
  // Paid tickets arrive with payments (U7); until then they're shown but not offered.
  const freeTypes = event.ticketTypes.filter((t) => t.priceMinor === 0);
  const canOrder = event.status === "published" && event.registrationOpen && freeTypes.length > 0;

  return (
    <main className="wrap page stage-content">
      <ThemeStage theme={event.coverTheme ?? "minimal"} />
      <BackLink fallback="/discover" label="← Back" />

      {event.status === "draft" && <p className="notice">Draft. Only you and your team can see this page.</p>}
      {event.status === "cancelled" && <p className="notice">This event has been cancelled.</p>}
      {event.canManage && <p className="notice"><Link href={`/dashboard/${event.id}`} className="gold">Manage this event</Link></p>}

      <div className="event-hero" style={{ background: themeBackground(event.coverTheme) }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- flyers come from Supabase Storage at arbitrary sizes */}
        {event.coverUrl ? <img src={event.coverUrl} alt={event.title} className="event-cover-img" /> : <div className="cover-title">{event.title}</div>}
      </div>

      <p className="when">
        {event.category} · {when} ({timezoneLabel(event.timeZone)}){event.visibility === "private" ? " · Private event" : ""}
      </p>
      <h1>{event.title}</h1>
      <p className="muted">{whereText(event.location)}</p>

      {event.attendeeCount !== null && (
        <p className="muted">{event.attendeeCount} {event.attendeeCount === 1 ? "person" : "people"} going</p>
      )}

      {event.description && <p className="desc">{event.description}</p>}

      <h2>Tickets</h2>
      {event.status === "published" && !event.registrationOpen && <p className="notice">Registration for this event is closed.</p>}
      {event.status === "published" && event.registrationOpen && freeTypes.length === 0 && (
        <p className="notice">Tickets for this event aren&apos;t on sale yet. Check back soon.</p>
      )}
      {canOrder && !signedIn && (
        <div className="signup-card">
          <b>Create a free account to get tickets</b>
          <p className="muted small">Takes a few seconds with Google or a 6-digit email code, no password needed. Your tickets are saved to your account.</p>
          <Link href={signInHref} className="btn-grad">Sign up to get tickets</Link>
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

      {event.refundPolicy && <p className="muted small">Refunds: {event.refundPolicy}</p>}
    </main>
  );
}
