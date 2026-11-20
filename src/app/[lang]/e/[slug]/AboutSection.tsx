import { getTranslations } from "next-intl/server";
import VenueMap from "@/components/VenueMap";
import { cx } from "@/design";
import type { EventPage } from "@/lib/event-page";
import { eventPlace } from "./event-view";
import s from "./EventPage.module.css";

// "About & directions": the full description and refund policy beside the venue map. Shown on the
// event page and again on the booking page, so guests can check the details while they book.
export default async function AboutSection({ event }: { event: EventPage }) {
  const t = await getTranslations("event");
  const place = eventPlace(event.location, t);
  if (!(event.description || event.refundPolicy || (place.venue && place.directions))) return null;
  return (
    <section className={s.about} id="about" aria-labelledby="about-title">
      <h2 className={s.aboutTitle} id="about-title">{t("summary.aboutDirections")}</h2>
      <div className={s.aboutGrid}>
        {(event.description || event.refundPolicy) && (
          <div className={s.aboutText}>
            {event.description && <p className={s.desc}>{event.description}</p>}
            {event.refundPolicy && (
              <div className={s.refunds} id="refunds">
                <h3 className={s.label}>{t("page.refunds")}</h3>
                <p className={cx(s.desc, s.muted)}>{event.refundPolicy}</p>
              </div>
            )}
          </div>
        )}
        {place.venue && place.directions && (
          <VenueMap
            location={event.location}
            title={place.title}
            subtitle={place.line || undefined}
            labels={{ open: t("map.open"), show: t("map.show"), mapTitle: t("map.title", { place: place.title }), imageAlt: t("map.imageAlt", { place: place.title }) }}
          />
        )}
      </div>
    </section>
  );
}
