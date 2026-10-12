import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { themeBackground } from "@/lib/themes";
import RegisterForm from "./RegisterForm";
import BackLink from "@/components/BackLink";
import ThemeStage from "@/components/ThemeStage";

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: event } = await supabase
    .from("events")
    .select("id, owner_id, title, slug, category, description, starts_at, venue_name, city, country, status, visibility, refund_policy, cover_theme, cover_url, registration_open")
    .eq("slug", slug)
    .maybeSingle();
  if (!event) notFound();

  const isOwner = !!user && user.id === event.owner_id;

  const [{ data: tiers }, { data: questions }, { data: going }] = await Promise.all([
    supabase.from("ticket_tiers").select("id, name, price_minor, quantity, sold").eq("event_id", event.id).eq("is_active", true).order("price_minor", { ascending: true }),
    supabase.from("event_questions").select("id, label, kind, options, required").eq("event_id", event.id).order("position", { ascending: true }),
    supabase.rpc("public_attendee_count", { p_event: event.id }),
  ]);

  const when = new Date(event.starts_at).toLocaleString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos",
  });

  return (
    <main className="wrap page stage-content">
      <ThemeStage theme={event.cover_theme ?? "minimal"} />
      <BackLink fallback="/discover" label="← Back" />

      {event.status === "draft" && <p className="notice">Draft. Only you can see this page.</p>}
      {isOwner && <p className="notice"><Link href={`/dashboard/${event.id}`} className="gold">Manage this event</Link></p>}

      <div className="event-hero" style={{ background: themeBackground(event.cover_theme) }}>
        {event.cover_url ? <img src={event.cover_url} alt={event.title} className="event-cover-img" /> : <div className="cover-title">{event.title}</div>}
      </div>

      <p className="when">{event.category} · {when} (Lagos){event.visibility === "private" ? " · Private event" : ""}</p>
      <h1>{event.title}</h1>
      <p className="muted">{[event.venue_name, event.city, event.country].filter(Boolean).join(" · ")}</p>

      {typeof going === "number" && (
        <p className="muted">{going} {going === 1 ? "person" : "people"} going</p>
      )}

      {event.description && <p className="desc">{event.description}</p>}

      <h2>Register</h2>
      {!event.registration_open && <p className="notice">Registration for this event is closed.</p>}
      {event.registration_open && !user && (
        <div className="signup-card">
          <b>Create a free account to register</b>
          <p className="muted small">Takes a few seconds. We&apos;ll email you a 6-digit code, no password needed. Your ticket and updates from the host will be saved to your account.</p>
          <Link href={`/sign-in?next=/e/${event.slug}`} className="btn-grad">Sign up to register</Link>
          <p className="muted small">Already have an account? <Link href={`/sign-in?next=/e/${event.slug}`} className="gold">Sign in</Link></p>
        </div>
      )}
      {event.registration_open && user && (
        <RegisterForm eventId={event.id} tiers={tiers ?? []} questions={questions ?? []} userEmail={user.email ?? ""} />
      )}

      {event.refund_policy && <p className="muted small">Refunds: {event.refund_policy}</p>}
    </main>
  );
}
