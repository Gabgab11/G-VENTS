import { createSupabaseServerClient } from "@/lib/supabase/server";
import { themeBackground } from "@/lib/themes";
import { updateEventDetails, uploadFlyer, removeFlyer, cancelEvent } from "./actions";

export default async function SettingsTab({ id }: { id: string }) {
  const supabase = await createSupabaseServerClient();
  const { data: e } = await supabase
    .from("events")
    .select("id, title, description, venue_name, city, country, refund_policy, visibility, notify_registration, cover_url, cover_theme, status")
    .eq("id", id)
    .maybeSingle();
  if (!e) return null;

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-label">Event flyer</div>
        <p className="muted small">Shown on the event page and in Discover. Use JPG, PNG, or WebP, up to 5 MB. Tall or square works best.</p>
        <div className="flyer-preview" style={{ background: themeBackground(e.cover_theme) }}>
          {e.cover_url ? <img src={e.cover_url} alt="Event flyer" /> : <span className="muted small">No flyer yet</span>}
        </div>
        <form action={uploadFlyer} className="row-form">
          <input type="hidden" name="event_id" value={id} />
          <input className="input" type="file" name="flyer" accept="image/jpeg,image/png,image/webp" required />
          <button className="btn-white" type="submit">Upload flyer</button>
        </form>
        {e.cover_url && (
          <form action={removeFlyer}>
            <input type="hidden" name="event_id" value={id} />
            <button className="link-btn" type="submit">Remove flyer</button>
          </form>
        )}
      </section>

      <section className="panel">
        <div className="panel-label">Event details</div>
        <form action={updateEventDetails} className="form">
          <input type="hidden" name="event_id" value={id} />
          <label className="field"><span>Event name</span>
            <input className="input" name="title" defaultValue={e.title} required minLength={3} maxLength={140} /></label>
          <label className="field"><span>About this event</span>
            <textarea className="input" name="description" rows={5} defaultValue={e.description ?? ""} /></label>
          <div className="row2">
            <label className="field"><span>Venue</span>
              <input className="input" name="venue" defaultValue={e.venue_name ?? ""} /></label>
            <label className="field"><span>City</span>
              <input className="input" name="city" defaultValue={e.city ?? ""} /></label>
          </div>
          <label className="field"><span>Country</span>
            <input className="input" name="country" defaultValue={e.country ?? ""} /></label>
          <label className="field"><span>Who can find it</span>
            <select className="input" name="visibility" defaultValue={e.visibility}>
              <option value="public">Public: listed in Discover</option>
              <option value="private">Private: only people with the link</option>
            </select></label>
          <label className="field"><span>Refund policy</span>
            <textarea className="input" name="refund_policy" rows={3} defaultValue={e.refund_policy ?? ""} /></label>
          <label className="check">
            <input type="checkbox" name="notify_registration" defaultChecked={e.notify_registration} />
            <span>Email me when someone registers</span>
          </label>
          <button className="btn-white" type="submit">Save details</button>
        </form>
      </section>

      <section className="panel danger">
        <div className="panel-label">Cancel event</div>
        {e.status === "cancelled" ? (
          <p className="muted small">This event is cancelled. Registration is closed.</p>
        ) : (
          <form action={cancelEvent} className="form">
            <input type="hidden" name="event_id" value={id} />
            <p className="muted small">Cancelling closes registration and hides the event from Discover. Guests already registered are not refunded automatically.</p>
            <label className="check"><input type="checkbox" name="confirm" value="yes" /> <span>I understand, cancel this event</span></label>
            <button className="btn-danger" type="submit">Cancel event</button>
          </form>
        )}
      </section>
    </div>
  );
}
