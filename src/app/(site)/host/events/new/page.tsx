import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { api, data } from "@/lib/api/server";
import { requireUser } from "@/lib/auth";
import { isThemeKey } from "@/lib/themes";
import { visitorCountry } from "@/lib/platform";
import { getAvailability } from "@/lib/payments";
import NewEventForm from "./NewEventForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("createEvent.stepper");
  return { title: t("title") };
}

// Create event (host area): a four-step form inside the host shell. Hosts must have an account
// first, so signed-out visitors go to sign-in and come back here.
export default async function NewEventPage() {
  await requireUser("/host/events/new");

  // The edge network (Vercel or Cloudflare) adds the visitor's country, from their IP address,
  // to every request, so detection costs no extra lookup and never asks for location permission.
  const incoming = await headers();
  const detectedCountry = visitorCountry((name) => incoming.get(name));
  const [me, availability] = await Promise.all([
    (await api()).GET("/v1/me").then(data).catch(() => null),
    getAvailability(),
  ]);
  // The cover style starts as the host's dashboard style.
  const defaultTheme = isThemeKey(me?.dashboardTheme) ? me.dashboardTheme : "minimal";
  // Paid tickets (M5): on when Paystack is on for the host's payout country, they're approved and owe nothing.
  const paid = availability?.me ?? null;

  return (
    <NewEventForm
      defaultTheme={defaultTheme}
      detectedCountry={detectedCountry}
      placesEnabled
      paid={{ canSell: !!paid?.canSellPaid && !!paid.currency, currency: paid?.currency ?? null, reason: paid?.reason ?? "payments_off" }}
    />
  );
}
