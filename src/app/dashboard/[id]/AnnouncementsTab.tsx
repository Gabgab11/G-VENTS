import { api, data } from "@/lib/api/server";
import { can, type EventDashboard } from "@/lib/auth";
import { createAnnouncement, sendAnnouncement } from "./actions";

const SEGMENT_LABELS = {
  all: "Everyone registered",
  paid: "Paid tickets only",
  checked_in: "Checked in",
  not_checked_in: "Not checked in yet",
  waitlist: "Waiting list",
} as const;

const resetDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(iso));

// Announcements through gventz-api: save a draft, then send it (C2). The free plan allows 2 sends
// per event, before it starts, and 1,000 announcement emails a month per host; the API enforces
// both and this tab shows what's left.
export default async function AnnouncementsTab({ event }: { event: EventDashboard }) {
  const id = event.id;
  const client = await api();
  const [past, allowance] = await Promise.all([
    client.GET("/v1/events/{id}/announcements", { params: { path: { id } } }).then(data),
    client.GET("/v1/events/{id}/announcements/allowance", { params: { path: { id } } }).then(data),
  ]);
  const canSend = can(event, "announcements.send");
  const sendsLeft = Math.max(0, allowance.sendsAllowed - allowance.sendsUsed);
  const emailsLeft = Math.max(0, allowance.emailsAllowed - allowance.emailsUsed);
  const started = new Date(event.startsAt).getTime() <= Date.now();

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-label">Free plan</div>
        <p className="small">
          <b>{sendsLeft} of {allowance.sendsAllowed}</b> announcements left for this event
          {" · "}
          <b>{emailsLeft.toLocaleString("en-GB")} of {allowance.emailsAllowed.toLocaleString("en-GB")}</b> announcement emails left this month
          <span className="muted"> (resets {resetDate(allowance.periodEndsAt)})</span>
        </p>
        <p className="muted small">
          Each guest counts once per announcement. Ticket emails don&apos;t count.
          {started && " This event has started, so announcements can no longer be sent."}
        </p>
      </section>

      {can(event, "announcements.draft") && (
        <section className="panel">
          <div className="panel-label">New announcement</div>
          <form action={createAnnouncement} className="form">
            <input type="hidden" name="event_id" value={id} />
            <label className="field"><span>Send to</span>
              <select className="input" name="segment" defaultValue="all">
                {(Object.keys(SEGMENT_LABELS) as (keyof typeof SEGMENT_LABELS)[]).map((key) => (
                  <option key={key} value={key}>{SEGMENT_LABELS[key]} ({allowance.audience[key]})</option>
                ))}
              </select></label>
            <label className="field"><span>Subject</span>
              <input className="input" name="subject" maxLength={200} placeholder="Doors open at 5:30 PM" /></label>
            <label className="field"><span>Message</span>
              <textarea className="input" name="body" rows={6} placeholder="Bring your ticket QR code. Parking is at gate B." /></label>
            <button className="btn-white" type="submit">Save draft</button>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="panel-label">Announcements</div>
        {past.length === 0 && <p className="muted small">None yet.</p>}
        {past.map((a) => {
          const audience = allowance.audience[a.segment as keyof typeof SEGMENT_LABELS] ?? 0;
          return (
            <div className="q-row" key={a.id}>
              <span>
                <b>{a.subject}</b>{" "}
                <span className="muted small">· {SEGMENT_LABELS[a.segment as keyof typeof SEGMENT_LABELS] ?? a.segment}</span>
              </span>
              {a.status === "draft" ? (
                canSend && !started && sendsLeft > 0 ? (
                  <form action={sendAnnouncement}>
                    <input type="hidden" name="event_id" value={id} />
                    <input type="hidden" name="announcement_id" value={a.id} />
                    <button className="btn-white" type="submit" disabled={audience === 0}>
                      Send to {audience} {audience === 1 ? "guest" : "guests"}
                    </button>
                  </form>
                ) : (
                  <span className="muted small">Draft</span>
                )
              ) : (
                <span className="muted small">
                  {a.status === "sent" ? "Sent" : "Sending"} · {a.sentCount} of {a.recipientCount} emailed
                </span>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
