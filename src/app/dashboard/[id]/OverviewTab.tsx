import { can, type EventDashboard } from "@/lib/auth";
import CopyLink from "./CopyLink";
import { setRegistrationOpen, setCapacity } from "./actions";

export default function OverviewTab({ event, url }: { event: EventDashboard; url: string }) {
  const id = event.id;
  const { counts } = event;
  const edit = can(event, "event.edit");
  return (
    <div className="stack">
      <div className="stats">
        <div className="stat"><b>{counts.confirmed}</b><span>Confirmed</span></div>
        <div className="stat"><b>{counts.pending}</b><span>Waiting for approval</span></div>
        <div className="stat"><b>{counts.waitlisted}</b><span>Waiting list</span></div>
        <div className="stat"><b>{counts.checkedIn}</b><span>Checked in</span></div>
        <div className="stat"><b>{event.capacity ?? "∞"}</b><span>Capacity</span></div>
      </div>

      <section className="panel">
        <div className="panel-label">Share your event</div>
        <p className="muted small">Send this link to anyone. Guests get tickets on the event page.</p>
        <CopyLink url={url} />
      </section>

      {edit && (
        <section className="panel">
          <div className="spread">
            <div>
              <div className="option-title">Registration</div>
              <div className="muted small">{event.registrationOpen ? "Open. Guests can get tickets." : "Closed. The ticket form is hidden."}</div>
            </div>
            <form action={setRegistrationOpen}>
              <input type="hidden" name="event_id" value={id} />
              <input type="hidden" name="open" value={event.registrationOpen ? "false" : "true"} />
              <button className={event.registrationOpen ? "btn-ghost" : "btn-grad"} type="submit">
                {event.registrationOpen ? "Close registration" : "Open registration"}
              </button>
            </form>
          </div>
        </section>
      )}

      {edit && (
        <section className="panel">
          <label className="option-title" htmlFor="capacity">Capacity</label>
          <p className="muted small" id="capacity-hint">Set a limit, such as 200. When it&apos;s full, new guests join the waiting list. Leave blank for unlimited.</p>
          <form action={setCapacity} className="row-form">
            <input type="hidden" name="event_id" value={id} />
            <input id="capacity" aria-describedby="capacity-hint" className="input" name="capacity" inputMode="numeric"
              defaultValue={event.capacity ?? ""} placeholder="e.g. 200" />
            <button className="btn-white" type="submit">Save capacity</button>
          </form>
        </section>
      )}
    </div>
  );
}
