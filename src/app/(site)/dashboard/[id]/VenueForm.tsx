"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button, Switch } from "@/design";
import LocationFields from "@/app/(site)/events/new/LocationFields";
import { updateVenue } from "./actions";

// Replaces the venue as a whole (the API keeps nothing from the old one unless sent again).
export default function VenueForm({ eventId, current, mapsUrl, detectedCountry }: { eventId: string; current: string; mapsUrl: string | null; detectedCountry: string | null }) {
  const t = useTranslations("createEvent");
  const [online, setOnline] = useState(current === "Online");
  const titleId = useId();
  return (
    <form action={updateVenue} className="form">
      <input type="hidden" name="event_id" value={eventId} />
      <p className="muted small">{t("venueForm.now", { venue: current || t("venueForm.none") })}</p>
      <div className="option">
        <div>
          <div className="option-title" id={titleId}>{t("online.title")}</div>
          <div className="muted small">{t("online.help")}</div>
        </div>
        <Switch name="is_online" checked={online} onCheckedChange={setOnline} aria-labelledby={titleId} />
      </div>
      {!online && <LocationFields detectedCountry={detectedCountry} placesEnabled defaultMapsUrl={mapsUrl ?? ""} />}
      <Button variant="primary" type="submit">{t("venueForm.save")}</Button>
    </form>
  );
}
