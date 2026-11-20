// The event activity log (Change 4 chunk 5): every action the API records gets a translated
// sentence (dashboard.activity.actions.*); an action this website doesn't know yet shows as plain
// text. Kinds group actions for the filter. Pure, so it's tested.
import type { components } from "@/lib/api/schema";

export type ActivityItem = components["schemas"]["ActivityItemDto"];

/** Every action gventz-api writes (modules/events/domain/activity.ts), with its message id. */
export const ACTIVITY_LABELS = {
  "event.created": "eventCreated",
  "event.edited": "eventEdited",
  "event.rescheduled": "eventRescheduled",
  "event.published": "eventPublished",
  "event.unpublished": "eventUnpublished",
  "event.cancelled": "eventCancelled",
  "team.invited": "teamInvited",
  "team.invite_revoked": "teamInviteRevoked",
  "team.invite_accepted": "teamInviteAccepted",
  "team.role_changed": "teamRoleChanged",
  "team.member_removed": "teamMemberRemoved",
  "guest.checked_in": "guestCheckedIn",
  "refund.requested": "refundRequested",
  "refund.processed": "refundProcessed",
  "images.added": "imagesAdded",
  "images.removed": "imagesRemoved",
  "images.reordered": "imagesReordered",
} as const;

export type ActivityAction = keyof typeof ACTIVITY_LABELS;

/** Filter groups, in the order the filter lists them. */
export const ACTIVITY_KINDS = ["event", "team", "guest", "refund", "images"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export function isActivityKind(value: unknown): value is ActivityKind {
  return typeof value === "string" && (ACTIVITY_KINDS as readonly string[]).includes(value);
}

/** The message id for an action, or null when this website doesn't know it (shown as plain text). */
export function activityLabelKey(action: string): (typeof ACTIVITY_LABELS)[ActivityAction] | null {
  return Object.hasOwn(ACTIVITY_LABELS, action) ? ACTIVITY_LABELS[action as ActivityAction] : null;
}

/** The kind of an action ("team.invited" → "team"); null for unknown kinds. */
export function activityKind(action: string): ActivityKind | null {
  const prefix = action.split(".")[0];
  return isActivityKind(prefix) ? prefix : null;
}

export function filterActivity(items: readonly ActivityItem[], kind: ActivityKind | "all"): ActivityItem[] {
  return kind === "all" ? [...items] : items.filter((i) => activityKind(i.action) === kind);
}

const text = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/**
 * The values a sentence uses. `role` is a team role id (translated by the caller), `subject` the
 * member's name or the invited email, `amount` integer minor units with its currency.
 */
export function activityValues(item: ActivityItem): { subject: string | null; role: string | null; at: string | null; amountMinor: number | null; currency: string | null } {
  const meta = item.meta ?? {};
  const role = text(item.action === "team.role_changed" ? meta.to : meta.role);
  const amountMinor = typeof meta.amountMinor === "number" && Number.isInteger(meta.amountMinor) ? meta.amountMinor : null;
  return {
    subject: item.subjectName ?? (item.action.startsWith("team.") ? item.subject : null),
    role,
    at: item.action === "event.rescheduled" ? text(meta.startsAt) : null,
    amountMinor,
    currency: text(meta.currency),
  };
}

/** Merges a further page into the list, keeping order and leaving out entries already shown. */
export function appendPage(items: readonly ActivityItem[], next: readonly ActivityItem[]): ActivityItem[] {
  const seen = new Set(items.map((i) => i.id));
  return [...items, ...next.filter((i) => !seen.has(i.id))];
}
