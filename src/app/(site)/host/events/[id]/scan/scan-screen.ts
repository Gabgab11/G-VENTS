// What the door screen shows for each scan result from gventz-api (U4 business-rules §8).
import { intlLocale } from "@/lib/format";
import type { Locale } from "@/i18n/languages";

export type ScanResult = {
  result: string;
  reason: string;
  ticket: {
    displayName: string;
    ticketType: string;
    number: number | null;
    total: number | null;
    /** People per purchase of the ticket's type (D90); above 1 the screen says "Group of N". */
    groupSize?: number;
    checkedInAt: string | null;
    checkedInByName: string | null;
  } | null;
};

export type ScanScreen = { tone: "green" | "red"; title: string; detail: string };

/** The dashboard.scan translator (next-intl's `t`, narrowed to what this needs). */
export type ScanTranslate = { has(key: string): boolean; (key: string, values?: Record<string, string | number>): string };

// Reasons with their own title (dashboard.scan.red.<reason>); anything else is "Not valid".
const RED_REASONS = ["already_used", "not_confirmed", "waitlisted", "refunded", "cancelled", "wrong_event", "not_found"];

function time(iso: string | null, lang: Locale): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(intlLocale(lang, "date"), { hour: "2-digit", minute: "2-digit" });
}

export function scanScreen(scan: ScanResult, t: ScanTranslate, lang: Locale): ScanScreen {
  const ticket = scan.ticket;
  const who = ticket
    ? `${ticket.displayName} · ${ticket.ticketType}${(ticket.groupSize ?? 1) > 1 ? ` · ${t("groupOf", { count: ticket.groupSize! })}` : ""}${ticket.number && ticket.total && ticket.total > 1 ? ` · ${t("ticketNumber", { number: ticket.number, total: ticket.total })}` : ""}`
    : "";
  if (scan.result === "green") return { tone: "green", title: t("welcome"), detail: who };
  if (scan.reason === "already_used" && ticket) {
    const at = time(ticket.checkedInAt, lang);
    const detail = ticket.checkedInByName ? t("usedAtBy", { who, time: at, name: ticket.checkedInByName }) : t("usedAt", { who, time: at });
    return { tone: "red", title: t("red.already_used"), detail };
  }
  return { tone: "red", title: RED_REASONS.includes(scan.reason) ? t(`red.${scan.reason}`) : t("notValid"), detail: who };
}
