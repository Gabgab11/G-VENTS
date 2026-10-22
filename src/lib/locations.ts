// Countries and their first-level regions for the event form.
// Built in (no API calls): the official first-level divisions of each country,
// e.g. Nigeria's 36 states plus the FCT, US states, Canadian provinces,
// Egyptian governorates. Countries outside this list can still be chosen;
// their region is typed in by hand.

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

type RegionSet = { label: string; regions: string[] };

export const REGIONS: Record<string, RegionSet> = {
  NG: {
    label: "State",
    regions: [
      "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
      "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT Abuja", "Gombe",
      "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
      "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
      "Taraba", "Yobe", "Zamfara",
    ],
  },
  GH: {
    label: "Region",
    regions: [
      "Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern", "Greater Accra",
      "North East", "Northern", "Oti", "Savannah", "Upper East", "Upper West", "Volta",
      "Western", "Western North",
    ],
  },
  KE: {
    label: "County",
    regions: [
      "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa",
      "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi",
      "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu", "Machakos",
      "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi",
      "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri", "Samburu", "Siaya",
      "Taita-Taveta", "Tana River", "Tharaka-Nithi", "Trans Nzoia", "Turkana",
      "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
    ],
  },
  ZA: {
    label: "Province",
    regions: [
      "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga",
      "North West", "Northern Cape", "Western Cape",
    ],
  },
  EG: {
    label: "Governorate",
    regions: [
      "Alexandria", "Aswan", "Asyut", "Beheira", "Beni Suef", "Cairo", "Dakahlia", "Damietta",
      "Faiyum", "Gharbia", "Giza", "Ismailia", "Kafr El Sheikh", "Luxor", "Matrouh", "Minya",
      "Monufia", "New Valley", "North Sinai", "Port Said", "Qalyubia", "Qena", "Red Sea",
      "Sharqia", "Sohag", "South Sinai", "Suez",
    ],
  },
  ET: {
    label: "Region",
    regions: [
      "Addis Ababa", "Afar", "Amhara", "Benishangul-Gumuz", "Central Ethiopia", "Dire Dawa",
      "Gambela", "Harari", "Oromia", "Sidama", "Somali", "South Ethiopia",
      "South West Ethiopia Peoples'", "Tigray",
    ],
  },
  TZ: {
    label: "Region",
    regions: [
      "Arusha", "Dar es Salaam", "Dodoma", "Geita", "Iringa", "Kagera", "Kaskazini Pemba",
      "Kaskazini Unguja", "Katavi", "Kigoma", "Kilimanjaro", "Kusini Pemba", "Kusini Unguja",
      "Lindi", "Manyara", "Mara", "Mbeya", "Mjini Magharibi", "Morogoro", "Mtwara", "Mwanza",
      "Njombe", "Pwani", "Rukwa", "Ruvuma", "Shinyanga", "Simiyu", "Singida", "Songwe",
      "Tabora", "Tanga",
    ],
  },
  UG: {
    label: "Region",
    regions: ["Central", "Eastern", "Northern", "Western"],
  },
  RW: {
    label: "Province",
    regions: ["Eastern", "Kigali", "Northern", "Southern", "Western"],
  },
  SN: {
    label: "Region",
    regions: [
      "Dakar", "Diourbel", "Fatick", "Kaffrine", "Kaolack", "Kédougou", "Kolda", "Louga",
      "Matam", "Saint-Louis", "Sédhiou", "Tambacounda", "Thiès", "Ziguinchor",
    ],
  },
  CI: {
    label: "District",
    regions: [
      "Abidjan", "Bas-Sassandra", "Comoé", "Denguélé", "Gôh-Djiboua", "Lacs", "Lagunes",
      "Montagnes", "Sassandra-Marahoué", "Savanes", "Vallée du Bandama", "Woroba",
      "Yamoussoukro", "Zanzan",
    ],
  },
  CM: {
    label: "Region",
    regions: [
      "Adamawa", "Centre", "East", "Far North", "Littoral", "North", "North-West", "South",
      "South-West", "West",
    ],
  },
  MA: {
    label: "Region",
    regions: [
      "Béni Mellal-Khénifra", "Casablanca-Settat", "Dakhla-Oued Ed-Dahab", "Drâa-Tafilalet",
      "Fès-Meknès", "Guelmim-Oued Noun", "Laâyoune-Sakia El Hamra", "Marrakech-Safi",
      "Oriental", "Rabat-Salé-Kénitra", "Souss-Massa", "Tanger-Tétouan-Al Hoceïma",
    ],
  },
  US: {
    label: "State",
    regions: [
      "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
      "Delaware", "District of Columbia", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois",
      "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
      "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana",
      "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York",
      "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
      "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah",
      "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
    ],
  },
  CA: {
    label: "Province or territory",
    regions: [
      "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador",
      "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island",
      "Quebec", "Saskatchewan", "Yukon",
    ],
  },
  GB: {
    label: "Nation",
    regions: ["England", "Northern Ireland", "Scotland", "Wales"],
  },
  IE: {
    label: "County",
    regions: [
      "Carlow", "Cavan", "Clare", "Cork", "Donegal", "Dublin", "Galway", "Kerry", "Kildare",
      "Kilkenny", "Laois", "Leitrim", "Limerick", "Longford", "Louth", "Mayo", "Meath",
      "Monaghan", "Offaly", "Roscommon", "Sligo", "Tipperary", "Waterford", "Westmeath",
      "Wexford", "Wicklow",
    ],
  },
  FR: {
    label: "Region",
    regions: [
      "Auvergne-Rhône-Alpes", "Bourgogne-Franche-Comté", "Bretagne", "Centre-Val de Loire",
      "Corse", "Grand Est", "Guadeloupe", "Guyane", "Hauts-de-France", "Île-de-France",
      "La Réunion", "Martinique", "Mayotte", "Normandie", "Nouvelle-Aquitaine", "Occitanie",
      "Pays de la Loire", "Provence-Alpes-Côte d'Azur",
    ],
  },
  DE: {
    label: "State",
    regions: [
      "Baden-Württemberg", "Bavaria", "Berlin", "Brandenburg", "Bremen", "Hamburg", "Hesse",
      "Lower Saxony", "Mecklenburg-Vorpommern", "North Rhine-Westphalia",
      "Rhineland-Palatinate", "Saarland", "Saxony", "Saxony-Anhalt", "Schleswig-Holstein",
      "Thuringia",
    ],
  },
  NL: {
    label: "Province",
    regions: [
      "Drenthe", "Flevoland", "Friesland", "Gelderland", "Groningen", "Limburg",
      "North Brabant", "North Holland", "Overijssel", "South Holland", "Utrecht", "Zeeland",
    ],
  },
  ES: {
    label: "Autonomous community",
    regions: [
      "Andalusia", "Aragon", "Asturias", "Balearic Islands", "Basque Country",
      "Canary Islands", "Cantabria", "Castile and León", "Castilla-La Mancha", "Catalonia",
      "Ceuta", "Extremadura", "Galicia", "La Rioja", "Madrid", "Melilla", "Murcia",
      "Navarre", "Valencian Community",
    ],
  },
  IT: {
    label: "Region",
    regions: [
      "Abruzzo", "Aosta Valley", "Apulia", "Basilicata", "Calabria", "Campania",
      "Emilia-Romagna", "Friuli Venezia Giulia", "Lazio", "Liguria", "Lombardy", "Marche",
      "Molise", "Piedmont", "Sardinia", "Sicily", "Trentino-Alto Adige", "Tuscany", "Umbria",
      "Veneto",
    ],
  },
  PT: {
    label: "District",
    regions: [
      "Aveiro", "Azores", "Beja", "Braga", "Bragança", "Castelo Branco", "Coimbra", "Évora",
      "Faro", "Guarda", "Leiria", "Lisbon", "Madeira", "Portalegre", "Porto", "Santarém",
      "Setúbal", "Viana do Castelo", "Vila Real", "Viseu",
    ],
  },
  BE: {
    label: "Region",
    regions: ["Brussels-Capital", "Flanders", "Wallonia"],
  },
  IN: {
    label: "State or union territory",
    regions: [
      "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
      "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
      "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
      "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur",
      "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan",
      "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
      "West Bengal",
    ],
  },
  AE: {
    label: "Emirate",
    regions: ["Abu Dhabi", "Ajman", "Dubai", "Fujairah", "Ras Al Khaimah", "Sharjah", "Umm Al Quwain"],
  },
  SA: {
    label: "Region",
    regions: [
      "Al Bahah", "Al Jawf", "Al Qassim", "Asir", "Eastern Province", "Hail", "Jazan",
      "Madinah", "Makkah", "Najran", "Northern Borders", "Riyadh", "Tabuk",
    ],
  },
  BR: {
    label: "State",
    regions: [
      "Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal",
      "Espírito Santo", "Goiás", "Maranhão", "Mato Grosso", "Mato Grosso do Sul",
      "Minas Gerais", "Pará", "Paraíba", "Paraná", "Pernambuco", "Piauí", "Rio de Janeiro",
      "Rio Grande do Norte", "Rio Grande do Sul", "Rondônia", "Roraima", "Santa Catarina",
      "São Paulo", "Sergipe", "Tocantins",
    ],
  },
  MX: {
    label: "State",
    regions: [
      "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas",
      "Chihuahua", "Coahuila", "Colima", "Durango", "Guanajuato", "Guerrero", "Hidalgo",
      "Jalisco", "Mexico City", "México", "Michoacán", "Morelos", "Nayarit", "Nuevo León",
      "Oaxaca", "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora",
      "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas",
    ],
  },
  JM: {
    label: "Parish",
    regions: [
      "Clarendon", "Hanover", "Kingston", "Manchester", "Portland", "St. Andrew", "St. Ann",
      "St. Catherine", "St. Elizabeth", "St. James", "St. Mary", "St. Thomas", "Trelawny",
      "Westmoreland",
    ],
  },
};

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

export function regionsFor(code: string): RegionSet | null {
  return REGIONS[code] ?? null;
}

// Case- and accent-insensitive "contains" match for the search boxes.
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
