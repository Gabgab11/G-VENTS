// The countries offered first on the event form. Their states and time zones come from
// gventz-api's reference data (src/lib/reference.ts), the same list the API checks against.
// Countries outside this list can still be chosen.

export type Country = { code: string; name: string };

// ISO 3166-1 alpha-2 codes. Order is the default order in the dropdown.
export const COUNTRIES: Country[] = [
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "KE", name: "Kenya" },
  { code: "ZA", name: "South Africa" },
  { code: "EG", name: "Egypt" },
  { code: "ET", name: "Ethiopia" },
  { code: "TZ", name: "Tanzania" },
  { code: "UG", name: "Uganda" },
  { code: "RW", name: "Rwanda" },
  { code: "SN", name: "Senegal" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "CM", name: "Cameroon" },
  { code: "MA", name: "Morocco" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "NL", name: "Netherlands" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "PT", name: "Portugal" },
  { code: "BE", name: "Belgium" },
  { code: "IN", name: "India" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "JM", name: "Jamaica" },
];

export const DEFAULT_COUNTRY = "NG";

const ISO = /^[A-Z]{2}$/;

export function isCountryCode(code: string): boolean {
  return ISO.test(code);
}

export function findCountry(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

// English name for any ISO code, so a visitor from a country outside the list
// still sees their own country first. Returns null for codes Intl doesn't know.
export function countryName(code: string): string | null {
  const known = findCountry(code);
  if (known) return known.name;
  if (!isCountryCode(code)) return null;
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(code);
    return name && name !== code ? name : null;
  } catch {
    return null;
  }
}

// The dropdown list: the visitor's country first (detected from their IP on
// the server), then the rest in the default order. Nigeria leads when nothing
// was detected.
export function orderedCountries(detected: string | null | undefined): Country[] {
  const first = detected && isCountryCode(detected) ? detected : DEFAULT_COUNTRY;
  const name = countryName(first);
  if (!name) return orderedCountries(DEFAULT_COUNTRY);
  return [{ code: first, name }, ...COUNTRIES.filter((c) => c.code !== first)];
}

// Case- and accent-insensitive "contains" match for the search boxes.
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
