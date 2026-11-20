"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/design";
import { Switch } from "@/design/client";
import LocationFields from "@/app/(site)/host/events/new/LocationFields";
import styles from "./workspace.module.css";
import { updateVenue } from "./actions";

// Replaces the venue as a whole (the API keeps nothing from the old one unless sent again).
export default function VenueForm({ eventId, current, mapsUrl, detectedCountry }: { eventId: string; current: string; mapsUrl: string | null; detectedCountry: string | null }) {
  const t = useTranslations("createEvent");
  const [online, setOnline] = useState(current === "Online");
  const titleId = useId();
  return (
    <form action={updateVenue} className={styles.form}>
      <input type="hidden" name="event_id" value={eventId} />
      <p className={styles.muted}>{t("venueForm.now", { venue: current || t("venueForm.none") })}</p>
      <div className={styles.option}>
        <span className={styles.optionText}>
          <strong id={titleId}>{t("online.title")}</strong>
          <span className={styles.muted}>{t("online.help")}</span>
        </span>
        <Switch name="is_online" checked={online} onCheckedChange={setOnline} aria-labelledby={titleId} />
      </div>
      {!online && <LocationFields detectedCountry={detectedCountry} placesEnabled defaultMapsUrl={mapsUrl ?? ""} />}
      <Button variant="primary" type="submit">{t("venueForm.save")}</Button>
    </form>
  );
}
