import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { api, data } from "@/lib/api/server";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/forms";

export type EventRole = "owner" | "admin" | "editor" | "checkin" | "finance" | "viewer";
export type EventDashboard = components["schemas"]["EventDashboardDto"];

// Signed-in user (Supabase is used for sign-in only), or a redirect to sign-in that comes back.
export async function requireUser(returnTo: string): Promise<{ user: User }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return { user };
}

/**
 * The event as its team sees it, from gventz-api: details, the caller's role and permissions, and
 * the counts. Anyone without a role gets a 404, so the page doesn't reveal the event exists (the
 * API answers 404 too). Loaded once per request however many components ask.
 */
export const requireEvent = cache(async (eventId: string): Promise<EventDashboard> => {
  if (!isUuid(eventId)) notFound();
  await requireUser(`/dashboard/${eventId}`);
  try {
    return data(await (await api()).GET("/v1/events/{id}", { params: { path: { id: eventId } } }));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }
});

export function can(event: EventDashboard, permission: string): boolean {
  return event.permissions.includes(permission);
}
