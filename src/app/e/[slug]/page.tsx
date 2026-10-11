import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { themeBackground } from "@/lib/themes";

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: event } = await supabase
    .from("events")
    .select("id, owner_id, title, slug, category, description, starts_at, ends_at, venue_name, city, country, status, visibility, show_attendee_count, refund_policy, cover_theme")
    .eq("slug", slug)
    .maybeSingle();

  if (!event) notFound();

  const isOwner = !!user && user.id === event.owner_id;

  const { data: tiers } = await supabase
    .from("ticket_tiers")
    .select("id, name, price_minor, quantity, sold")
    .eq("event_id", event.id)
    .order("price_minor", { ascending: true });

  // The organizer always sees the count. Guests see it only if the organizer allows it.
  let going: number | null = null;
  if (isOwner || event.show_attendee_count) {
    const { count } = await supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("status", "confirmed");
    going = count ?? 0;
  }

  const when = new Date(event.starts_at).toLocaleString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos",
  });

  return (
    <main className="wrap page">
      <Link href="/" className="muted">← G-vents</Link>

      {event.status === "draft" && <p className="notice">Draft. Only you can see this page.</p>}
      {isOwner && <p className="notice"><Link href="/dashboard" className="gold">Manage in your dashboard</Link></p>}

      <div className="event-hero" style={{ background: themeBackground(event.cover_theme) }}>
        <div className="cover-title">{event.title}</div>
      </div>

      <p className="when">{event.category} · {when} (Lagos){event.visibility === "private" ? " · Private event" : ""}</p>
      <h1>{event.title}</h1>
      <p className="muted">{[event.venue_name, event.city, event.country].filter(Boolean).join(" · ")}</p>

      {going !== null && (
        <p className="muted">{going} {going === 1 ? "person" : "people"} going{isOwner && !event.show_attendee_count ? " (hidden from guests)" : ""}</p>
      )}

      {event.description && <p className="desc">{event.description}</p>}

      <h2>Tickets</h2>
      <div className="form" style={{ gap: 10 }}>
        {(tiers ?? []).map((t) => {
          const left = t.quantity === null ? "Unlimited" : `${Math.max(t.quantity - t.sold, 0)} left`;
          const price = t.price_minor === 0 ? "Free" : `₦${(t.price_minor / 100).toLocaleString()}`;
          return (
            <div className="tier-card" key={t.id}>
              <div className="spread"><b>{t.name}</b><b>{price}</b></div>
              <p className="muted small">{left}</p>
            </div>
          );
        })}
      </div>

      <p className="notice">Registration and payment are the next step.</p>
      {event.refund_policy && <p className="muted small">Refunds: {event.refund_policy}</p>}
    </main>
  );
}
