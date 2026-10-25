// User-facing text for gventz-api error codes that dashboard actions can return. Pages show
// messages from a code in the URL (?err=api.event.title_length), never text from the URL itself,
// so a crafted link can't display arbitrary words. Texts match the API's own messages; codes whose
// API message includes a value (a number, a label) get a fixed wording here.

export const API_MESSAGES: Readonly<Record<string, string>> = {
  "announcement.already_sent": "This announcement has already been sent.",
  "announcement.event_draft": "Publish the event before sending announcements.",
  "announcement.event_limit": "You've used both free announcements for this event.",
  "announcement.event_started": "Announcements can only be sent before the event starts.",
  "announcement.fields_required": "Add a subject and a message.",
  "announcement.no_recipients": "Nobody in this audience can receive emails yet.",
  "announcement.not_found": "This announcement could not be found.",
  "announcement.quota_exceeded": "This would go over your free announcement emails for this month. Pick a smaller audience or wait for the monthly reset.",
  "announcement.segment_invalid": "Choose who receives this announcement.",
  "event.already_cancelled": "This event is already cancelled.",
  "event.buyer_limit_invalid": "Choose a limit from 1 to 10 tickets per person.",
  "event.cancel_confirm": "Confirm that you want to cancel this event.",
  "event.cancelled": "This event was cancelled.",
  "event.capacity_invalid": "Capacity must be a whole number from 1 to 1,000,000, or empty for unlimited.",
  "event.category_invalid": "Choose a category.",
  "event.country_invalid": "Choose a country from the list.",
  "event.delete_confirm": "Type the event name exactly to confirm.",
  "event.description_length": "The description can be at most 5,000 characters.",
  "event.forbidden": "You don't have permission to do that for this event.",
  "event.has_paid_registrations": "Events with paid tickets can't be deleted. Cancel it instead.",
  "event.location_invalid": "Check the venue details.",
  "event.not_found": "Event not found.",
  "event.refund_policy_length": "The refund policy can be at most 2,000 characters.",
  "event.region_invalid": "Choose a region from the list.",
  "event.time_zone_required": "Choose the event's time zone.",
  "event.title_length": "Event name must be 3 to 140 characters.",
  "flyer.not_uploaded": "The upload didn't finish. Please try again.",
  "flyer.path_invalid": "That upload doesn't belong to this event.",
  "flyer.size": "Flyers can be at most 5 MB.",
  "flyer.storage_unavailable": "Flyer uploads are unavailable right now. Please try again shortly.",
  "flyer.type": "Use a JPEG, PNG or WebP image.",
  "order.not_found": "That request no longer exists.",
  "order.not_pending": "This request has already been decided.",
  "order.transition_not_allowed": "This order cannot be changed that way.",
  "question.kind_invalid": "Choose a question type.",
  "question.label_length": "Questions must be 1 to 200 characters.",
  "question.limit": "An event can have at most 30 questions.",
  "question.not_found": "That question was already removed.",
  "question.options_count": "Add at least 2 different options.",
  "rate_limit.exceeded": "Too many requests. Please wait a moment and try again.",
  "validation.failed": "Some fields are not valid. Check them and try again.",
  "waitlist.empty": "Nobody is on the waiting list.",
  "waitlist.none_fits": "The next waiting group needs more places than are free.",
};

export function apiMessageFor(code: string): string | null {
  return Object.hasOwn(API_MESSAGES, code) ? API_MESSAGES[code]! : null;
}
