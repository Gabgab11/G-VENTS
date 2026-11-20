"use client";

import { useEffect, useMemo, useState } from "react";
import Combobox from "@/components/Combobox";
import { useTranslations } from "next-intl";
import { mainZones, zoneOptions } from "@/lib/time-zones";
import { useFormat } from "@/i18n/format-hooks";
import { Button, Select } from "@/design";
import styles from "./TimeZoneField.module.css";

// The event's time zone, shown rather than asked for. Most hosts never touch it: it comes from the
// venue (its coordinates), from the country when the country has one zone, or from the host's
// device for online events. "Change" opens a searchable list, the country's zones first.
// Posts `time_zone`: the chosen zone, the device zone for online events, or "" to let the API
// take it from the venue (CE3).

export type ZoneContext = {
  /** The country's name as shown, in the page's language. */
  countryName: string;
  /** The country's zones; one for most countries. */
  countryZones: string[];
  /** The zone at the chosen or located venue, when known. */
  venueZone: string | null;
};

export default function TimeZoneField({ online, context }: { online: boolean; context: ZoneContext }) {
  const t = useTranslations("createEvent.timeZone");
  const format = useFormat();
  const [chosen, setChosen] = useState("");
  const [picking, setPicking] = useState(false);
  const [deviceZone, setDeviceZone] = useState("");
  // Readable names come from the browser's Intl data, so they're drawn after hydration.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setDeviceZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos");
    setReady(true);
  }, []);

  // A zone chosen for one country doesn't carry over to another.
  const countryKey = context.countryZones.join(",");
  useEffect(() => { if (!online) { setChosen(""); setPicking(false); } }, [countryKey, online]);

  const single = context.countryZones.length === 1 ? context.countryZones[0]! : null;
  const auto = online ? deviceZone : context.venueZone ?? single;
  const zone = chosen || auto || "";
  const source = chosen ? t("sourceChosen")
    : online ? t("sourceDevice")
    : context.venueZone ? t("sourceVenue")
    : single ? t("sourceCountry", { country: context.countryName })
    : "";
  const posted = chosen || (online ? deviceZone : "");

  const options = useMemo(
    () => (picking ? zoneOptions(context.countryZones).map((z) => ({ value: z, label: format.zone(z) })) : []),
    [picking, context.countryZones, format],
  );
  const name = (z: string) => (ready ? format.zone(z) : z.replace(/_/g, " "));
  // One per clock (the US's 29 zones become 7); every zone stays searchable under "Change".
  const clocks = useMemo(() => (ready ? mainZones(context.countryZones) : context.countryZones), [ready, context.countryZones]);

  // A country with several zones and no venue on the map yet: the host picks among its zones.
  const needsChoice = !online && !zone && context.countryZones.length > 1;

  return (
    <div className={styles.field}>
      <span className={styles.label}>{t("label")}</span>
      {needsChoice && !picking ? (
        <>
          <Select value="" onChange={(e) => setChosen(e.target.value)} aria-label={t("inCountry", { country: context.countryName })}>
            <option value="" disabled>{t("choose")}</option>
            {clocks.map((z) => <option key={z} value={z}>{name(z)}</option>)}
          </Select>
          <span className={styles.hint}>{t("several", { country: context.countryName })}</span>
        </>
      ) : picking ? (
        <>
          <Combobox
            name=""
            label={t("searchLabel")}
            options={options}
            value={chosen || auto || ""}
            onChange={(z) => { setChosen(z); setPicking(false); }}
            placeholder={t("searchPlaceholder")}
            emptyText={t("noMatch")}
          />
          <Button variant="ghost" size="sm" className={styles.cancel} onClick={() => setPicking(false)}>{t("cancel")}</Button>
        </>
      ) : (
        <div className={styles.current}>
          <span className={styles.name} aria-live="polite">{zone ? name(zone) : "…"}</span>
          <Button variant="ghost" size="sm" onClick={() => setPicking(true)}>{t("change")}</Button>
          {chosen && auto && chosen !== auto && (
            <Button variant="ghost" size="sm" onClick={() => setChosen("")}>
              {online ? t("useDevice") : context.venueZone ? t("useVenue") : t("useCountry")}
            </Button>
          )}
        </div>
      )}
      {!needsChoice && !picking && source && <span className={styles.hint}>{t("sourceLine", { source })}</span>}
      <input type="hidden" name="time_zone" value={posted} />
    </div>
  );
}
