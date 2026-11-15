import { can, type EventDashboard } from "@/lib/auth";
import CopyLink from "./CopyLink";
import { setRegistrationOpen, setCapacity } from "./actions";
import type { components } from "@/lib/api/schema";
import { SalesPanel } from "./SalesPanel";
import { getTranslations } from "next-intl/server";

export default async function OverviewTab({ event, url, sales }: { event: EventDashboard; url: string; sales: components["schemas"]["EventSalesDto"] | null }) {
  const id = event.id;
  const { counts } = event;
  const edit = can(event, "event.edit");
  const t = await getTranslations("dashboard.overview");
  return (
    <div className="stack">
      <div className="stats">
        <div className="stat"><b>{counts.confirmed}</b><span>{t("confirmed")}</span></div>
        <div className="stat"><b>{counts.pending}</b><span>{t("pending")}</span></div>
        <div className="stat"><b>{counts.waitlisted}</b><span>{t("waitlisted")}</span></div>
        <div className="stat"><b>{counts.checkedIn}</b><span>{t("checkedIn")}</span></div>
        <div className="stat"><b>{event.capacity ?? "∞"}</b><span>{t("capacity")}</span></div>
      </div>

      {sales && <SalesPanel sales={sales} feeChoice={event.feeChoice} />}

      <section className="panel">
        <div className="panel-label">{t("shareTitle")}</div>
        <p className="muted small">{t("shareHint")}</p>
        <CopyLink url={url} />
      </section>

      {edit && (
        <section className="panel">
          <div className="spread">
            <div>
              <div className="option-title">{t("registration")}</div>
              <div className="muted small">{t(event.registrationOpen ? "registrationOpen" : "registrationClosed")}</div>
            </div>
            <form action={setRegistrationOpen}>
              <input type="hidden" name="event_id" value={id} />
              <input type="hidden" name="open" value={event.registrationOpen ? "false" : "true"} />
              <button className={event.registrationOpen ? "btn-ghost" : "btn-grad"} type="submit">
                {t(event.registrationOpen ? "closeRegistration" : "openRegistration")}
              </button>
            </form>
          </div>
        </section>
      )}

      {edit && (
        <section className="panel">
          <label className="option-title" htmlFor="capacity">{t("capacity")}</label>
          <p className="muted small" id="capacity-hint">{t("capacityHint")}</p>
          <form action={setCapacity} className="row-form">
            <input type="hidden" name="event_id" value={id} />
            <input id="capacity" aria-describedby="capacity-hint" className="input" name="capacity" inputMode="numeric"
              defaultValue={event.capacity ?? ""} placeholder={t("capacityPlaceholder")} />
            <button className="btn-white" type="submit">{t("saveCapacity")}</button>
          </form>
        </section>
      )}
    </div>
  );
}
