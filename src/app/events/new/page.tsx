import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { getDashboardTheme } from "@/app/dashboard/getTheme";
import NewEventForm from "./NewEventForm";

// Hosts must have an account before creating an event, so sign-up happens first.
export default async function NewEventPage() {
  await requireUser("/events/new");

  const defaultTheme = await getDashboardTheme();

  // Vercel adds the visitor's country (from their IP address) to every request,
  // so detection costs no extra lookup and never asks for location permission.
  const detectedCountry = (await headers()).get("x-vercel-ip-country")?.toUpperCase() ?? null;

  return (
    <NewEventForm
      defaultTheme={defaultTheme}
      detectedCountry={detectedCountry}
      placesEnabled
    />
  );
}
