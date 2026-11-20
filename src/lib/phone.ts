// The buyer's phone on checkout (Change 4 chunk 3d, 4b): a country picker plus the number as typed,
// sent to the API in E.164 (+2348012345678). Pure, so the rules are unit-tested; the API checks the
// result again (order.buyer_phone_invalid).

/** Country (ISO 3166-1 alpha-2) → its international dialling code, without the "+". */
const DIAL: Record<string, string> = Object.fromEntries(
  (
    "AF93 AL355 DZ213 AS1684 AD376 AO244 AI1264 AG1268 AR54 AM374 AW297 AU61 AT43 AZ994 BS1242 BH973 BD880 BB1246 BY375 " +
    "BE32 BZ501 BJ229 BM1441 BT975 BO591 BA387 BW267 BR55 VG1284 BN673 BG359 BF226 BI257 KH855 CM237 CA1 CV238 KY1345 " +
    "CF236 TD235 CL56 CN86 CO57 KM269 CG242 CD243 CK682 CR506 CI225 HR385 CU53 CW599 CY357 CZ420 DK45 DJ253 DM1767 DO1809 " +
    "EC593 EG20 SV503 GQ240 ER291 EE372 SZ268 ET251 FK500 FO298 FJ679 FI358 FR33 GF594 PF689 GA241 GM220 GE995 DE49 GH233 " +
    "GI350 GR30 GL299 GD1473 GP590 GU1671 GT502 GG44 GN224 GW245 GY592 HT509 HN504 HK852 HU36 IS354 IN91 ID62 IR98 IQ964 " +
    "IE353 IM44 IL972 IT39 JM1876 JP81 JE44 JO962 KZ7 KE254 KI686 XK383 KW965 KG996 LA856 LV371 LB961 LS266 LR231 LY218 " +
    "LI423 LT370 LU352 MO853 MG261 MW265 MY60 MV960 ML223 MT356 MH692 MQ596 MR222 MU230 YT262 MX52 FM691 MD373 MC377 MN976 " +
    "ME382 MS1664 MA212 MZ258 MM95 NA264 NR674 NP977 NL31 NC687 NZ64 NI505 NE227 NG234 NU683 KP850 MK389 MP1670 NO47 OM968 " +
    "PK92 PW680 PS970 PA507 PG675 PY595 PE51 PH63 PL48 PT351 PR1787 QA974 RE262 RO40 RU7 RW250 BL590 SH290 KN1869 LC1758 " +
    "MF590 PM508 VC1784 WS685 SM378 ST239 SA966 SN221 RS381 SC248 SL232 SG65 SX1721 SK421 SI386 SB677 SO252 ZA27 KR82 SS211 " +
    "ES34 LK94 SD249 SR597 SE46 CH41 SY963 TW886 TJ992 TZ255 TH66 TL670 TG228 TK690 TO676 TT1868 TN216 TR90 TM993 TC1649 " +
    "TV688 UG256 UA380 AE971 GB44 US1 UY598 UZ998 VU678 VA39 VE58 VN84 VI1340 WF681 YE967 ZM260 ZW263"
  )
    .split(" ")
    .map((entry) => [entry.slice(0, 2), entry.slice(2)]),
);

/** Where several countries share a code, the one a bare number is read as (unless the event's country shares it). */
const PRIMARY: Record<string, string> = { "1": "US", "7": "RU", "44": "GB", "39": "IT", "262": "RE", "590": "GP" };

/** Countries whose numbers keep their leading 0 after the country code (Italy's landlines). */
const KEEPS_ZERO = new Set(["IT", "SM", "VA"]);

const E164 = /^\+[1-9]\d{6,14}$/;

export const PHONE_COUNTRIES: readonly string[] = Object.keys(DIAL);

/** "+234" for "NG"; null for a country we don't know. */
export function dialCode(country: string | null | undefined): string | null {
  const code = country ? DIAL[country.toUpperCase()] : undefined;
  return code ? `+${code}` : null;
}

export function isPhoneCountry(country: string | null | undefined): country is string {
  return !!country && Object.hasOwn(DIAL, country.toUpperCase());
}

/**
 * The number as typed, with the chosen country → E.164, or null when it can't be one.
 * "0803 123 4567" in NG → "+2348031234567" (one trunk 0 dropped, except in Italy); a number typed
 * with its own "+" or "00" prefix keeps its country, whatever the picker says.
 */
export function toE164(country: string | null | undefined, raw: string): string | null {
  const typed = raw.trim().replace(/[\s\-.() ]/g, "");
  if (!typed) return null;
  let phone: string;
  if (typed.startsWith("+")) phone = typed;
  else if (typed.startsWith("00")) phone = `+${typed.slice(2)}`;
  else {
    const dial = isPhoneCountry(country) ? DIAL[country.toUpperCase()]! : null;
    if (!dial || !/^\d+$/.test(typed)) return null;
    const national = KEEPS_ZERO.has(country!.toUpperCase()) ? typed : typed.replace(/^0/, "");
    phone = `+${dial}${national}`;
  }
  return E164.test(phone) ? phone : null;
}

/**
 * A stored E.164 number back into the picker and the field: the preferred country when its code
 * fits (so +1 stays Canada for a Canadian event), else the longest matching code. Null when the
 * number isn't E.164 or no code fits.
 */
export function splitPhone(e164: string | null | undefined, preferred?: string | null): { country: string; national: string } | null {
  if (!e164 || !E164.test(e164)) return null;
  const digits = e164.slice(1);
  const pref = preferred?.toUpperCase();
  if (pref && isPhoneCountry(pref) && digits.startsWith(DIAL[pref]!)) return { country: pref, national: digits.slice(DIAL[pref]!.length) };
  let best: string | null = null;
  for (const [country, code] of Object.entries(DIAL)) {
    if (!digits.startsWith(code)) continue;
    const current = best ? DIAL[best]! : "";
    if (code.length > current.length || (code.length === current.length && PRIMARY[code] === country)) best = country;
  }
  return best ? { country: best, national: digits.slice(DIAL[best]!.length) } : null;
}

/** The picker's options in the reader's language, sorted by name: "Nigeria (+234)". */
export function phoneCountryOptions(locale: string): { value: string; label: string }[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale, "en"], { type: "region" });
  } catch {
    names = null;
  }
  const collator = new Intl.Collator(locale);
  return PHONE_COUNTRIES.map((code) => ({ code, name: names?.of(code) ?? code }))
    .sort((a, b) => collator.compare(a.name, b.name))
    .map(({ code, name }) => ({ value: code, label: `${name} (⁦+${DIAL[code]}⁩)` }));
}
