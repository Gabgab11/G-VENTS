import type { Metadata } from "next";
import Link from "next/link";
import { api, data } from "@/lib/api/server";
import { requireUser } from "@/lib/auth";
import { siteOrigin } from "@/lib/ticket";
import OrderCard from "@/components/OrderCard";

export const metadata: Metadata = { title: "My tickets · G-ventZ", robots: { index: false, follow: false } };

// Every ticket of the signed-in guest (I7), upcoming or past, newest first. The ticket emails link
// here. "Load more" follows the API's cursor.
export default async function MyTicketsPage({ searchParams }: { searchParams: Promise<{ when?: string; cursor?: string }> }) {
  const { when: rawWhen, cursor } = await searchParams;
  const when = rawWhen === "past" ? "past" : "upcoming";
  await requireUser(`/my-tickets${when === "past" ? "?when=past" : ""}`);

  const page = data(await (await api()).GET("/v1/me/orders", { params: { query: { when, ...(cursor ? { cursor } : {}), limit: 20 } } }));
  const origin = await siteOrigin();

  return (
    <main className="wrap page">
      <h1>My tickets</h1>
      <div className="seg" role="tablist" aria-label="Which tickets">
        <Link href="/my-tickets" className={when === "upcoming" ? "on" : ""} role="tab" aria-selected={when === "upcoming"}>Upcoming</Link>
        <Link href="/my-tickets?when=past" className={when === "past" ? "on" : ""} role="tab" aria-selected={when === "past"}>Past</Link>
      </div>

      {page.items.length === 0 ? (
        <p className="muted">{when === "upcoming" ? "No upcoming tickets yet. Find something on Discover." : "No past events yet."}</p>
      ) : (
        page.items.map((order) => <OrderCard key={order.id} order={order} origin={origin} showQr={when === "upcoming"} />)
      )}

      {page.nextCursor && (
        <Link className="btn-ghost" href={`/my-tickets?when=${when}&cursor=${encodeURIComponent(page.nextCursor)}`}>Load more</Link>
      )}
    </main>
  );
}
