import { createSupabaseServerClient } from "@/lib/supabase/server";
import CopyLink from "./CopyLink";
import { setRegistrationOpen, setCapacity } from "./actions";

type OverviewEvent = { registration_open: boolean; capacity: number | null; show_attendee_count: boolean };

export default async function OverviewTab({ id, url, event }: { id: string; url: string; event: OverviewEvent }) {
  const supabase = await createSupabaseServerClient();
  const registrations = () => supabase.from("registrations").select("id", { count: "exact", head: true }).eq("event_id", id);
  const [{ count: confirmed }, { count: waiting }, { count: checked }] = await Promise.all([
    registrations().eq("status", "confirmed"),
    registrations().eq("status", "waitlisted"),
    registrations().not("checked_in_at", "is", null),
  ]);

  return (
    <div className="stack">
      <div className="stats">
        <div className="stat"><b>{confirmed ?? 0}</b><span>Confirmed</span></div>
        <div className="stat"><b>{waiting ?? 0}</b><span>Waiting list</span></div>
        <div className="stat"><b>{checked ?? 0}</b><span>Checked in</span></div>
        <div className="stat"><b>{event.capacity ?? "∞"}</b><span>Capacity</span></div>
      </div>

      <section className="panel">
        <div className="panel-label">Share your event</div>
        <p className="muted small">Send this link to anyone. Guests register on the event page.</p>
        <CopyLink url={url} />
      </section>

      <section className="panel">
        <div className="spread">
          <div>
            <div className="option-title">Registration</div>
            <div className="muted small">{event.registration_open ? "Open. Guests can register." : "Closed. The register button is hidden."}</div>
          </div>
          <form action={setRegistrationOpen}>
            <input type="hidden" name="event_id" value={id} />
            <input type="hidden" name="open" value={event.registration_open ? "false" : "true"} />
            <button className={event.registration_open ? "btn-ghost" : "btn-grad"} type="submit">
              {event.registration_open ? "Close registration" : "Open registration"}
            </button>
          </form>
        </div>
      </section>

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
    </div>
  );
}
