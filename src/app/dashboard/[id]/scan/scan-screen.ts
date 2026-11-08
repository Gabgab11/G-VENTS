// What the door screen shows for each scan result from gventz-api (U4 business-rules §8).

export type ScanResult = {
  result: string;
  reason: string;
  ticket: {
    displayName: string;
    ticketType: string;
    number: number | null;
    total: number | null;
    checkedInAt: string | null;
    checkedInByName: string | null;
  } | null;
};

export type ScanScreen = { tone: "green" | "red"; title: string; detail: string };

const RED_TITLE: Record<string, string> = {
  already_used: "Already checked in",
  not_confirmed: "Not confirmed",
  waitlisted: "On the waiting list",
  refunded: "Refunded",
  cancelled: "Not valid",
  wrong_event: "Ticket for another event",
  not_found: "Ticket not found",
};

function time(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function scanScreen(scan: ScanResult): ScanScreen {
  const t = scan.ticket;
  const who = t ? `${t.displayName} · ${t.ticketType}${t.number && t.total && t.total > 1 ? ` · ${t.number} of ${t.total}` : ""}` : "";
  if (scan.result === "green") return { tone: "green", title: "Welcome in", detail: who };
  if (scan.reason === "already_used" && t) {
    const by = t.checkedInByName ? ` by ${t.checkedInByName}` : "";
    return { tone: "red", title: RED_TITLE.already_used!, detail: `${who} · at ${time(t.checkedInAt)}${by}` };
  }
  return { tone: "red", title: RED_TITLE[scan.reason] ?? "Not valid", detail: who };
}
