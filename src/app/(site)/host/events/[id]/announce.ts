// Announcements (Change 4 chunk 5): templates, the audience and what's left of the free plan. The
// API enforces every limit; these decide what the composer shows and whether Send is on. Pure.
import type { components } from "@/lib/api/schema";

export type Allowance = components["schemas"]["AllowanceDto"];
export type Announcement = components["schemas"]["AnnouncementDto"];
export type Segment = Announcement["segment"];
export type TemplateId = NonNullable<Announcement["template"]>;

export const TEMPLATES = ["reminder", "reschedule", "lineup", "thanks", "feedback"] as const satisfies readonly TemplateId[];
export const SEGMENTS = ["all", "paid", "checked_in", "not_checked_in", "waitlist"] as const satisfies readonly Segment[];
/** Templates the API lets hosts send after the event has started. */
export const AFTER_START_TEMPLATES: readonly TemplateId[] = ["thanks", "feedback"];

export function isTemplate(value: unknown): value is TemplateId {
  return typeof value === "string" && (TEMPLATES as readonly string[]).includes(value);
}

export function isSegment(value: unknown): value is Segment {
  return typeof value === "string" && (SEGMENTS as readonly string[]).includes(value);
}

/** Recipients for an audience: distinct addresses, unsubscribed left out (the API's count). */
export function audienceCount(allowance: Pick<Allowance, "audience">, segment: Segment): number {
  return allowance.audience[segment] ?? 0;
}

export function remaining(allowance: Allowance): { sends: number; emails: number } {
  return {
    sends: Math.max(0, allowance.sendsAllowed - allowance.sendsUsed),
    emails: Math.max(0, allowance.emailsAllowed - allowance.emailsUsed),
  };
}

export type SendBlock = "sends" | "emails" | "quota" | "started" | "empty" | "draft";

/**
 * Why Send is off, or null when it can go: the event is a draft; it started (except thanks and
 * feedback); no announcements or emails left; this audience is bigger than the emails left; nobody
 * in the audience.
 */
export function sendBlock(input: { allowance: Allowance; segment: Segment; template: TemplateId | null; started: boolean; published: boolean }): SendBlock | null {
  const { allowance, segment, template, started, published } = input;
  if (!published) return "draft";
  if (started && !(template && AFTER_START_TEMPLATES.includes(template))) return "started";
  const left = remaining(allowance);
  if (left.sends === 0) return "sends";
  if (left.emails === 0) return "emails";
  const count = audienceCount(allowance, segment);
  if (count === 0) return "empty";
  if (count > left.emails) return "quota";
  return null;
}

/** Emails that didn't go out for a finished send (the API reports sent and recipients only). */
export function notSent(a: Pick<Announcement, "status" | "recipientCount" | "sentCount">): number {
  return a.status === "sent" ? Math.max(0, a.recipientCount - a.sentCount) : 0;
}
