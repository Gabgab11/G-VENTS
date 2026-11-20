import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { api, data } from "@/lib/api/server";
import { requireUser } from "@/lib/auth";
import { siteOrigin } from "@/lib/ticket";
import OrderCard from "@/components/OrderCard";
import SiteHeader from "@/components/SiteHeader";
import ToastArea from "@/components/ToastArea";
import { Button } from "@/design";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tickets.myTickets");
  return { title: t("meta.title"), robots: { index: false, follow: false } };
}

// Every ticket of the signed-in guest (I7), upcoming or past, newest first. The ticket emails link
// here. "Load more" follows the API's cursor.
export default async function MyTicketsPage({ searchParams }: { searchParams: Promise<{ when?: string; cursor?: string }> }) {
  const { when: rawWhen, cursor } = await searchParams;
  const when = rawWhen === "past" ? "past" : "upcoming";
  const t = await getTranslations("tickets.myTickets");
  await requireUser(`/my-tickets${when === "past" ? "?when=past" : ""}`);

  const page = data(await (await api()).GET("/v1/me/orders", { params: { query: { when, ...(cursor ? { cursor } : {}), limit: 20 } } }));
  const origin = await siteOrigin();

  return (
    <ToastArea>
      <main className="tickets-page">
        <SiteHeader back="/" current="/my-tickets" />
        <h1>{t("heading")}</h1>
        <div className="seg" role="tablist" aria-label={t("which")}>
          <Link href="/my-tickets" className={when === "upcoming" ? "on" : ""} role="tab" aria-selected={when === "upcoming"}>{t("upcoming")}</Link>
          <Link href="/my-tickets?when=past" className={when === "past" ? "on" : ""} role="tab" aria-selected={when === "past"}>{t("past")}</Link>
        </div>

        {page.items.length === 0 ? (
          <p className="muted">{when === "upcoming" ? t("emptyUpcoming") : t("emptyPast")}</p>
        ) : (
          page.items.map((order) => <OrderCard key={order.id} order={order} origin={origin} showQr={when === "upcoming"} />)
        )}

        {page.nextCursor && (
          <Button variant="secondary" href={`/my-tickets?when=${when}&cursor=${encodeURIComponent(page.nextCursor)}`}>{t("loadMore")}</Button>
        )}
      </main>
    </ToastArea>
  );
}
