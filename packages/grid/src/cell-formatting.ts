/**
 * Helpers for SvGrid column `format` presets (numbers, currency, percent, date patterns).
 */

/** Map shortcut date patterns to Intl options (merged with caller `options`). */
export function resolveDatePattern(
  pattern: string | undefined,
  kind: 'date' | 'datetime',
): Intl.DateTimeFormatOptions | undefined {
  if (!pattern) return undefined

  const p = pattern.trim()

  switch (p) {
    /** Short numeric local date (no weekday). */
    case 'd':
      return kind === 'datetime'
        ? {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
          }
        : { year: 'numeric', month: 'numeric', day: 'numeric' }
    /** Long spelled-out date (+ time if datetime). */
    case 'D':
      return kind === 'datetime'
        ? {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
          }
        : { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    /** ISO-friendly yyyy-mm-dd (with time when datetime). */
    case 'y-m-d':
      return kind === 'datetime'
        ? {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }
        : { year: 'numeric', month: '2-digit', day: '2-digit' }
    case 'medium':
      return { dateStyle: 'medium', timeStyle: kind === 'datetime' ? 'short' : undefined }
    case 'short':
      return { dateStyle: 'short', timeStyle: kind === 'datetime' ? 'short' : undefined }
    case 'long':
      return { dateStyle: 'long', timeStyle: kind === 'datetime' ? 'short' : undefined }
    default:
      return undefined
  }
}

type NumericFormatInput = {
  type: 'number' | 'currency' | 'percent'
  locales?: string | readonly string[]
  currency?: string
  /** When type is percent: treat value as 0–100 instead of Intl’s 0–1 fraction */
  valueIsPercentPoints?: boolean
  options?: Intl.NumberFormatOptions
}

/**
 * `Intl.NumberFormat` is one of the most expensive constructors in the
 * platform - building one per cell on every scroll makes large grids
 * noticeably stutter. Cache instances by config signature (locale + style
 * + currency + options).
 */
const numberFormatterCache = new Map<string, Intl.NumberFormat>()
/**
 * A cached `Intl.NumberFormat` for the locale and options given. Cached because
 * constructing one is among the most expensive calls in the platform, and both
 * callers do it per rendered value: once per cell while scrolling a number
 * column, and once per axis tick, data label and tooltip while drawing a chart.
 */
export function getNumberFormatter(
  locales: string | readonly string[] | undefined,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  // Stable key - for normal column configs the options object is reused
  // (declared in module scope), so this stringifies a small static shape.
  const key =
    (Array.isArray(locales) ? locales.join(',') : locales ?? '') +
    '|' +
    (options.style ?? '') +
    '|' +
    (options.currency ?? '') +
    '|' +
    (options.minimumFractionDigits ?? '') +
    '|' +
    (options.maximumFractionDigits ?? '') +
    '|' +
    (options.useGrouping ?? '') +
    '|' +
    (options.currencyDisplay ?? '') +
    '|' +
    (options.notation ?? '') +
    // Every option that changes the output belongs in the key. `signDisplay`
    // was missing, so a percent column asking for "+3.27" got the formatter
    // a currency column with the same digits had already cached, and no sign.
    '|' +
    (options.signDisplay ?? '') +
    '|' +
    (options.minimumIntegerDigits ?? '') +
    '|' +
    (options.compactDisplay ?? '') +
    '|' +
    (options.unit ?? '') +
    '|' +
    (options.unitDisplay ?? '') +
    '|' +
    (options.minimumSignificantDigits ?? '') +
    '|' +
    (options.maximumSignificantDigits ?? '')
  let fmt = numberFormatterCache.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat(locales as string | string[] | undefined, options)
    numberFormatterCache.set(key, fmt)
  }
  return fmt
}

/**
 * A cell value as a Date, or null when it is not one. Accepts a Date, epoch ms,
 * or a parseable string.
 *
 * A bare calendar date ('2026-06-27') is read as LOCAL midnight of that day.
 * `new Date('2026-06-27')` reads it as UTC midnight, which every zone west of
 * UTC formats as the 26th. The day in the string is the day the user meant.
 */
export function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value !== 'string') return null
  const s = value.trim()
  if (s === '') return null
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (ymd) {
    const [y, m, day] = [Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])]
    const d = new Date(0)
    d.setFullYear(y, m, day)
    d.setHours(0, 0, 0, 0)
    // Reject a rollover ('2026-02-30' is not March 2nd), as `new Date` does.
    return d.getMonth() === m && d.getDate() === day ? d : null
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Cache of `Intl.DateTimeFormat` by `(locale, options)` signature. */
const dateFormatterCache = new Map<string, Intl.DateTimeFormat>()
/** A cached `Intl.DateTimeFormat` for the locale and options given. Cached because
 *  constructing one per cell is the dominant cost when formatting a date column. */
export function getDateFormatter(
  locales: string | readonly string[] | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key =
    (Array.isArray(locales) ? locales.join(',') : locales ?? '') +
    '|' +
    (options.dateStyle ?? '') +
    '|' +
    (options.timeStyle ?? '') +
    '|' +
    (options.year ?? '') +
    '|' +
    (options.month ?? '') +
    '|' +
    (options.day ?? '') +
    '|' +
    (options.hour ?? '') +
    '|' +
    (options.minute ?? '') +
    '|' +
    (options.second ?? '') +
    '|' +
    (options.weekday ?? '') +
    '|' +
    (options.hour12 ?? '')
  let fmt = dateFormatterCache.get(key)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locales as string | string[] | undefined, options)
    dateFormatterCache.set(key, fmt)
  }
  return fmt
}

/** Format a numeric value for number / currency / percent column formats. */
export function formatNumericWithConfig(value: unknown, config: NumericFormatInput): string {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return String(value ?? '')

  const locales = config.locales

  if (config.type === 'currency') {
    return getNumberFormatter(locales, {
      style: 'currency',
      currency: config.currency ?? 'USD',
      ...config.options,
    }).format(n)
  }

  if (config.type === 'percent') {
    const frac = config.valueIsPercentPoints === true ? n / 100 : n
    return getNumberFormatter(locales, {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
      ...config.options,
    }).format(frac)
  }

  return getNumberFormatter(locales, config.options ?? {}).format(n)
}
