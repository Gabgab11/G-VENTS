import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { ApiError } from "@/lib/api/problem";
import { requireUser } from "@/lib/auth";
import { isUuid } from "@/lib/forms";
import { siteOrigin } from "@/lib/ticket";
import OrderCard from "@/components/OrderCard";
import SiteHeader from "@/components/SiteHeader";
import PaymentStatus from "./PaymentStatus";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tickets.order");
  return { title: t("meta.title"), robots: { index: false, follow: false } };
}

// Where the order form lands (U6a): the order's result and every ticket. Only the buyer can open it.
// It is also where Paystack sends the guest back (M5): any ?reference= / ?trxref= it adds is ignored;
// the payment status always comes from the API, and the page keeps checking until it's final.
export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const t = await getTranslations("tickets.order");
  if (!isUuid(orderId)) notFound();
  await requireUser(`/orders/${orderId}`);

  let order;
  try {
    order = data(await (await api()).GET("/v1/me/orders/{orderId}", { params: { path: { orderId } } }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <main className="tickets-page">
      <SiteHeader back={order.event ? `/e/${order.event.slug}` : "/my-tickets"} />
      <h1>{order.status === "completed" ? t("headingIn") : order.payment ? t("headingOrder") : t("headingTickets")}</h1>
      {order.payment && <PaymentStatus orderId={order.id} payment={order.payment} eventSlug={order.event?.slug ?? null} />}
      {(!order.payment || order.tickets.length > 0) && <OrderCard order={order} origin={await siteOrigin()} showQr />}
      <p className="muted small">
        {t.rich(order.status === "completed" ? "footCompleted" : "foot", { link: (c) => <Link href="/my-tickets" className="gold">{c}</Link> })}
      </p>
    </main>
  );
}
