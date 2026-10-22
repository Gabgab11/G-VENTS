import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDashboardTheme } from "@/app/dashboard/getTheme";
import { placesConfigured } from "@/lib/places";
import NewEventForm from "./NewEventForm";

// Hosts must have an account before creating an event, so sign-up happens first.
export default async function NewEventPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/events/new");

  const defaultTheme = await getDashboardTheme(supabase, user.id);

  // Vercel adds the visitor's country (from their IP address) to every request,
  // so detection costs no extra lookup and never asks for location permission.
  const detectedCountry = (await headers()).get("x-vercel-ip-country")?.toUpperCase() ?? null;

  return (
    <NewEventForm
      defaultTheme={defaultTheme}
      detectedCountry={detectedCountry}
      placesEnabled={placesConfigured()}
    />
  );
}
