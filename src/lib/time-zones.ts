// Readable names for IANA time zones on the event form: "Lagos · West Africa Time (GMT+1)"
// instead of "Africa/Lagos". Built on the browser's Intl data, so nothing is bundled.

function part(zone: string, style: "longGeneric" | "shortOffset", at: Date): string {
  try {
    return new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: style }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

/** "Buenos Aires" from "America/Argentina/Buenos_Aires"; "UTC" stays as it is. */
export function zoneCity(zone: string): string {
  return (zone.split("/").pop() ?? zone).replace(/_/g, " ");
}

/** "Lagos · West Africa Time (GMT+1)"; just the city when Intl doesn't know the zone. */
export function zoneLabel(zone: string, at: Date = new Date()): string {
  const city = zoneCity(zone);
  const name = part(zone, "longGeneric", at);
  const offset = part(zone, "shortOffset", at);
  if (!name && !offset) return city;
  if (!name || name.startsWith("GMT")) return `${city} (${offset || name})`;
  return `${city} · ${name}${offset ? ` (${offset})` : ""}`;
}

/** Zones people know their clock by, picked when a country has several zones on the same clock. */
const WELL_KNOWN = new Set([
  "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu",
  "America/Toronto", "America/Winnipeg", "America/Edmonton", "America/Vancouver", "America/Halifax", "America/St_Johns", "America/Regina",
  "America/Mexico_City", "America/Cancun", "America/Tijuana", "America/Sao_Paulo", "America/Manaus", "America/Argentina/Buenos_Aires",
  "Australia/Sydney", "Australia/Brisbane", "Australia/Adelaide", "Australia/Perth", "Australia/Darwin", "Europe/Moscow", "Asia/Jakarta",
  "Africa/Kinshasa", "Africa/Lubumbashi", "Europe/Madrid", "Atlantic/Canary", "Europe/Lisbon", "Atlantic/Azores", "Europe/London", "Asia/Shanghai",
]);

/**
 * A country's zones, one per clock (same name and offset now), ordered west to east: the US's
 * 29 zones become Hawaii, Alaska, Pacific, Mountain, Arizona, Central and Eastern. Each clock is
 * represented by a zone people know (New York, not Indiana/Vevay) where there is one.
 */
export function mainZones(zones: readonly string[], at: Date = new Date()): string[] {
  const clocks = new Map<string, string[]>();
  for (const z of zones) {
    const key = `${part(z, "longGeneric", at)}|${part(z, "shortOffset", at)}`;
    clocks.set(key, [...(clocks.get(key) ?? []), z]);
  }
  const pick = (group: string[]) => group.find((z) => WELL_KNOWN.has(z)) ?? group.find((z) => z.split("/").length === 2) ?? group[0]!;
  return [...clocks.values()].map(pick).sort((a, b) => offsetMinutes(a, at) - offsetMinutes(b, at));
}

function offsetMinutes(zone: string, at: Date): number {
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(part(zone, "shortOffset", at));
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
}

/** Every zone the browser knows, the given ones first (a country's zones), each once. */
export function zoneOptions(first: readonly string[], all: readonly string[] = supportedZones()): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const z of [...first, ...all]) {
    if (!seen.has(z)) {
      seen.add(z);
      out.push(z);
    }
  }
  return out;
}

export function supportedZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
}
