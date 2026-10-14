/**
 * Display formats for number-like and date fields, as the field editor offers
 * them: decimal places, which characters separate thousands and decimals, a
 * large-number abbreviation (1.2K, 3.4M), a currency symbol, duration as
 * h:mm(:ss(.S)), dates as local / friendly / US / European / ISO with a 12- or
 * 24-hour time, in local time or one shared time zone.
 */

export type Separators = 'local' | 'comma-period' | 'period-comma' | 'space-comma' | 'space-period'
export type Abbreviation = 'none' | 'thousand' | 'million' | 'billion'

export type NumberFormatProps = {
  /** Decimal places, 0..8. */
  precision?: number
  separators?: Separators
  /** Group thousands. Default true. */
  showThousands?: boolean
  abbreviation?: Abbreviation
}

const SEPARATOR_PAIRS: Record<Exclude<Separators, 'local'>, [thousands: string, decimal: string]> = {
  'comma-period': [',', '.'],
  'period-comma': ['.', ','],
  'space-comma': [' ', ','],
  'space-period': [' ', '.'],
}

const ABBR: Record<Exclude<Abbreviation, 'none'>, [divisor: number, suffix: string]> = {
  thousand: [1e3, 'K'],
  million: [1e6, 'M'],
  billion: [1e9, 'B'],
}

export function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** A number as the field shows it, without a currency symbol or percent sign. */
export function formatNumber(value: number, p: NumberFormatProps): string {
  let n = value
  let suffix = ''
  if (p.abbreviation && p.abbreviation !== 'none') {
    const [div, s] = ABBR[p.abbreviation]
    n = value / div
    suffix = s
  }
  const digits = Math.max(0, Math.min(8, Math.round(p.precision ?? 0)))
  const group = p.showThousands !== false
  const sep = p.separators ?? 'local'
  if (sep === 'local') {
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: group }).format(n) + suffix
  }
  const [th, dec] = SEPARATOR_PAIRS[sep]
  const fixed = Math.abs(n).toFixed(digits)
  const [int, frac] = fixed.split('.')
  const grouped = group ? int!.replace(/\B(?=(\d{3})+(?!\d))/g, th) : int!
  return `${n < 0 ? '-' : ''}${grouped}${frac ? dec + frac : ''}${suffix}`
}

/** The thousands and decimal characters a field's `separators` setting means. */
export function separatorChars(sep: Separators = 'local'): { group: string; decimal: string } {
  if (sep !== 'local') {
    const [group, decimal] = SEPARATOR_PAIRS[sep]
    return { group, decimal }
  }
  const parts = new Intl.NumberFormat(undefined, { useGrouping: true }).formatToParts(12345.6)
  return {
    group: parts.find((p) => p.type === 'group')?.value ?? ',',
    decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
  }
}

const MULTIPLIER: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 }

/**
 * A number from what someone typed into a number, currency or percent cell,
 * read with the field's own separators: "$1,200.50", "1.200,50 €" (with
 * period-comma), "-15%", "2.5k", "3M". The currency symbol, a percent sign and
 * spaces are ignored; a K, M or B suffix multiplies. Null when it is not a
 * number.
 */
export function parseNumberText(text: string, p: { separators?: Separators; symbol?: string } = {}): number | null {
  const { group, decimal } = separatorChars(p.separators)
  let s = text.trim()
  if (p.symbol) s = s.split(p.symbol).join('')
  s = s.replace(/[%\s  ]/g, '').replace(/−/g, '-')
  // Accounting style: (5) is -5.
  if (/^\(.*\)$/.test(s)) s = `-${s.slice(1, -1)}`
  let mult = 1
  const suffix = /[kmb]$/i.exec(s)
  if (suffix) {
    mult = MULTIPLIER[suffix[0].toLowerCase()]!
    s = s.slice(0, -1)
  }
  if (group.trim()) s = s.split(group).join('')
  if (decimal !== '.') s = s.split(decimal).join('.')
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null
  const n = Number(s) * mult
  return Number.isFinite(n) ? n : null
}

export type NumberFieldKind = 'number' | 'currency' | 'percent'
export type NumberFieldProps = {
  format?: 'integer' | 'decimal' | 'currency' | 'percent'
  precision?: number
  separators?: Separators
  symbol?: string
  symbolPosition?: 'before' | 'after'
  allowNegative?: boolean
  points?: boolean
}

/** Which of the three a number field is: its format, or an older currency / percent column's type. */
export function numberKind(fieldType: unknown, p: NumberFieldProps): NumberFieldKind {
  if (fieldType === 'currency' || p.format === 'currency') return 'currency'
  if (fieldType === 'percent' || p.format === 'percent') return 'percent'
  return 'number'
}

/**
 * How a number, currency or percent field stores what is typed: `places` to
 * round the typed number to (an integer field: 0), and `scale` between the
 * typed number and the stored one (100 for a percent field holding
 * fractions: 75 typed is 0.75 stored).
 */
export function numberFieldShape(kind: NumberFieldKind, p: NumberFieldProps): { places: number; scale: number } {
  const n = Number(p.precision)
  const ok = Number.isInteger(n) && n >= 0 && n <= 8
  const places = kind === 'number' ? (p.format === 'integer' ? 0 : ok ? n : 1) : kind === 'currency' ? (ok ? n : 2) : ok ? n : 0
  return { places, scale: kind === 'percent' && !p.points ? 100 : 1 }
}

/** The stored value for typed or pasted text: parsed, rounded, scaled. Null when it is not a number. */
export function numberFromText(text: string, kind: NumberFieldKind, p: NumberFieldProps): number | null {
  const n = parseNumberText(text, p)
  if (n == null) return null
  const { places, scale } = numberFieldShape(kind, p)
  const shown = roundTo(n, places)
  return scale === 1 ? shown : Number((shown / scale).toPrecision(12))
}

/**
 * Round half away from zero, as people do: 2450.555 to 2 places is 2450.56.
 * toFixed works on the binary value (2450.55499...) and rounds it down.
 */
export function roundTo(n: number, places: number): number {
  const f = 10 ** places
  return (Math.sign(n) * Math.round(Number((Math.abs(n) * f).toPrecision(15)))) / f
}

/**
 * A stored number as the edit box shows it: no grouping, the field's decimal
 * character, and float noise trimmed (0.1 + 0.2 shows 0.3).
 */
export function numberEditText(value: number, p: { separators?: Separators } = {}): string {
  const text = String(Number(value.toPrecision(12)))
  if (/e/i.test(text)) return text
  const { decimal } = separatorChars(p.separators)
  return decimal === '.' ? text : text.replace('.', decimal)
}

/**
 * Currency: the symbol before the number with the minus before both
 * ("-$5.00"), or after it with a space ("-5,00 €").
 */
export function formatCurrency(value: number, p: NumberFormatProps & { symbol?: string; symbolPosition?: 'before' | 'after' }): string {
  const symbol = p.symbol ?? '$'
  const body = formatNumber(Math.abs(value), p)
  const sign = value < 0 ? '-' : ''
  if (!symbol) return sign + body
  return p.symbolPosition === 'after' ? `${sign}${body}\u00a0${symbol}` : `${sign}${symbol}${body}`
}

/** Percent: `value` is a fraction (0.75 shows 75%) unless `points` says 0..100. */
export function formatPercent(value: number, p: NumberFormatProps & { points?: boolean }): string {
  return `${formatNumber(p.points ? value : value * 100, p)}%`
}

// ---- duration ---------------------------------------------------------------

export type DurationFormat = 'h:mm' | 'h:mm:ss' | 'h:mm:ss.S' | 'h:mm:ss.SS' | 'h:mm:ss.SSS'

/** Seconds as h:mm, h:mm:ss or h:mm:ss with tenths, hundredths or thousandths. */
export function formatDuration(seconds: number, format: DurationFormat = 'h:mm'): string {
  const neg = seconds < 0
  const s = Math.abs(seconds)
  const frac = format.endsWith('.SSS') ? 3 : format.endsWith('.SS') ? 2 : format.endsWith('.S') ? 1 : 0
  const withSeconds = format !== 'h:mm'
  const scale = 10 ** frac
  // Round once, at the shown precision, so 59.96 s does not print as 0:59.10.
  const units = withSeconds ? Math.round(s * scale) : Math.round(s / 60) * 60 * scale
  const totalSeconds = Math.floor(units / scale)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const sec = totalSeconds % 60
  let out = `${h}:${String(m).padStart(2, '0')}`
  if (withSeconds) out += `:${String(sec).padStart(2, '0')}`
  if (frac) out += `.${String(units % scale).padStart(frac, '0')}`
  return (neg ? '-' : '') + out
}

/** "1:30" -> 5400, "1:30:15.5" -> 5415.5, "90" -> 5400 (minutes), "2h 15m" -> 8100. */
export function parseDuration(text: unknown): number | null {
  if (typeof text === 'number') return Number.isFinite(text) ? text : null
  const t = String(text ?? '').trim()
  if (!t) return null
  const units = t.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in)?)?\s*(?:(\d+(?:\.\d+)?)\s*s)?$/i)
  if (units && (units[1] || units[2] || units[3])) {
    return Number(units[1] ?? 0) * 3600 + Number(units[2] ?? 0) * 60 + Number(units[3] ?? 0)
  }
  const neg = t.startsWith('-')
  const parts = t.replace(/^-/, '').split(':')
  if (parts.length > 3 || parts.some((x) => !/^\d+(\.\d+)?$/.test(x))) return null
  const nums = parts.map(Number)
  const secs = nums.length === 1 ? nums[0]! * 60 : nums.length === 2 ? nums[0]! * 3600 + nums[1]! * 60 : nums[0]! * 3600 + nums[1]! * 60 + nums[2]!
  return neg ? -secs : secs
}

// ---- dates ------------------------------------------------------------------

export type DateFormatName = 'local' | 'friendly' | 'us' | 'european' | 'iso'
export type DateFieldProps = {
  dateFormat?: DateFormatName
  /** Show the time too. */
  time?: boolean
  timeFormat?: '12hour' | '24hour'
  /** Show every date in GMT instead of the viewer's time zone. */
  gmt?: boolean
  /** Append the time zone. */
  showTimeZone?: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

export function toDate(value: unknown): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  // A bare YYYY-MM-DD is a calendar date: read it in local time, not as UTC
  // midnight, so it does not show as the day before west of Greenwich.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y!, m! - 1, d!)
  }
  const d = new Date(value as string | number)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * The date editor's text format (the grid's date-format tokens) for a date
 * field, so an edit shows the date as the cell does: "MMMM d, yyyy" for
 * friendly in English, "M/d/yyyy" for US. Local and friendly follow `Intl`,
 * read from the parts it gives for a sample date.
 */
export function dateEditTokens(p: DateFieldProps): string {
  let date: string
  switch (p.dateFormat ?? 'local') {
    case 'us':
      date = 'M/d/yyyy'
      break
    case 'european':
      date = 'd/M/yyyy'
      break
    case 'iso':
      date = 'yyyy-MM-dd'
      break
    default: {
      const long = p.dateFormat === 'friendly'
      // 5 January: a padded part shows as "05", a long month as a name.
      const parts = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: long ? 'long' : 'numeric', day: 'numeric' }).formatToParts(new Date(2026, 0, 5))
      date = parts
        .map((x) => {
          if (x.type === 'year') return 'yyyy'
          if (x.type === 'month') return long ? 'MMMM' : x.value.length === 2 ? 'MM' : 'M'
          if (x.type === 'day') return x.value.length === 2 ? 'dd' : 'd'
          // Literal text: quoted when it has letters, so they are not tokens.
          return /[a-z]/i.test(x.value) ? `'${x.value}'` : x.value
        })
        .join('')
    }
  }
  if (!p.time) return date
  return `${date} ${p.timeFormat === '24hour' ? 'HH:mm' : 'h:mm tt'}`
}

export function formatDate(value: unknown, p: DateFieldProps): string {
  const d = toDate(value)
  if (!d) return ''
  const utc = !!p.gmt
  const y = utc ? d.getUTCFullYear() : d.getFullYear()
  const mo = utc ? d.getUTCMonth() : d.getMonth()
  const day = utc ? d.getUTCDate() : d.getDate()
  let date: string
  switch (p.dateFormat ?? 'local') {
    case 'friendly':
      date = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: utc ? 'UTC' : undefined }).format(d)
      break
    case 'us':
      date = `${mo + 1}/${day}/${y}`
      break
    case 'european':
      date = `${day}/${mo + 1}/${y}`
      break
    case 'iso':
      date = `${y}-${pad(mo + 1)}-${pad(day)}`
      break
    default:
      date = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: utc ? 'UTC' : undefined }).format(d)
  }
  if (!p.time) return date
  const h = utc ? d.getUTCHours() : d.getHours()
  const mi = utc ? d.getUTCMinutes() : d.getMinutes()
  const time = p.timeFormat === '24hour' ? `${pad(h)}:${pad(mi)}` : `${((h + 11) % 12) + 1}:${pad(mi)}${h < 12 ? 'am' : 'pm'}`
  const zone = p.showTimeZone ? ` ${utc ? 'GMT' : localZoneName(d)}` : ''
  return `${date} ${time}${zone}`
}

function localZoneName(d: Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(d).find((x) => x.type === 'timeZoneName')?.value ?? ''
  } catch {
    return ''
  }
}
