import { api, data } from "@/lib/api/server";
import { can, type EventDashboard } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { Banner, Button, Card, CardHeader, Checkbox, Field, Input, Textarea } from "@/design";
import { cancelEvent, setCapacity, setRegistrationOpen, updateEventPolicies } from "./actions";
import DeleteEventForm from "./DeleteEventForm";
import QuickSettings from "./QuickSettings";
import styles from "./workspace.module.css";

// Event settings: publishing and visibility, registration and capacity, guest policies, and the
// danger zone (cancel, delete). Details, venue, flyer and page style are on the Details tab; the
// dashboard style moved to Settings → Appearance (D85). Every change goes through the API.
export default async function SettingsTab({ event: e }: { event: EventDashboard }) {
  const id = e.id;
  const edit = can(e, "event.edit");
  const publish = can(e, "event.publish");
  // Only the owner can delete; the check also tells whether paid tickets block it.
  const del = can(e, "event.delete") ? await (await api()).GET("/v1/events/{id}/deletion-check", { params: { path: { id } } }).then(data).catch(() => null) : null;
  const [t, o] = await Promise.all([getTranslations("dashboard"), getTranslations("dashboard.overview")]);

  return (
    <div className={styles.stack}>
      {(edit || (publish && e.status === "draft")) && (
        <Card as="section">
          <CardHeader title={t("quick.title")} />
          <QuickSettings eventId={id} status={e.status} visibility={e.visibility} showAttendeeCount={e.showAttendeeCount} canPublish={publish} canEdit={edit} />
        </Card>
      )}

      {edit && (
        <Card as="section">
          <CardHeader title={o("registration")} />
          <div className={styles.option}>
            <span className={styles.optionText}>
              <strong>{o(e.registrationOpen ? "registrationOpen" : "registrationClosed")}</strong>
            </span>
            <form action={setRegistrationOpen}>
              <input type="hidden" name="event_id" value={id} />
              <input type="hidden" name="open" value={e.registrationOpen ? "false" : "true"} />
              <Button size="sm" variant={e.registrationOpen ? "secondary" : "accent"} type="submit">
                {o(e.registrationOpen ? "closeRegistration" : "openRegistration")}
              </Button>
            </form>
          </div>
          <form action={setCapacity} className={styles.form}>
            <input type="hidden" name="event_id" value={id} />
            <Field label={o("capacity")} hint={o("capacityHint")}>
              <Input name="capacity" inputMode="numeric" defaultValue={e.capacity ?? ""} placeholder={o("capacityPlaceholder")} />
            </Field>
            <Button variant="secondary" type="submit">{o("saveCapacity")}</Button>
          </form>
        </Card>
      )}

      {edit && (
        <Card as="section">
          <CardHeader title={t("settings.policiesTitle")} />
          <form action={updateEventPolicies} className={styles.form}>
            <input type="hidden" name="event_id" value={id} />
            <Field label={t("settings.refundPolicy")}>
              <Textarea name="refund_policy" rows={3} defaultValue={e.refundPolicy ?? ""} /></Field>
            <Checkbox name="notify_registration" defaultChecked={e.notifyRegistration} label={t("settings.notify")} />
            <Button variant="primary" type="submit">{t("settings.savePolicies")}</Button>
          </form>
        </Card>
      )}

      {can(e, "event.cancel") && (
        <Card as="section" id="cancel" className={styles.warn}>
          <CardHeader title={t("settings.cancelTitle")} />
          {e.status === "cancelled" ? (
            <p className={styles.muted}>{t("settings.cancelled")}</p>
          ) : (
            <form action={cancelEvent} className={styles.form}>
              <input type="hidden" name="event_id" value={id} />
              <p className={styles.muted}>{t("settings.cancelHint")}</p>
              <Checkbox name="confirm" value="yes" label={t("settings.cancelConfirm")} />
              <Button variant="danger" type="submit">{t("settings.cancelButton")}</Button>
            </form>
          )}
        </Card>
      )}

      {del && (
        <Card as="section" id="delete" className={styles.warn}>
          <CardHeader title={t("settings.deleteTitle")} />
          {del.paidCount > 0 ? (
            <Banner tone="warning" title={t("settings.deletePaid")} />
          ) : (
            <DeleteEventForm id={id} title={e.title} guests={del.guestCount} />
          )}
        </Card>
      )}
    </div>
  );
}
