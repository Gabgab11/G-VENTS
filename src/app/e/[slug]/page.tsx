import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { themeBackground } from "@/lib/themes";
import { formatEventDate, timezoneLabel } from "@/lib/dates";
import { getEventPage } from "@/lib/event-page";
import RegisterForm from "./RegisterForm";
import BackLink from "@/components/BackLink";
import ThemeStage from "@/components/ThemeStage";

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const [{ data: { user } }, page] = await Promise.all([
    supabase.auth.getUser(),
    getEventPage(supabase, slug),
  ]);
  if (!page) notFound();
  const { event, tiers, questions } = page;

  const { data: going } = await supabase.rpc("public_attendee_count", { p_event: event.id });

  const when = formatEventDate(event.starts_at, event.timezone, "long");
  const signInHref = `/sign-in?next=${encodeURIComponent(`/e/${event.slug}`)}`;
  // Paid tickets can't be bought until payments exist, so they're shown but not offered.
  const freeTiers = tiers.filter((t) => t.price_minor === 0);

  return (
    <main className="wrap page stage-content">
      <ThemeStage theme={event.cover_theme ?? "minimal"} />
      <BackLink fallback="/discover" label="← Back" />

      {event.status === "draft" && <p className="notice">Draft. Only you and your team can see this page.</p>}
      {event.status === "cancelled" && <p className="notice">This event has been cancelled.</p>}
      {event.can_manage && <p className="notice"><Link href={`/dashboard/${event.id}`} className="gold">Manage this event</Link></p>}

      <div className="event-hero" style={{ background: themeBackground(event.cover_theme) }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- flyers come from Supabase Storage at arbitrary sizes */}
        {event.cover_url ? <img src={event.cover_url} alt={event.title} className="event-cover-img" /> : <div className="cover-title">{event.title}</div>}
      </div>

      <p className="when">
        {event.category} · {when} ({timezoneLabel(event.timezone)}){event.visibility === "private" ? " · Private event" : ""}
      </p>
      <h1>{event.title}</h1>
      <p className="muted">{[event.venue_name, event.city, event.country].filter(Boolean).join(" · ")}</p>

      {typeof going === "number" && (
        <p className="muted">{going} {going === 1 ? "person" : "people"} going</p>
      )}

      {event.description && <p className="desc">{event.description}</p>}

      <h2>Register</h2>
      {!event.registration_open && <p className="notice">Registration for this event is closed.</p>}
      {event.registration_open && freeTiers.length === 0 && (
        <p className="notice">Tickets for this event aren&apos;t on sale yet. Check back soon.</p>
      )}
      {event.registration_open && freeTiers.length > 0 && !user && (
        <div className="signup-card">
          <b>Create a free account to register</b>
          <p className="muted small">Takes a few seconds. We&apos;ll email you a 6-digit code, no password needed. Your ticket and updates from the host will be saved to your account.</p>
          <Link href={signInHref} className="btn-grad">Sign up to register</Link>
          <p className="muted small">Already have an account? <Link href={signInHref} className="gold">Sign in</Link></p>
        </div>
      )}
      {event.registration_open && freeTiers.length > 0 && user && (
        <RegisterForm eventId={event.id} tiers={freeTiers} questions={questions} userEmail={user.email ?? ""} />
      )}

      {event.refund_policy && <p className="muted small">Refunds: {event.refund_policy}</p>}
    </main>
  );
}
