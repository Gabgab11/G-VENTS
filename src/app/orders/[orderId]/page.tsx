import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { ApiError } from "@/lib/api/problem";
import { requireUser } from "@/lib/auth";
import { isUuid } from "@/lib/forms";
import { siteOrigin } from "@/lib/ticket";
import BackLink from "@/components/BackLink";
import OrderCard from "@/components/OrderCard";

export const metadata: Metadata = { title: "Your tickets · G-ventZ", robots: { index: false, follow: false } };

// Where the order form lands (U6a): the order's result and every ticket. Only the buyer can open it.
export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
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
    <main className="wrap page">
      <BackLink fallback={order.event ? `/e/${order.event.slug}` : "/my-tickets"} label="← Back" />
      <h1>Your tickets</h1>
      <OrderCard order={order} origin={await siteOrigin()} showQr />
      <p className="muted small">
        {order.status === "completed" ? "We've also emailed your tickets to your account email. " : ""}
        All your tickets are in <Link href="/my-tickets" className="gold">My tickets</Link>.
      </p>
    </main>
  );
}
