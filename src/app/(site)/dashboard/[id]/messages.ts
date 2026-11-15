import { apiMessageFor } from "@/lib/api/messages";

// Status messages shown after a dashboard action. The URL carries only the code
// (?ok=registration_opened), so a crafted link can't display arbitrary text. Each code maps to its
// message id in the dashboard area (messages/*/dashboard.json).
export const MESSAGES = {
  // success
  registration_opened: "notices.ok.registrationOpened",
  registration_closed: "notices.ok.registrationClosed",
  capacity_set: "notices.ok.capacitySet",
  capacity_unlimited: "notices.ok.capacityUnlimited",
  question_added: "notices.ok.questionAdded",
  question_removed: "notices.ok.questionRemoved",
  checked_in: "notices.ok.checkedIn",
  promoted: "notices.ok.promoted",
  approved: "notices.ok.approved",
  declined: "notices.ok.declined",
  venue_saved: "notices.ok.venueSaved",
  already_used: "notices.ok.alreadyUsed",
  announcement_saved: "notices.ok.announcementSaved",
  announcement_sending: "notices.ok.announcementSending",
  details_saved: "notices.ok.detailsSaved",
  flyer_uploaded: "notices.ok.flyerUploaded",
  flyer_removed: "notices.ok.flyerRemoved",
  event_cancelled: "notices.ok.eventCancelled",
  theme_saved: "notices.ok.themeSaved",
  refund_queued: "notices.ok.refundQueued",

  // errors
  capacity_invalid: "notices.err.capacityInvalid",
  question_missing: "notices.err.questionMissing",
  question_kind: "notices.err.questionKind",
  question_options: "notices.err.questionOptions",
  question_limit: "notices.err.questionLimit",
  checkin_failed: "notices.err.checkinFailed",
  promote_failed: "notices.err.promoteFailed",
  announcement_missing: "notices.err.announcementMissing",
  announcement_segment: "notices.err.announcementSegment",
  title_length: "notices.err.titleLength",
  venue_country: "notices.err.venueCountry",
  venue_maps_url: "notices.err.venueMapsUrl",
  flyer_missing: "notices.err.flyerMissing",
  flyer_type: "notices.err.flyerType",
  flyer_size: "notices.err.flyerSize",
  flyer_unreadable: "notices.err.flyerUnreadable",
  flyer_after_create: "notices.err.flyerAfterCreate",
  cancel_confirm: "notices.err.cancelConfirm",
  cancel_forbidden: "notices.err.cancelForbidden",
  delete_confirm: "notices.err.deleteConfirm",
  delete_forbidden: "notices.err.deleteForbidden",
  delete_paid: "notices.err.deletePaid",
  delete_failed: "notices.err.deleteFailed",
  theme_invalid: "notices.err.themeInvalid",
  refund_confirm: "notices.err.refundConfirm",
  not_saved: "notices.err.notSaved",
  failed: "notices.err.failed",
} as const;

export type MessageCode = keyof typeof MESSAGES;

/** A message function (next-intl's `t`, narrowed to what this needs). */
type Translate = { has(key: string): boolean; (key: string): string };

/**
 * A known code's text in the reader's language, or an API error code carried as `api.<code>` (see
 * src/lib/api/messages.ts). `t` is the dashboard area's translator, `errors` the errors area's.
 * English shows the API's own wording, as before; other languages its translation when known.
 */
export function messageFor(code: string | undefined, t: Translate, errors: Translate, lang: string): string | null {
  if (!code) return null;
  if (code.startsWith("api.")) {
    const apiCode = code.slice(4);
    const english = apiMessageFor(apiCode);
    if (!english) return t(MESSAGES.failed);
    return lang !== "en" && errors.has(apiCode) ? errors(apiCode) : english;
  }
  return Object.hasOwn(MESSAGES, code) ? t(MESSAGES[code as MessageCode]) : null;
}
