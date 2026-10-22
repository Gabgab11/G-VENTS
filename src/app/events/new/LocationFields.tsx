"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Combobox from "@/components/Combobox";
import { orderedCountries, regionsFor } from "@/lib/locations";

type Suggestion = { placeId: string; main: string; secondary: string };
type Place = { placeId: string; address: string; city: string; lat: number | null; lng: number | null };

const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;

function newSession(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

function problemText(code: string): string {
  if (code === "signed_out") return "Your session ended. Sign in again to search for venues.";
  if (code === "rate_limited") return "Too many searches at once. Wait a moment, or type the address yourself.";
  return "Venue suggestions aren't available right now. You can type the address yourself.";
}

// Country → State/Region → Venue, in that order.
// Changing the country clears the region and venue; changing the region clears
// the venue, so a venue from one place is never saved under another.
export default function LocationFields({
  detectedCountry,
  placesEnabled,
}: {
  detectedCountry: string | null;
  placesEnabled: boolean;
}) {
  const countries = useMemo(() => orderedCountries(detectedCountry), [detectedCountry]);
  const [countryCode, setCountryCode] = useState(countries[0].code);
  const [region, setRegion] = useState("");
  const [venue, setVenue] = useState("");
  const [place, setPlace] = useState<Place | null>(null);

  const country = countries.find((c) => c.code === countryCode);
  const regionSet = regionsFor(countryCode);

  function clearVenue() {
    setVenue("");
    setPlace(null);
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

  return (
    <>
      <div className="row2">
        <Combobox
          name="country_code"
          label="Country"
          options={countries.map((c) => ({ value: c.code, label: c.name }))}
          value={countryCode}
          onChange={changeCountry}
          placeholder="Search countries"
        />
        {regionSet ? (
          <Combobox
            key={countryCode}
            name="region"
            label={regionSet.label}
            options={regionSet.regions.map((r) => ({ value: r, label: r }))}
            value={region}
            onChange={changeRegion}
            placeholder={`Choose a ${regionSet.label.toLowerCase()}`}
          />
        ) : (
          <label className="field"><span>State, city or region</span>
            <input className="input" name="region" maxLength={120} value={region}
              onChange={(e) => { setRegion(e.target.value); setPlace(null); }} /></label>
        )}
      </div>

      <VenueSearch
        // A new country or listed region starts a fresh search (typed regions don't, so typing isn't interrupted).
        key={`${countryCode}|${regionSet ? region : ""}`}
        countryCode={countryCode}
        region={region}
        enabled={placesEnabled}
        venue={venue}
        place={place}
        onType={(text) => { setVenue(text); setPlace(null); }}
        onPick={(name, picked) => { setVenue(name); setPlace(picked); }}
      />

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
  enabled,
  venue,
  place,
  onType,
  onPick,
}: {
  countryCode: string;
  region: string;
  enabled: boolean;
  venue: string;
  place: Place | null;
  onType: (text: string) => void;
  onPick: (name: string, place: Place) => void;
}) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [resultsFor, setResultsFor] = useState(""); // the search text the current suggestions answer
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState<"" | "search" | "details">("");
  const [problem, setProblem] = useState("");
  const [available, setAvailable] = useState(enabled);
  const session = useRef(newSession());
  const searchAbort = useRef<AbortController | null>(null);
  const lastQuery = useRef("");

  // Debounced search while the host types. Stale requests are cancelled.
  useEffect(() => {
    const q = venue.trim();
    if (!available || place || q.length < MIN_CHARS || q === lastQuery.current) {
      if (q.length < MIN_CHARS) { setSuggestions([]); setResultsFor(""); setLoading(""); }
      return;
    }
    const timer = setTimeout(async () => {
      searchAbort.current?.abort();
      const controller = new AbortController();
      searchAbort.current = controller;
      lastQuery.current = q;
      setLoading("search");
      try {
        const params = new URLSearchParams({ q, country: countryCode, region, session: session.current });
        const res = await fetch(`/api/places/autocomplete?${params}`, { signal: controller.signal });
        const data = (await res.json().catch(() => ({}))) as { suggestions?: Suggestion[]; error?: string };
        if (!res.ok) {
          if (data.error === "not_configured") setAvailable(false);
          else setProblem(problemText(data.error ?? ""));
          setSuggestions([]);
        } else {
          setProblem("");
          setSuggestions(data.suggestions ?? []);
          setResultsFor(q);
          setActive(-1);
          setOpen(true);
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") setProblem(problemText(""));
      } finally {
        if (searchAbort.current === controller) setLoading("");
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [venue, place, available, countryCode, region]);

  useEffect(() => () => searchAbort.current?.abort(), []);

  async function pick(s: Suggestion) {
    setOpen(false);
    setSuggestions([]);
    setResultsFor("");
    setLoading("details");
    onPick(s.main, { placeId: s.placeId, address: s.secondary ? `${s.main}, ${s.secondary}` : s.main, city: "", lat: null, lng: null });
    try {
      const params = new URLSearchParams({ id: s.placeId, session: session.current });
      const res = await fetch(`/api/places/details?${params}`);
      const data = (await res.json().catch(() => ({}))) as { place?: Place & { name: string }; error?: string };
      if (res.ok && data.place) {
        const p = data.place;
        onPick(p.name || s.main, { placeId: p.placeId, address: p.address, city: p.city, lat: p.lat, lng: p.lng });
        setProblem("");
      } else {
        setProblem("We kept the venue, but couldn't load its exact address. You can save it as it is.");
      }
    } catch {
      setProblem("We kept the venue, but couldn't load its exact address. You can save it as it is.");
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
      <span>Location / venue address</span>
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
          placeholder={available ? "Search a venue, hotel, landmark or street, or type it" : "Venue name, address, or online link"}
          value={venue}
          onChange={(e) => { onType(e.target.value); setOpen(true); }}
          onFocus={() => { if (suggestions.length) setOpen(true); }}
          onBlur={() => setOpen(false)}
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
              <li className="combo-empty">No matching places found.</li>
            )}
            <li className="combo-opt combo-keep" role="option" aria-selected={false}
              onMouseDown={(e) => { e.preventDefault(); keepTyped(); }}>
              Use “{venue.trim()}” as typed
            </li>
          </ul>
        )}
      </div>
      <span className="muted small" aria-live="polite">
        {loading === "search" ? "Searching places…"
          : loading === "details" ? "Getting the address…"
          : problem ? problem
          : place?.address ? `Address: ${place.address}`
          : available ? "Pick a suggestion for an exact address, or just type the venue."
          : null}
      </span>
    </label>
  );
}
