import { apiMessageFor } from "@/lib/api/messages";

// Status messages shown after a dashboard action. The URL carries only the code
// (?ok=registration_opened), so a crafted link can't display arbitrary text.
export const MESSAGES = {
  // success
  registration_opened: "Registration is open",
  registration_closed: "Registration is closed",
  capacity_set: "Capacity saved. Extra guests go to the waiting list.",
  capacity_unlimited: "Capacity is unlimited",
  question_added: "Question added",
  question_removed: "Question removed",
  checked_in: "Checked in",
  promoted: "The next waiting group now has tickets. We've emailed them.",
  approved: "Approved. Their tickets are on the way by email.",
  declined: "Declined. We've let them know.",
  venue_saved: "Venue saved",
  already_used: "That ticket was already checked in",
  announcement_saved: "Saved as a draft. Send it when you're ready.",
  announcement_sending: "Sending now. Guests get it over the next few minutes.",
  details_saved: "Event details saved",
  flyer_uploaded: "Flyer uploaded",
  flyer_removed: "Flyer removed. The event shows its colour style again",
  event_cancelled: "Event cancelled. Registration is closed",
  theme_saved: "Page style saved. Guests will see it on the event page",

  // errors
  capacity_invalid: "Capacity must be a whole number above 0",
  question_missing: "Write the question first",
  question_kind: "Choose a question type",
  question_options: "Add at least two options",
  question_limit: "An event can have at most 30 questions",
  checkin_failed: "That guest couldn't be checked in. They may already be checked in, or not confirmed yet.",
  promote_failed: "Couldn't confirm the next guest. Nobody may be waiting, or their ticket type is sold out.",
  announcement_missing: "Add a subject and a message",
  announcement_segment: "Choose who to send it to",
  title_length: "Event name must be 3 to 140 characters",
  venue_country: "Choose a country from the list, or switch on Online event",
  flyer_missing: "Choose an image first",
  flyer_type: "Use a JPG, PNG, or WebP image",
  flyer_size: "The image is larger than 5 MB. Please resize it and try again",
  cancel_confirm: "Tick the box to confirm you want to cancel",
  cancel_forbidden: "Only the event owner or an admin can cancel this event",
  delete_confirm: "The name you typed doesn't match the event name, so nothing was deleted",
  delete_forbidden: "Only the person who created this event can delete it",
  delete_paid: "This event has paid tickets, so it can't be deleted. Cancel it instead",
  delete_failed: "The event couldn't be deleted. Please try again",
  theme_invalid: "Choose a style",
  not_saved: "Nothing was saved. You may not have permission to change this event.",
  failed: "Something went wrong. Please try again.",
} as const;

export type MessageCode = keyof typeof MESSAGES;

/** A known code, or an API error code carried as `api.<code>` (see src/lib/api/messages.ts). */
export function messageFor(code: string | undefined): string | null {
  if (!code) return null;
  if (code.startsWith("api.")) return apiMessageFor(code.slice(4)) ?? MESSAGES.failed;
  return Object.hasOwn(MESSAGES, code) ? MESSAGES[code as MessageCode] : null;
}
