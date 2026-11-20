// The event team (Change 4 chunk 5, D77): which roles the invite form offers, the members' order,
// and where an accepted invitation lands. The API decides who may do what; pure, so it's tested.
import type { components } from "@/lib/api/schema";

export type TeamMember = components["schemas"]["TeamMemberDto"];
export type TeamInvite = components["schemas"]["TeamInviteDto"];
export type MemberRole = TeamInvite["role"];

/** Offered first: co-host (admin) and door staff (checkin). */
export const PRIMARY_ROLES = ["admin", "checkin"] as const satisfies readonly MemberRole[];
/** Behind "More roles". */
export const MORE_ROLES = ["editor", "finance", "viewer"] as const satisfies readonly MemberRole[];
export const MEMBER_ROLES: readonly MemberRole[] = [...PRIMARY_ROLES, ...MORE_ROLES];

export function isMemberRole(value: unknown): value is MemberRole {
  return typeof value === "string" && (MEMBER_ROLES as readonly string[]).includes(value);
}

/** The roles a picker shows: the first two, all five with "More roles", and always the current one. */
export function roleOptions(more: boolean, current?: MemberRole): MemberRole[] {
  if (more || (current && !(PRIMARY_ROLES as readonly string[]).includes(current))) return [...MEMBER_ROLES];
  return [...PRIMARY_ROLES];
}

/** The owner first, then members by when they joined (earliest first), then by name. */
export function sortMembers(members: readonly TeamMember[]): TeamMember[] {
  return [...members].sort((a, b) => {
    if (a.role === "owner" !== (b.role === "owner")) return a.role === "owner" ? -1 : 1;
    const at = (m: TeamMember) => (m.joinedAt ? Date.parse(m.joinedAt) : Number.MAX_SAFE_INTEGER);
    return at(a) - at(b) || (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "");
  });
}

/** Where an accepted invitation goes: door staff to the scanner, everyone else to the workspace. */
export function landingPath(accepted: { eventId: string; role: string }): string {
  return accepted.role === "checkin" ? `/host/events/${accepted.eventId}/scan` : `/host/events/${accepted.eventId}`;
}

export type InviteProblem = "wrong_account" | "gone" | "not_found" | "failed";

/** The accept page's message for an API error code. */
export function inviteProblem(code: string | undefined): InviteProblem {
  if (code === "team.invite_wrong_account") return "wrong_account";
  if (code === "team.invite_gone") return "gone";
  if (code === "team.invite_not_found") return "not_found";
  return "failed";
}

/** Invitation tokens as the API mints them: 43 URL-safe base64 characters. */
export function isInviteToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}
