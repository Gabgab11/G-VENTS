import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { can, type EventDashboard } from "@/lib/auth";
import { whereText } from "@/lib/event-page";
import { visitorCountry } from "@/lib/platform";
import { THEMES, themeBackground } from "@/lib/themes";
import { Button, Card, CardHeader, Field, Input, Select } from "@/design";
import { removeFlyer, updateEventTheme } from "./actions";
import DetailsForm from "./DetailsForm";
import VenueForm from "./VenueForm";
import { guestCount } from "./details-form";
import styles from "./workspace.module.css";

// Details (HA4, new): the full edit form (basics, when, ticket types → PATCH /v1/events/{id}),
// then the venue, the flyer and the page style, which each save on their own.
export default async function DetailsTab({ event: e }: { event: EventDashboard }) {
  const id = e.id;
  const incoming = await headers();
  const detectedCountry = visitorCountry((name) => incoming.get(name));
  const t = await getTranslations("dashboard");

  return (
    <div className={styles.stack}>
      <DetailsForm
        eventId={id}
        guests={guestCount(e)}
        event={{
          title: e.title, description: e.description, category: e.category, startsAtLocal: e.startsAtLocal, endsAtLocal: e.endsAtLocal,
          timeZone: e.timeZone, status: e.status, counts: e.counts,
          ticketTypes: e.ticketTypes.map((tt) => ({ id: tt.id, name: tt.name, priceMinor: tt.priceMinor, currency: tt.currency, quantity: tt.quantity, sold: tt.sold })),
        }}
      />

      <Card as="section">
        <CardHeader title={t("details.where")} />
        <VenueForm eventId={id} current={e.location.kind === "online" ? t("settings.online") : whereText(e.location)} mapsUrl={e.location.kind === "venue" ? (e.location.mapsUrl ?? null) : null} detectedCountry={detectedCountry} />
      </Card>

      {can(e, "flyer.manage") && (
        <Card as="section">
          <CardHeader title={t("settings.flyerTitle")} />
          <p className={styles.muted}>{t("settings.flyerHint")}</p>
          <div className={styles.flyer} style={{ background: themeBackground(e.coverTheme) }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- flyers come from storage at arbitrary sizes */}
            {e.coverUrl ? <img src={e.coverUrl} alt={t("settings.flyerAlt")} /> : <span className={styles.flyerEmpty}>{t("settings.noFlyer")}</span>}
          </div>
          {/* A plain form post to a route handler, not a Server Action: Cloudflare's WAF blocks some
              images sent to Server Actions (src/lib/same-origin.ts). */}
          <form action={`/api/events/${id}/flyer`} method="post" encType="multipart/form-data" className={styles.rowForm}>
            <Input type="file" name="flyer" accept="image/jpeg,image/png,image/webp" required aria-label={t("settings.flyerTitle")} />
            <Button variant="primary" type="submit">{t("settings.uploadFlyer")}</Button>
          </form>
          {e.coverUrl && (
            <form action={removeFlyer}>
              <input type="hidden" name="event_id" value={id} />
              <Button variant="ghost" size="sm" type="submit">{t("settings.removeFlyer")}</Button>
            </form>
          )}
        </Card>
      )}

      <Card as="section">
        <CardHeader title={t("settings.styleTitle")} />
        <form action={updateEventTheme} className={styles.form}>
          <input type="hidden" name="event_id" value={id} />
          <Field label={t("settings.styleTitle")} hint={t("settings.styleHint")}>
            <Select name="cover_theme" defaultValue={e.coverTheme ?? "minimal"}>
              {Object.entries(THEMES).map(([k, theme]) => <option key={k} value={k}>{t.has(`themes.${k}`) ? t(`themes.${k}`) : theme.label}</option>)}
            </Select>
          </Field>
          <Button variant="secondary" type="submit">{t("settings.saveStyle")}</Button>
        </form>
      </Card>
    </div>
  );
}
