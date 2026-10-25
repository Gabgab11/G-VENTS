import { headers } from "next/headers";
import { api, data } from "@/lib/api/server";
import { can, type EventDashboard } from "@/lib/auth";
import { whereText } from "@/lib/event-page";
import { THEMES, themeBackground } from "@/lib/themes";
import { cancelEvent, removeFlyer, updateEventDetails, updateEventTheme, uploadFlyer } from "./actions";
import DeleteEventForm from "./DeleteEventForm";
import VenueForm from "./VenueForm";

// Event settings from the dashboard response (gventz-api); every change goes through the API.
export default async function SettingsTab({ event: e }: { event: EventDashboard }) {
  const id = e.id;
  const edit = can(e, "event.edit");
  // Only the owner can delete; the check also tells whether paid tickets block it.
  const del = can(e, "event.delete") ? await (await api()).GET("/v1/events/{id}/deletion-check", { params: { path: { id } } }).then(data).catch(() => null) : null;
  const detectedCountry = (await headers()).get("x-vercel-ip-country")?.toUpperCase() ?? null;

  return (
    <div className="stack">
      {edit && (
        <section className="panel">
          <div className="panel-label">Page style</div>
          <p className="muted small">The colours guests see on the event page.</p>
          <form action={updateEventTheme} className="row-form">
            <input type="hidden" name="event_id" value={id} />
            <select className="input" name="cover_theme" defaultValue={e.coverTheme ?? "minimal"}>
              {Object.entries(THEMES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
            </select>
            <button className="btn-white" type="submit">Save style</button>
          </form>
        </section>
      )}

      {can(e, "flyer.manage") && (
        <section className="panel">
          <div className="panel-label">Event flyer</div>
          <p className="muted small">Shown on the event page and in Discover. Use JPG, PNG, or WebP, up to 5 MB. Tall or square works best.</p>
          <div className="flyer-preview" style={{ background: themeBackground(e.coverTheme) }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- flyers come from Supabase Storage at arbitrary sizes */}
            {e.coverUrl ? <img src={e.coverUrl} alt="Event flyer" /> : <span className="muted small">No flyer yet</span>}
          </div>
          <form action={uploadFlyer} className="row-form">
            <input type="hidden" name="event_id" value={id} />
            <input className="input" type="file" name="flyer" accept="image/jpeg,image/png,image/webp" required />
            <button className="btn-white" type="submit">Upload flyer</button>
          </form>
          {e.coverUrl && (
            <form action={removeFlyer}>
              <input type="hidden" name="event_id" value={id} />
              <button className="link-btn" type="submit">Remove flyer</button>
            </form>
          )}
        </section>
      )}

      {edit && (
        <section className="panel">
          <div className="panel-label">Event details</div>
          <form action={updateEventDetails} className="form">
            <input type="hidden" name="event_id" value={id} />
            <label className="field"><span>Event name</span>
              <input className="input" name="title" defaultValue={e.title} required minLength={3} maxLength={140} /></label>
            <label className="field"><span>About this event</span>
              <textarea className="input" name="description" rows={5} defaultValue={e.description ?? ""} /></label>
            <label className="field"><span>Who can find it</span>
              <select className="input" name="visibility" defaultValue={e.visibility}>
                <option value="public">Public: listed in Discover</option>
                <option value="private">Private: only people with the link</option>
              </select></label>
            <label className="field"><span>Refund policy</span>
              <textarea className="input" name="refund_policy" rows={3} defaultValue={e.refundPolicy ?? ""} /></label>
            <label className="check">
              <input type="checkbox" name="notify_registration" defaultChecked={e.notifyRegistration} />
              <span>Email me when someone registers</span>
            </label>
            <button className="btn-white" type="submit">Save details</button>
          </form>
        </section>
      )}

      {edit && (
        <section className="panel">
          <div className="panel-label">Venue</div>
          <VenueForm eventId={id} current={whereText(e.location)} detectedCountry={detectedCountry} />
        </section>
      )}

      {can(e, "event.cancel") && (
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
      )}

      {del && (
        <section className="panel danger">
          <div className="panel-label">Delete event</div>
          {del.paidCount > 0 ? (
            <p className="muted small">This event has paid tickets, so it can&apos;t be deleted. Cancel it instead, so guests can be refunded.</p>
          ) : (
            <DeleteEventForm id={id} title={e.title} guests={del.guestCount} />
          )}
        </section>
      )}
    </div>
  );
}
