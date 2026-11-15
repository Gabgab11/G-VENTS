"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormat } from "@/i18n/format-hooks";
import Combobox from "@/components/Combobox";
import { orderedCountries } from "@/lib/locations";
import { countryDetails, locatePlace, placeDetails, searchPlaces, type PlaceDetails, type Suggestion } from "@/app/(site)/events/places-actions";
import type { CountryReference } from "@/lib/reference";
import { MAPS_URL_HINT_KEY, MAPS_URL_MAX, isGoogleMapsUrl } from "@/lib/maps-url";
import type { ZoneContext } from "./TimeZoneField";

type Place = { placeId: string; address: string; city: string; lat: number | null; lng: number | null; timeZone: string | null };

const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;

function newSession(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

/** The message id (createEvent.venue.*) for a venue search problem. */
function problemKey(code: string): "signedOut" | "rateLimited" | "unavailable" {
  if (code === "signed_out") return "signedOut";
  if (code === "rate_limited") return "rateLimited";
  return "unavailable";
}

const toPlace = (p: PlaceDetails): Place => ({ placeId: p.placeId, address: p.address, city: p.city, lat: p.lat, lng: p.lng, timeZone: p.timeZone });

/** The Google map for a point (the official embed when a browser key is set, otherwise the plain one). */
function mapSrc(place: Place): string | null {
  if (place.lat === null || place.lng === null) return null;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY ?? "";
  if (key) return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(`place_id:${place.placeId}`)}&zoom=15`;
  return `https://www.google.com/maps?q=${encodeURIComponent(`${place.lat},${place.lng}`)}&z=15&output=embed`;
}

// Country → State/Region → Venue, in that order. The states come from the API, so only names it
// accepts are offered. The venue search stays inside the chosen state; a venue picked (or a typed
// address found on the map) sets the state to the one it is really in. Changing the country clears
// the state and venue; changing the state clears the venue.
export default function LocationFields({
  detectedCountry,
  placesEnabled,
  defaultMapsUrl = "",
  onZoneContext,
}: {
  detectedCountry: string | null;
  placesEnabled: boolean;
  defaultMapsUrl?: string;
  /** Tells the time zone field the country's zones and the venue's zone. */
  onZoneContext?: (context: ZoneContext) => void;
}) {
  const t = useTranslations("createEvent.location");
  const root = useTranslations();
  const format = useFormat();
  const mapsHint = root(MAPS_URL_HINT_KEY);
  const countries = useMemo(() => orderedCountries(detectedCountry), [detectedCountry]);
  // Country names in the page's language (English keeps the list's own spelling); the codes, and
  // the English name posted as `country`, don't change.
  const countryName = (c: { code: string; name: string }) => (format.lang === "en" ? c.name : format.country(c.code));
  const [countryCode, setCountryCode] = useState(countries[0].code);
  const [reference, setReference] = useState<CountryReference | null | "loading">("loading");
  const [region, setRegion] = useState("");
  const [venue, setVenue] = useState("");
  const [place, setPlace] = useState<Place | null>(null);
  const [note, setNote] = useState("");
  const [mapsUrl, setMapsUrl] = useState(defaultMapsUrl);
  const [mapsError, setMapsError] = useState("");
  const cache = useRef(new Map<string, CountryReference | null>());

  const country = countries.find((c) => c.code === countryCode);
  const ref = reference === "loading" ? null : reference;
  const shownCountry = country ? countryName(country) : countryCode;

  // The country's states and zones, from the API (cached for a day on the server, per visit here).
  useEffect(() => {
    let live = true;
    const known = cache.current.get(countryCode);
    if (known !== undefined) { setReference(known); return; }
    setReference("loading");
    countryDetails(countryCode)
      .then((r) => { cache.current.set(countryCode, r); if (live) setReference(r); })
      .catch(() => { if (live) setReference(null); });
    return () => { live = false; };
  }, [countryCode]);

  useEffect(() => {
    onZoneContext?.({ countryName: shownCountry, countryZones: ref?.zones ?? [], venueZone: place?.timeZone ?? null });
  }, [onZoneContext, shownCountry, ref?.zones, place?.timeZone]);

  function clearVenue() {
    setVenue("");
    setPlace(null);
    setNote("");
  }

  function changeCountry(code: string) {
    if (code === countryCode) return;
    setCountryCode(code);
    setRegion("");
    clearVenue();
  }

  function changeRegion(value: string) {
    if (value === region) return;
    setRegion(value);
    clearVenue();
  }

  // A picked or located venue decides the state: it is where the venue really is.
  function placed(name: string, details: PlaceDetails | null, fallback?: Place) {
    if (name) setVenue(name);
    if (!details) { if (fallback) setPlace(fallback); return; }
    setPlace(toPlace(details));
    const label = (ref?.label ?? "state").toLowerCase();
    if (details.region && ref?.regions?.includes(details.region) && details.region !== region) {
      setNote(region ? t("regionChanged", { region: details.region, label }) : t("regionSet", { region: details.region, label: `${label[0]!.toUpperCase()}${label.slice(1)}` }));
      setRegion(details.region);
    } else {
      setNote("");
    }
  }

  const src = place ? mapSrc(place) : null;

  return (
    <>
      <div className="row2">
        <Combobox
          name="country_code"
          label={t("country")}
          options={countries.map((c) => ({ value: c.code, label: countryName(c) }))}
          value={countryCode}
          onChange={changeCountry}
          placeholder={t("searchCountries")}
        />
        {reference === "loading" ? (
          <label className="field"><span>{t("stateOrRegion")}</span>
            <input className="input" disabled placeholder={t("loading")} /></label>
        ) : ref?.regions ? (
          <Combobox
            key={countryCode}
            name="region"
            label={ref.label}
            options={ref.regions.map((r) => ({ value: r, label: r }))}
            value={region}
            onChange={changeRegion}
            placeholder={t("chooseRegion", { label: ref.label.toLowerCase() })}
          />
        ) : (
          <label className="field"><span>{t("stateCityRegion")}</span>
            <input className="input" name="region" maxLength={120} value={region}
              onChange={(e) => { setRegion(e.target.value); setPlace(null); setNote(""); }} /></label>
        )}
      </div>

      <VenueSearch
        key={countryCode}
        countryCode={countryCode}
        region={region}
        regionListed={!!ref?.regions}
        enabled={placesEnabled}
        venue={venue}
        place={place}
        onType={(text) => { setVenue(text); setPlace(null); setNote(""); }}
        onPlaced={placed}
        onForget={() => { setPlace(null); setNote(""); }}
      />
      {note && <p className="muted small venue-note" role="status">{note}</p>}
      {src && <iframe className="ev-map venue-map" src={src} title={t("mapOf", { venue: venue || t("theVenue") })} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />}

      <label className="field"><span>{t("mapsLink")}</span>
        <input className="input" type="url" name="maps_url" inputMode="url" maxLength={MAPS_URL_MAX} value={mapsUrl}
          onChange={(e) => { setMapsUrl(e.target.value); if (mapsError) setMapsError(""); }}
          onBlur={() => setMapsError(mapsUrl.trim() && !isGoogleMapsUrl(mapsUrl) ? mapsHint : "")}
          aria-invalid={mapsError ? true : undefined}
          placeholder="https://maps.app.goo.gl/…" title={mapsHint} />
        {mapsError
          ? <span className="error small" role="alert">{t("mapsError", { hint: mapsError })}</span>
          : <span className="muted small">{src
            ? t("mapsHelpWithMap")
            : t("mapsHelp")}</span>}
      </label>

      <input type="hidden" name="country" value={country?.name ?? ""} />
      <input type="hidden" name="place_id" value={place?.placeId ?? ""} />
      <input type="hidden" name="address" value={place?.address ?? ""} />
      <input type="hidden" name="city" value={place?.city ?? ""} />
      <input type="hidden" name="lat" value={place?.lat ?? ""} />
      <input type="hidden" name="lng" value={place?.lng ?? ""} />
    </>
  );
}

function VenueSearch({
  countryCode,
  region,
  regionListed,
  enabled,
  venue,
  place,
  onType,
  onPlaced,
  onForget,
}: {
  countryCode: string;
  region: string;
  /** The region came from the list (typed regions only nudge the search). */
  regionListed: boolean;
  enabled: boolean;
  venue: string;
  place: Place | null;
  onType: (text: string) => void;
  onPlaced: (name: string, details: PlaceDetails | null, fallback?: Place) => void;
  onForget: () => void;
}) {
  const t = useTranslations("createEvent.venue");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [resultsFor, setResultsFor] = useState(""); // the search text the current suggestions answer
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState<"" | "search" | "details" | "locate">("");
  const [located, setLocated] = useState(false); // the place came from a typed address, not a pick
  const triedLocate = useRef(""); // the text last placed on the map (or dismissed), so it isn't looked up twice
  const [problem, setProblem] = useState("");
  const [available, setAvailable] = useState(enabled);
  const session = useRef(newSession());
  const lastQuery = useRef("");

  // Debounced search while the host types. Stale requests are cancelled.
  useEffect(() => {
    const q = venue.trim();
    if (!available || place || q.length < MIN_CHARS || q === lastQuery.current) {
      if (q.length < MIN_CHARS) { setSuggestions([]); setResultsFor(""); setLoading(""); }
      return;
    }
    const timer = setTimeout(async () => {
      lastQuery.current = q;
      setLoading("search");
      try {
        const data = await searchPlaces(q, countryCode, regionListed ? region : "", session.current);
        // A newer search started while this one ran: drop these results.
        if (lastQuery.current !== q) return;
        if (data.error) {
          if (data.error === "not_configured") setAvailable(false);
          else setProblem(t(problemKey(data.error)));
          setSuggestions([]);
        } else {
          setProblem("");
          setSuggestions(data.suggestions ?? []);
          setResultsFor(q);
          setActive(-1);
          setOpen(true);
        }
      } catch {
        if (lastQuery.current === q) setProblem(t(problemKey("")));
      } finally {
        if (lastQuery.current === q) setLoading("");
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [venue, place, available, countryCode, region, regionListed, t]);

  async function pick(s: Suggestion) {
    setOpen(false);
    setSuggestions([]);
    setResultsFor("");
    setLoading("details");
    setLocated(false);
    triedLocate.current = s.main;
    onPlaced(s.main, null, { placeId: s.placeId, address: s.secondary ? `${s.main}, ${s.secondary}` : s.main, city: "", lat: null, lng: null, timeZone: null });
    try {
      const data = await placeDetails(s.placeId, session.current);
      if (data.place) {
        onPlaced(data.place.name || s.main, data.place);
        setProblem("");
      } else {
        setProblem(t("noDetails"));
      }
    } catch {
      setProblem(t("noDetails"));
    } finally {
      setLoading("");
      session.current = newSession(); // one billing session per search-and-pick
      lastQuery.current = "";
    }
  }

  function keepTyped() {
    setOpen(false);
    setSuggestions([]);
    setResultsFor("");
    void locate();
  }

  // A typed venue or address, placed on the map once the host stops: the best match in the
  // country and state. The host's own text stays the venue name; "Not this place" undoes it.
  async function locate() {
    const q = venue.trim();
    if (!available || place || q.length < MIN_CHARS || triedLocate.current === q) return;
    triedLocate.current = q;
    setLoading("locate");
    try {
      const data = await locatePlace(q, countryCode, regionListed ? region : "");
      if (triedLocate.current !== q) return; // the host typed on
      if (data.place) {
        onPlaced("", data.place);
        setLocated(true);
        setProblem("");
      } else if (data.error && data.error !== "not_configured") {
        setProblem(t(problemKey(data.error)));
      } else {
        setProblem(t("notFound"));
      }
    } catch {
      setProblem(t("notFound"));
    } finally {
      if (triedLocate.current === q) setLoading("");
    }
  }

  function forget() {
    setLocated(false);
    onForget();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % suggestions.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1)); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(suggestions[active]); }
    else if (e.key === "Escape") { e.preventDefault(); keepTyped(); }
  }

  const listId = "venue-suggestions";
  // Earlier results stay visible while the next search runs, so the list doesn't flicker.
  const showList = available && open && !place && resultsFor !== "" && venue.trim().length >= MIN_CHARS;

  return (
    <label className="field">
      <span>{t("label")}</span>
      <div className="combo">
        <input
          className="input"
          name="venue"
          maxLength={300}
          autoComplete="off"
          role={available ? "combobox" : undefined}
          aria-expanded={available ? showList : undefined}
          aria-controls={available ? listId : undefined}
          aria-autocomplete={available ? "list" : undefined}
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          placeholder={available ? t("searchPlaceholder") : t("plainPlaceholder")}
          value={venue}
          onChange={(e) => { onType(e.target.value); setOpen(true); setLocated(false); setProblem(""); }}
          onFocus={() => { if (suggestions.length) setOpen(true); }}
          onBlur={() => { setOpen(false); void locate(); }}
          onKeyDown={onKeyDown}
        />
        {loading && <span className="combo-spin" aria-hidden><span className="spinner" /></span>}
        {showList && (
          <ul className="combo-list" id={listId} role="listbox">
            {suggestions.map((s, i) => (
              <li
                key={s.placeId}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={`combo-opt ${i === active ? "active" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                onMouseEnter={() => setActive(i)}
              >
                {s.main}
                {s.secondary && <small>{s.secondary}</small>}
              </li>
            ))}
            {suggestions.length === 0 && resultsFor === venue.trim() && (
              <li className="combo-empty">{t("noMatches")}</li>
            )}
            <li className="combo-opt combo-keep" role="option" aria-selected={false}
              onMouseDown={(e) => { e.preventDefault(); keepTyped(); }}>
              {t("useTyped", { text: venue.trim() })}
            </li>
          </ul>
        )}
      </div>
      <span className="muted small" aria-live="polite">
        {loading === "search" ? t("searching")
          : loading === "details" ? t("gettingAddress")
          : loading === "locate" ? t("locating")
          : problem ? problem
          : place?.address && located ? t.rich("found", { address: place.address, button: (c) => <button type="button" className="link-btn" onClick={forget}>{c}</button> })
          : place?.address ? t("address", { address: place.address })
          : available ? (regionListed && region ? t("suggestionsIn", { region }) : t("pickOrType"))
          : null}
      </span>
    </label>
  );
}
