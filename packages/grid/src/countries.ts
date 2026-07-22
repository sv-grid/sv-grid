/**
 * countries - a compact country reference for SvPhoneInput / SvCountryInput.
 * ISO 3166-1 alpha-2 code, display name, E.164 dial code, and a flag emoji
 * (derived from the code so no image assets are needed). This is a curated
 * common-set; extend `COUNTRIES` for full coverage.
 */
export type Country = { code: string; name: string; dial: string }

/** Regional-indicator flag emoji from an ISO alpha-2 code. */
export function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}

export const COUNTRIES: Country[] = [
  { code: 'US', name: 'United States', dial: '+1' },
  { code: 'CA', name: 'Canada', dial: '+1' },
  { code: 'GB', name: 'United Kingdom', dial: '+44' },
  { code: 'IE', name: 'Ireland', dial: '+353' },
  { code: 'FR', name: 'France', dial: '+33' },
  { code: 'DE', name: 'Germany', dial: '+49' },
  { code: 'ES', name: 'Spain', dial: '+34' },
  { code: 'PT', name: 'Portugal', dial: '+351' },
  { code: 'IT', name: 'Italy', dial: '+39' },
  { code: 'NL', name: 'Netherlands', dial: '+31' },
  { code: 'BE', name: 'Belgium', dial: '+32' },
  { code: 'CH', name: 'Switzerland', dial: '+41' },
  { code: 'AT', name: 'Austria', dial: '+43' },
  { code: 'SE', name: 'Sweden', dial: '+46' },
  { code: 'NO', name: 'Norway', dial: '+47' },
  { code: 'DK', name: 'Denmark', dial: '+45' },
  { code: 'FI', name: 'Finland', dial: '+358' },
  { code: 'PL', name: 'Poland', dial: '+48' },
  { code: 'CZ', name: 'Czechia', dial: '+420' },
  { code: 'GR', name: 'Greece', dial: '+30' },
  { code: 'BG', name: 'Bulgaria', dial: '+359' },
  { code: 'RO', name: 'Romania', dial: '+40' },
  { code: 'UA', name: 'Ukraine', dial: '+380' },
  { code: 'RU', name: 'Russia', dial: '+7' },
  { code: 'TR', name: 'Turkey', dial: '+90' },
  { code: 'IL', name: 'Israel', dial: '+972' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971' },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966' },
  { code: 'IN', name: 'India', dial: '+91' },
  { code: 'PK', name: 'Pakistan', dial: '+92' },
  { code: 'CN', name: 'China', dial: '+86' },
  { code: 'HK', name: 'Hong Kong', dial: '+852' },
  { code: 'JP', name: 'Japan', dial: '+81' },
  { code: 'KR', name: 'South Korea', dial: '+82' },
  { code: 'SG', name: 'Singapore', dial: '+65' },
  { code: 'MY', name: 'Malaysia', dial: '+60' },
  { code: 'TH', name: 'Thailand', dial: '+66' },
  { code: 'ID', name: 'Indonesia', dial: '+62' },
  { code: 'PH', name: 'Philippines', dial: '+63' },
  { code: 'VN', name: 'Vietnam', dial: '+84' },
  { code: 'AU', name: 'Australia', dial: '+61' },
  { code: 'NZ', name: 'New Zealand', dial: '+64' },
  { code: 'ZA', name: 'South Africa', dial: '+27' },
  { code: 'NG', name: 'Nigeria', dial: '+234' },
  { code: 'EG', name: 'Egypt', dial: '+20' },
  { code: 'KE', name: 'Kenya', dial: '+254' },
  { code: 'MA', name: 'Morocco', dial: '+212' },
  { code: 'BR', name: 'Brazil', dial: '+55' },
  { code: 'AR', name: 'Argentina', dial: '+54' },
  { code: 'CL', name: 'Chile', dial: '+56' },
  { code: 'CO', name: 'Colombia', dial: '+57' },
  { code: 'MX', name: 'Mexico', dial: '+52' },
]

/**
 * Expected national (post-dial-code) significant-digit count per country, as an
 * exact length or an inclusive [min, max] range. A pragmatic length-based check
 * (not full libphonenumber). Countries without an entry accept any non-empty
 * number.
 */
export const PHONE_NATIONAL_LENGTHS: Record<string, number | [number, number]> = {
  US: 10, CA: 10, GB: 10, IE: 9, FR: 9, DE: [10, 11], ES: 9, IT: [9, 10], NL: 9, BE: [8, 9],
  CH: 9, AT: [10, 12], SE: [7, 9], NO: 8, DK: 8, FI: [9, 10], PL: 9, PT: 9, GR: 10, CZ: 9,
  RU: 10, TR: 10, IL: 9, AE: 9, SA: 9, IN: 10, PK: 10, CN: 11, HK: 8, JP: 10, KR: [9, 10],
  SG: 8, MY: [9, 10], TH: 9, ID: [9, 11], PH: 10, VN: 9, AU: 9, NZ: [8, 10], ZA: 9, NG: 10,
  EG: 10, KE: 9, MA: 9, BR: 11, AR: 10, CL: 9, CO: 10, MX: 10,
}

/**
 * Whether `nationalDigits` is a plausible national number for `code` (length
 * check). Unknown countries pass on any non-empty input. Pure.
 */
export function phoneDigitsValid(code: string, nationalDigits: string): boolean {
  const n = (nationalDigits.match(/\d/g) ?? []).length
  const rule = PHONE_NATIONAL_LENGTHS[code.toUpperCase()]
  if (rule == null) return n > 0
  return typeof rule === 'number' ? n === rule : n >= rule[0] && n <= rule[1]
}

export const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]))
