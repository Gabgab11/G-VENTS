import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDashboardTheme } from "@/app/dashboard/getTheme";
import NewEventForm from "./NewEventForm";

// Hosts must have an account before creating an event, so sign-up happens first.
export default async function NewEventPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/events/new");

  const defaultTheme = await getDashboardTheme(supabase, user.id);
  return <NewEventForm defaultTheme={defaultTheme} />;
}
