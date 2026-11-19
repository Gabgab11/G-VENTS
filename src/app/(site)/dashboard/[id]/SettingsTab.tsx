import { headers } from "next/headers";
import { api, data } from "@/lib/api/server";
import { can, type EventDashboard } from "@/lib/auth";
import { whereText } from "@/lib/event-page";
import { visitorCountry } from "@/lib/platform";
import { THEMES, themeBackground } from "@/lib/themes";
import { cancelEvent, removeFlyer, updateEventDetails, updateEventTheme } from "./actions";
import DeleteEventForm from "./DeleteEventForm";
import VenueForm from "./VenueForm";
import { getTranslations } from "next-intl/server";
import { Button, Card, Checkbox, Field, Input, Select, Textarea } from "@/design";
import styles from "../dashboard.module.css";

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
        <Card as="section">
          <div className="panel-label">{t("settings.styleTitle")}</div>
          <p className="muted small">{t("settings.styleHint")}</p>
          <form action={updateEventTheme} className={styles.rowForm}>
            <input type="hidden" name="event_id" value={id} />
            <Select name="cover_theme" defaultValue={e.coverTheme ?? "minimal"} aria-label={t("settings.styleTitle")}>
              {Object.entries(THEMES).map(([k, theme]) => <option key={k} value={k}>{t.has(`themes.${k}`) ? t(`themes.${k}`) : theme.label}</option>)}
            </Select>
            <Button variant="primary" type="submit">{t("settings.saveStyle")}</Button>
          </form>
        </Card>
      )}

      {can(e, "flyer.manage") && (
        <Card as="section">
          <div className="panel-label">{t("settings.flyerTitle")}</div>
          <p className="muted small">{t("settings.flyerHint")}</p>
          <div className="flyer-preview" style={{ background: themeBackground(e.coverTheme) }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- flyers come from Supabase Storage at arbitrary sizes */}
            {e.coverUrl ? <img src={e.coverUrl} alt={t("settings.flyerAlt")} /> : <span className="muted small">{t("settings.noFlyer")}</span>}
          </div>
          {/* A plain form post to a route handler, not a Server Action: Cloudflare's WAF blocks some
              images sent to Server Actions (src/lib/same-origin.ts). */}
          <form action={`/api/events/${id}/flyer`} method="post" encType="multipart/form-data" className={styles.rowForm}>
            <Input type="file" name="flyer" accept="image/jpeg,image/png,image/webp" required />
            <Button variant="primary" type="submit">{t("settings.uploadFlyer")}</Button>
          </form>
          {e.coverUrl && (
            <form action={removeFlyer}>
              <input type="hidden" name="event_id" value={id} />
              <button className="link-btn" type="submit">{t("settings.removeFlyer")}</button>
            </form>
          )}
        </Card>
      )}

      {edit && (
        <Card as="section">
          <div className="panel-label">{t("settings.detailsTitle")}</div>
          <form action={updateEventDetails} className="form">
            <input type="hidden" name="event_id" value={id} />
            <Field label={t("settings.name")}>
              <Input name="title" defaultValue={e.title} required minLength={3} maxLength={140} /></Field>
            <Field label={t("settings.about")}>
              <Textarea name="description" rows={5} defaultValue={e.description ?? ""} /></Field>
            <Field label={t("settings.whoCanFind")}>
              <Select name="visibility" defaultValue={e.visibility}>
                <option value="public">{t("settings.public")}</option>
                <option value="private">{t("settings.private")}</option>
              </Select></Field>
            <Field label={t("settings.refundPolicy")}>
              <Textarea name="refund_policy" rows={3} defaultValue={e.refundPolicy ?? ""} /></Field>
            <Checkbox name="notify_registration" defaultChecked={e.notifyRegistration} label={t("settings.notify")} />
            <Button variant="primary" type="submit">{t("settings.saveDetails")}</Button>
          </form>
        </Card>
      )}

      {edit && (
        <Card as="section">
          <div className="panel-label">{t("settings.venue")}</div>
          <VenueForm eventId={id} current={e.location.kind === "online" ? t("settings.online") : whereText(e.location)} mapsUrl={e.location.kind === "venue" ? (e.location.mapsUrl ?? null) : null} detectedCountry={detectedCountry} />
        </Card>
      )}

      {can(e, "event.cancel") && (
        <Card as="section" className={styles.warn}>
          <div className="panel-label">{t("settings.cancelTitle")}</div>
          {e.status === "cancelled" ? (
            <p className="muted small">{t("settings.cancelled")}</p>
          ) : (
            <form action={cancelEvent} className="form">
              <input type="hidden" name="event_id" value={id} />
              <p className="muted small">{t("settings.cancelHint")}</p>
              <Checkbox name="confirm" value="yes" label={t("settings.cancelConfirm")} />
              <Button variant="danger" type="submit">{t("settings.cancelButton")}</Button>
            </form>
          )}
        </Card>
      )}

      {del && (
        <Card as="section" className={styles.warn}>
          <div className="panel-label">{t("settings.deleteTitle")}</div>
          {del.paidCount > 0 ? (
            <p className="muted small">{t("settings.deletePaid")}</p>
          ) : (
            <DeleteEventForm id={id} title={e.title} guests={del.guestCount} />
          )}
        </Card>
      )}
    </div>
  );
}
