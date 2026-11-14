import { api, data } from "@/lib/api/server";

// A country's states and time zones, from gventz-api's reference data (RD1-RD3). The API checks
// the state against the same list, so the form can only offer names the API accepts. Cached by
// Next.js for a day: the lists change only when the API's datasets do.

export type CountryReference = {
  code: string;
  /** What a first-level region is called there: "State", "County", "Province", ... */
  label: string;
  /** The country's IANA time zones (one for most countries). */
  zones: string[];
  /** The official first-level regions, or null when the country has none (typed by hand). */
  regions: string[] | null;
};

const DAY = 86_400;
const CODE = /^[A-Z]{2}$/;

export async function countryReference(code: string): Promise<CountryReference | null> {
  const cc = String(code).trim().toUpperCase();
  if (!CODE.test(cc)) return null;
  const client = await api({ anonymous: true, revalidate: DAY });
  const countries = data(await client.GET("/v1/reference/countries"));
  const country = countries.find((c) => c.code === cc);
  if (!country) return null;
  const regions = country.hasSubdivisions
    ? data(await client.GET("/v1/reference/countries/{code}/subdivisions", { params: { path: { code: cc } } }))
        .map((s) => s.name)
        .sort((a, b) => a.localeCompare(b, "en"))
    : null;
  return { code: cc, label: country.subdivisionLabel, zones: country.timeZones, regions: regions?.length ? regions : null };
}
