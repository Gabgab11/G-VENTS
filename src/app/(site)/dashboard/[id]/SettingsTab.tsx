import { headers } from "next/headers";
import { api, data } from "@/lib/api/server";
import { can, type EventDashboard } from "@/lib/auth";
import { whereText } from "@/lib/event-page";
import { visitorCountry } from "@/lib/platform";
import { THEMES, themeBackground } from "@/lib/themes";
import { cancelEvent, removeFlyer, updateEventDetails, updateEventTheme, uploadFlyer } from "./actions";
import DeleteEventForm from "./DeleteEventForm";
import VenueForm from "./VenueForm";
import { getTranslations } from "next-intl/server";

// Event settings from the dashboard response (gventz-api); every change goes through the API.
export default async function SettingsTab({ event: e }: { event: EventDashboard }) {
  const id = e.id;
  const edit = can(e, "event.edit");
  // Only the owner can delete; the check also tells whether paid tickets block it.
  const del = can(e, "event.delete") ? await (await api()).GET("/v1/events/{id}/deletion-check", { params: { path: { id } } }).then(data).catch(() => null) : null;
  const incoming = await headers();
  const detectedCountry = visitorCountry((name) => incoming.get(name));
  const t = await getTranslations("dashboard");

  return (
    <div className="stack">
      {edit && (
        <section className="panel">
          <div className="panel-label">{t("settings.styleTitle")}</div>
          <p className="muted small">{t("settings.styleHint")}</p>
          <form action={updateEventTheme} className="row-form">
            <input type="hidden" name="event_id" value={id} />
            <select className="input" name="cover_theme" defaultValue={e.coverTheme ?? "minimal"}>
              {Object.entries(THEMES).map(([k, theme]) => <option key={k} value={k}>{t.has(`themes.${k}`) ? t(`themes.${k}`) : theme.label}</option>)}
            </select>
            <button className="btn-white" type="submit">{t("settings.saveStyle")}</button>
          </form>
        </section>
      )}

      {can(e, "flyer.manage") && (
        <section className="panel">
          <div className="panel-label">{t("settings.flyerTitle")}</div>
          <p className="muted small">{t("settings.flyerHint")}</p>
          <div className="flyer-preview" style={{ background: themeBackground(e.coverTheme) }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- flyers come from Supabase Storage at arbitrary sizes */}
            {e.coverUrl ? <img src={e.coverUrl} alt={t("settings.flyerAlt")} /> : <span className="muted small">{t("settings.noFlyer")}</span>}
          </div>
          <form action={uploadFlyer} className="row-form">
            <input type="hidden" name="event_id" value={id} />
            <input className="input" type="file" name="flyer" accept="image/jpeg,image/png,image/webp" required />
            <button className="btn-white" type="submit">{t("settings.uploadFlyer")}</button>
          </form>
          {e.coverUrl && (
            <form action={removeFlyer}>
              <input type="hidden" name="event_id" value={id} />
              <button className="link-btn" type="submit">{t("settings.removeFlyer")}</button>
            </form>
          )}
        </section>
      )}

      {edit && (
        <section className="panel">
          <div className="panel-label">{t("settings.detailsTitle")}</div>
          <form action={updateEventDetails} className="form">
            <input type="hidden" name="event_id" value={id} />
            <label className="field"><span>{t("settings.name")}</span>
              <input className="input" name="title" defaultValue={e.title} required minLength={3} maxLength={140} /></label>
            <label className="field"><span>{t("settings.about")}</span>
              <textarea className="input" name="description" rows={5} defaultValue={e.description ?? ""} /></label>
            <label className="field"><span>{t("settings.whoCanFind")}</span>
              <select className="input" name="visibility" defaultValue={e.visibility}>
                <option value="public">{t("settings.public")}</option>
                <option value="private">{t("settings.private")}</option>
              </select></label>
            <label className="field"><span>{t("settings.refundPolicy")}</span>
              <textarea className="input" name="refund_policy" rows={3} defaultValue={e.refundPolicy ?? ""} /></label>
            <label className="check">
              <input type="checkbox" name="notify_registration" defaultChecked={e.notifyRegistration} />
              <span>{t("settings.notify")}</span>
            </label>
            <button className="btn-white" type="submit">{t("settings.saveDetails")}</button>
          </form>
        </section>
      )}

      {edit && (
        <section className="panel">
          <div className="panel-label">{t("settings.venue")}</div>
          <VenueForm eventId={id} current={e.location.kind === "online" ? t("settings.online") : whereText(e.location)} mapsUrl={e.location.kind === "venue" ? (e.location.mapsUrl ?? null) : null} detectedCountry={detectedCountry} />
        </section>
      )}

      {can(e, "event.cancel") && (
        <section className="panel danger">
          <div className="panel-label">{t("settings.cancelTitle")}</div>
          {e.status === "cancelled" ? (
            <p className="muted small">{t("settings.cancelled")}</p>
          ) : (
            <form action={cancelEvent} className="form">
              <input type="hidden" name="event_id" value={id} />
              <p className="muted small">{t("settings.cancelHint")}</p>
              <label className="check"><input type="checkbox" name="confirm" value="yes" /> <span>{t("settings.cancelConfirm")}</span></label>
              <button className="btn-danger" type="submit">{t("settings.cancelButton")}</button>
            </form>
          )}
        </section>
      )}

      {del && (
        <section className="panel danger">
          <div className="panel-label">{t("settings.deleteTitle")}</div>
          {del.paidCount > 0 ? (
            <p className="muted small">{t("settings.deletePaid")}</p>
          ) : (
            <DeleteEventForm id={id} title={e.title} guests={del.guestCount} />
          )}
        </section>
      )}
    </div>
  );
}
