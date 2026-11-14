import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { getDashboardTheme } from "@/app/dashboard/getTheme";
import { visitorCountry } from "@/lib/platform";
import { getAvailability } from "@/lib/payments";
import NewEventForm from "./NewEventForm";

// Hosts must have an account before creating an event, so sign-up happens first.
export default async function NewEventPage() {
  await requireUser("/events/new");

  const defaultTheme = await getDashboardTheme();

  // The edge network (Vercel or Cloudflare) adds the visitor's country, from their IP address,
  // to every request, so detection costs no extra lookup and never asks for location permission.
  const incoming = await headers();
  const detectedCountry = visitorCountry((name) => incoming.get(name));
  // Paid tickets (M5): on when Paystack is on for the host's payout country, they're approved and owe nothing.
  const me = (await getAvailability())?.me ?? null;

  return (
    <NewEventForm
      defaultTheme={defaultTheme}
      detectedCountry={detectedCountry}
      placesEnabled
      paid={{ canSell: !!me?.canSellPaid && !!me.currency, currency: me?.currency ?? null, reason: me?.reason ?? "payments_off" }}
    />
  );
}
