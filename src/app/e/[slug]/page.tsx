import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, title, slug, category, description, starts_at, venue_name, city, country, status, refund_policy")
    .eq("slug", slug)
    .maybeSingle();

  if (!event) notFound();

  const { data: tiers } = await supabase
    .from("ticket_tiers")
    .select("id, name, price_minor, currency, quantity, sold, is_active")
    .eq("event_id", event.id)
    .order("price_minor", { ascending: true });

  const when = new Date(event.starts_at).toLocaleString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos",
  });

  return (
    <main className="wrap page">
      <Link href="/" className="muted">← G-vents</Link>
      {event.status === "draft" && <p className="notice">This event is a draft. Only you can see it.</p>}
      <p className="when">{event.category} · {when} (Lagos)</p>
      <h1>{event.title}</h1>
      <p className="muted">{[event.venue_name, event.city, event.country].filter(Boolean).join(" · ")}</p>

      {event.description && <p className="desc">{event.description}</p>}

      <h2>Tickets</h2>
      <div className="form" style={{ gap: 10 }}>
        {(tiers ?? []).map((t) => {
          const left = t.quantity === null ? "Unlimited" : `${Math.max(t.quantity - t.sold, 0)} left`;
          const price = t.price_minor === 0 ? "Free" : `₦${(t.price_minor / 100).toLocaleString()}`;
          return (
            <div className="tier-card" key={t.id}>
              <div className="spread"><b>{t.name}</b><b>{price}</b></div>
              <p className="muted">{left}</p>
            </div>
          );
        })}
      </div>

      <p className="notice">Registration and payment are the next step.</p>
      {event.refund_policy && <p className="muted">Refunds: {event.refund_policy}</p>}
    </main>
  );
}
