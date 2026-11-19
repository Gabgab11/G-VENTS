import { can, type EventDashboard } from "@/lib/auth";
import CopyLink from "./CopyLink";
import { setRegistrationOpen, setCapacity } from "./actions";
import type { components } from "@/lib/api/schema";
import { SalesPanel } from "./SalesPanel";
import { getTranslations } from "next-intl/server";
import { Button, Card, Input, Stat } from "@/design";
import styles from "../dashboard.module.css";

export default async function OverviewTab({ event, url, sales }: { event: EventDashboard; url: string; sales: components["schemas"]["EventSalesDto"] | null }) {
  const id = event.id;
  const { counts } = event;
  const edit = can(event, "event.edit");
  const t = await getTranslations("dashboard.overview");
  return (
    <div className="stack">
      <div className="stats">
        <Stat label={t("confirmed")} value={counts.confirmed} />
        <Stat label={t("pending")} value={counts.pending} />
        <Stat label={t("waitlisted")} value={counts.waitlisted} />
        <Stat label={t("checkedIn")} value={counts.checkedIn} />
        <Stat label={t("capacity")} value={event.capacity ?? "∞"} />
      </div>

      {sales && <SalesPanel sales={sales} feeChoice={event.feeChoice} />}

      <Card as="section">
        <div className="panel-label">{t("shareTitle")}</div>
        <p className="muted small">{t("shareHint")}</p>
        <CopyLink url={url} />
      </Card>

      {edit && (
        <Card as="section">
          <div className="spread">
            <div>
              <div className="option-title">{t("registration")}</div>
              <div className="muted small">{t(event.registrationOpen ? "registrationOpen" : "registrationClosed")}</div>
            </div>
            <form action={setRegistrationOpen}>
              <input type="hidden" name="event_id" value={id} />
              <input type="hidden" name="open" value={event.registrationOpen ? "false" : "true"} />
              <Button variant={event.registrationOpen ? "secondary" : "accent"} type="submit">
                {t(event.registrationOpen ? "closeRegistration" : "openRegistration")}
              </Button>
            </form>
          </div>
        </Card>
      )}

      {edit && (
        <Card as="section">
          <label className="option-title" htmlFor="capacity">{t("capacity")}</label>
          <p className="muted small" id="capacity-hint">{t("capacityHint")}</p>
          <form action={setCapacity} className={styles.rowForm}>
            <input type="hidden" name="event_id" value={id} />
            <Input id="capacity" aria-describedby="capacity-hint" name="capacity" inputMode="numeric"
              defaultValue={event.capacity ?? ""} placeholder={t("capacityPlaceholder")} />
            <Button variant="primary" type="submit">{t("saveCapacity")}</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
