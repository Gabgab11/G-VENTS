import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient, type SupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/forms";

export type EventRole = "owner" | "admin" | "editor" | "checkin" | "finance" | "viewer";

export const MANAGE_ROLES: EventRole[] = ["owner", "admin", "editor"];
export const STAFF_ROLES: EventRole[] = ["owner", "admin", "editor", "checkin", "finance", "viewer"];

type Session = { supabase: SupabaseServerClient; user: User };

// Signed-in user, or a redirect to sign-in that comes back to `returnTo`.
export async function requireUser(returnTo: string): Promise<Session> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return { supabase, user };
}

// Signed-in user who holds one of `roles` on the event. Anyone else gets a 404,
// so the page doesn't reveal whether the event exists.
// RLS still enforces the same rule in the database; this check gives a clear answer
// up front instead of an update that silently changes nothing.
export async function requireEventRole(eventId: string, roles: EventRole[] = MANAGE_ROLES): Promise<Session> {
  if (!isUuid(eventId)) notFound();
  const session = await requireUser(`/dashboard/${eventId}`);
  const { data: allowed, error } = await session.supabase.rpc("has_event_role", { p_event: eventId, p_roles: roles });
  if (error) throw new Error(`Permission check failed: ${error.message}`);
  if (!allowed) notFound();
  return session;
}
