import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { can, type EventDashboard } from "@/lib/auth";
import { whereText } from "@/lib/event-page";
import { visitorCountry } from "@/lib/platform";
import { THEMES } from "@/lib/themes";
import { Button, Card, CardHeader, Field, Select } from "@/design";
import { updateEventTheme } from "./actions";
import PictureSection from "./PictureSection";
import DetailsForm from "./DetailsForm";
import VenueForm from "./VenueForm";
import { guestCount } from "./details-form";
import styles from "./workspace.module.css";

// Details (HA4, new): the full edit form (basics, when, ticket types → PATCH /v1/events/{id}),
// then the venue, the pictures and the page style, which each save on their own.
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
          ticketTypes: e.ticketTypes.map((tt) => ({ id: tt.id, name: tt.name, priceMinor: tt.priceMinor, currency: tt.currency, quantity: tt.quantity, sold: tt.sold, groupSize: tt.groupSize, description: tt.description })),
        }}
      />

      <Card as="section">
        <CardHeader title={t("details.where")} />
        <VenueForm eventId={id} current={e.location.kind === "online" ? t("settings.online") : whereText(e.location)} mapsUrl={e.location.kind === "venue" ? (e.location.mapsUrl ?? null) : null} detectedCountry={detectedCountry} />
      </Card>

      {/* Pictures (chunk 3c): up to five, the first is the main one; each change saves at once. */}
      {can(e, "event.edit") && (
        <Card as="section">
          <CardHeader title={t("settings.picturesTitle")} />
          <PictureSection eventId={id} images={e.images} />
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
