"use server";

import { revalidatePath } from "next/cache";
import { api, data } from "@/lib/api/server";
import { isUuid } from "@/lib/forms";
import { normalizeEmail } from "@/lib/email-code";
import { apiFailure, failure, ok, type ActionResult } from "./action-result";
import { isMemberRole } from "./team-roles";

// The event team (Change 4 chunk 5, D77): invite, resend, withdraw, change a role and remove. The
// owner and co-hosts may (members.manage); the API checks it and its rules (the owner is fixed, the
// only co-host can't step down) again.

const done = (eventId: string) => {
  revalidatePath(`/host/events/${eventId}`);
  return ok(undefined);
};

export async function inviteMember(eventId: string, rawEmail: unknown, role: unknown): Promise<ActionResult> {
  if (!isUuid(eventId)) return failure("notices.err.failed");
  const email = normalizeEmail(rawEmail);
  if (!email) return failure("team.errors.email", "email");
  if (!isMemberRole(role)) return failure("team.errors.role", "role");
  try {
    await (await api()).POST("/v1/events/{id}/team-invites", { params: { path: { id: eventId } }, body: { email, role } });
  } catch (error) {
    return apiFailure(error, "team invite");
  }
  return done(eventId);
}

/** Sends the invitation again: inviting the same email replaces the earlier link with a new one. */
export async function resendInvite(eventId: string, inviteId: string): Promise<ActionResult> {
  if (!isUuid(eventId) || !isUuid(inviteId)) return failure("notices.err.failed");
  const client = await api();
  try {
    const team = data(await client.GET("/v1/events/{id}/team", { params: { path: { id: eventId } } }));
    const invite = team.invites.find((i) => i.id === inviteId);
    if (!invite) return failure("team.errors.inviteGone");
    await client.POST("/v1/events/{id}/team-invites", { params: { path: { id: eventId } }, body: { email: invite.email, role: invite.role } });
  } catch (error) {
    return apiFailure(error, "team resend");
  }
  return done(eventId);
}

export async function revokeInvite(eventId: string, inviteId: string): Promise<ActionResult> {
  if (!isUuid(eventId) || !isUuid(inviteId)) return failure("notices.err.failed");
  try {
    await (await api()).DELETE("/v1/events/{id}/team-invites/{inviteId}", { params: { path: { id: eventId, inviteId } } });
  } catch (error) {
    return apiFailure(error, "team revoke");
  }
  return done(eventId);
}

export async function changeMemberRole(eventId: string, userId: string, role: unknown): Promise<ActionResult> {
  if (!isUuid(eventId) || !isUuid(userId)) return failure("notices.err.failed");
  if (!isMemberRole(role)) return failure("team.errors.role");
  try {
    await (await api()).PATCH("/v1/events/{id}/members/{userId}", { params: { path: { id: eventId, userId } }, body: { role } });
  } catch (error) {
    return apiFailure(error, "team role");
  }
  return done(eventId);
}

export async function removeMember(eventId: string, userId: string): Promise<ActionResult> {
  if (!isUuid(eventId) || !isUuid(userId)) return failure("notices.err.failed");
  try {
    await (await api()).DELETE("/v1/events/{id}/members/{userId}", { params: { path: { id: eventId, userId } } });
  } catch (error) {
    return apiFailure(error, "team remove");
  }
  return done(eventId);
}
