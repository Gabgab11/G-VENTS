import { api, data } from "@/lib/api/server";
import { can, type EventDashboard } from "@/lib/auth";
import { createAnnouncement } from "./actions";

// Announcement drafts through gventz-api. Sending arrives with a later unit.
export default async function AnnouncementsTab({ event }: { event: EventDashboard }) {
  const id = event.id;
  const past = data(await (await api()).GET("/v1/events/{id}/announcements", { params: { path: { id } } }));
  return (
    <div className="stack">
      {can(event, "announcements.draft") && (
        <section className="panel">
          <div className="panel-label">New announcement</div>
          <form action={createAnnouncement} className="form">
            <input type="hidden" name="event_id" value={id} />
            <label className="field"><span>Send to</span>
              <select className="input" name="segment" defaultValue="all">
                <option value="all">Everyone registered</option>
                <option value="paid">Paid tickets only</option>
                <option value="checked_in">Checked in</option>
                <option value="not_checked_in">Not checked in yet</option>
                <option value="waitlist">Waiting list</option>
              </select></label>
            <label className="field"><span>Subject</span>
              <input className="input" name="subject" maxLength={200} placeholder="Doors open at 5:30 PM" /></label>
            <label className="field"><span>Message</span>
              <textarea className="input" name="body" rows={6} placeholder="Hi {{first_name}}, see you on {{event_date}}." /></label>
            <button className="btn-white" type="submit">Save announcement</button>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="panel-label">Previous announcements</div>
        {past.length === 0 && <p className="muted small">None yet.</p>}
        {past.map((a) => (
          <div className="q-row" key={a.id}>
            <span><b>{a.subject}</b> <span className="muted small">· {a.segment.replaceAll("_", " ")}</span></span>
            <span className="muted small">{a.status}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
