"use client";

import { useEffect, useMemo, useState } from "react";
import Combobox from "@/components/Combobox";
import { mainZones, zoneLabel, zoneOptions } from "@/lib/time-zones";

// The event's time zone, shown rather than asked for. Most hosts never touch it: it comes from the
// venue (its coordinates), from the country when the country has one zone, or from the host's
// device for online events. "Change" opens a searchable list, the country's zones first.
// Posts `time_zone`: the chosen zone, the device zone for online events, or "" to let the API
// take it from the venue (CE3).

export type ZoneContext = {
  countryName: string;
  /** The country's zones; one for most countries. */
  countryZones: string[];
  /** The zone at the chosen or located venue, when known. */
  venueZone: string | null;
};

export default function TimeZoneField({ online, context }: { online: boolean; context: ZoneContext }) {
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
  const source = chosen ? "You chose this time zone."
    : online ? "Your device's time zone. Guests see times in this zone."
    : context.venueZone ? "From the venue's location."
    : single ? `${context.countryName} uses one time zone.`
    : "";
  const posted = chosen || (online ? deviceZone : "");

  const options = useMemo(
    () => (picking ? zoneOptions(context.countryZones).map((z) => ({ value: z, label: zoneLabel(z) })) : []),
    [picking, context.countryZones],
  );
  const name = (z: string) => (ready ? zoneLabel(z) : z.replace(/_/g, " "));
  // One per clock (the US's 29 zones become 7); every zone stays searchable under "Change".
  const clocks = useMemo(() => (ready ? mainZones(context.countryZones) : context.countryZones), [ready, context.countryZones]);

  // A country with several zones and no venue on the map yet: the host picks among its zones.
  const needsChoice = !online && !zone && context.countryZones.length > 1;

  return (
    <div className="field tz-field">
      <span>Time zone</span>
      {needsChoice && !picking ? (
        <>
          <select className="input" value="" onChange={(e) => setChosen(e.target.value)} aria-label={`Time zone in ${context.countryName}`}>
            <option value="" disabled>Choose the time zone</option>
            {clocks.map((z) => <option key={z} value={z}>{name(z)}</option>)}
          </select>
          <span className="muted small">{context.countryName} has several time zones. Pick the venue from the search and it&apos;s set for you, or choose one here.</span>
        </>
      ) : picking ? (
        <>
          <Combobox
            name=""
            label="Search a city or time zone"
            options={options}
            value={chosen || auto || ""}
            onChange={(z) => { setChosen(z); setPicking(false); }}
            placeholder="Type a city, e.g. Lagos or London"
            emptyText="No time zone matches"
          />
          <button type="button" className="link-btn" onClick={() => setPicking(false)}>Cancel</button>
        </>
      ) : (
        <div className="tz-current">
          <span className="tz-name" aria-live="polite">{zone ? name(zone) : "…"}</span>
          <button type="button" className="link-btn" onClick={() => setPicking(true)}>Change</button>
          {chosen && auto && chosen !== auto && (
            <button type="button" className="link-btn" onClick={() => setChosen("")}>
              Use {online ? "my device's" : context.venueZone ? "the venue's" : "the country's"} time zone
            </button>
          )}
        </div>
      )}
      {!needsChoice && !picking && source && <span className="muted small">{source} Start and end times are in this zone.</span>}
      <input type="hidden" name="time_zone" value={posted} />
    </div>
  );
}
