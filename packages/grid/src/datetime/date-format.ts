/**
 * date-format - a small .NET/Smart-style date format-token engine used for
 * `formatString` display and for parsing the masked DateTimePicker input. It is
 * locale-aware for names (month/weekday, AM/PM) via `Intl`, and framework-free.
 *
 * Supported tokens (case-sensitive, matching Smart's `formatString`):
 *   d    dd            day of month           (5, 05)
 *   ddd  dddd          weekday name           (Mon, Monday)  [locale]
 *   M    MM            month number           (6, 06)
 *   MMM  MMMM          month name             (Jun, June)    [locale]
 *   yy   yyyy          year                   (26, 2026)
 *   H    HH            hour 24                 (7, 07)
 *   h    hh            hour 12                 (7, 07)
 *   m    mm            minute
 *   s    ss            second
 *   f    ff   fff      fractional seconds      (tenths..millis)
 *   t    tt            AM/PM designator        (A, AM)        [locale]
 *
 * Anything else is a literal. Wrap literal letters in single quotes ('T') or
 * escape with a backslash (\T) to keep them out of token matching.
 */

/** Ordered longest-first so the scanner is greedy and unambiguous. */
const TOKENS = [
  'dddd', 'ddd', 'dd', 'd',
  'MMMM', 'MMM', 'MM', 'M',
  'yyyy', 'yy',
  'HH', 'H',
  'hh', 'h',
  'mm', 'm',
  'ss', 's',
  'fff', 'ff', 'f',
  'tt', 't',
] as const

type Part = { token: string } | { literal: string }

/** Split a mask into an ordered list of token / literal parts. */
export function tokenizeMask(mask: string): Part[] {
  const parts: Part[] = []
  let i = 0
  while (i < mask.length) {
    const ch = mask[i]!
    // Backslash escape: next char is a literal.
    if (ch === '\\' && i + 1 < mask.length) {
      parts.push({ literal: mask[i + 1]! })
      i += 2
      continue
    }
    // Single-quoted literal run.
    if (ch === "'") {
      let j = i + 1
      let lit = ''
      while (j < mask.length && mask[j] !== "'") {
        lit += mask[j]
        j++
      }
      parts.push({ literal: lit })
      i = j + 1 // skip closing quote (or run to end)
      continue
    }
    // Greedy longest-token match.
    let matched: string | null = null
    for (const t of TOKENS) {
      if (mask.startsWith(t, i)) {
        matched = t
        break
      }
    }
    if (matched) {
      parts.push({ token: matched })
      i += matched.length
    } else {
      parts.push({ literal: ch })
      i += 1
    }
  }
  return parts
}

const pad = (n: number, len: number) => String(Math.abs(n)).padStart(len, '0')

// Intl name caches keyed by locale.
const monthCache = new Map<string, { long: string[]; short: string[] }>()
const weekdayCache = new Map<string, { long: string[]; short: string[] }>()
const dayperiodCache = new Map<string, { am: string; pm: string }>()

function monthNames(locale: string) {
  let c = monthCache.get(locale)
  if (!c) {
    const long = new Intl.DateTimeFormat(locale, { month: 'long' })
    const short = new Intl.DateTimeFormat(locale, { month: 'short' })
    c = {
      long: Array.from({ length: 12 }, (_, m) => long.format(new Date(2021, m, 1))),
      short: Array.from({ length: 12 }, (_, m) => short.format(new Date(2021, m, 1))),
    }
    monthCache.set(locale, c)
  }
  return c
}

function weekdayNames(locale: string) {
  let c = weekdayCache.get(locale)
  if (!c) {
    const long = new Intl.DateTimeFormat(locale, { weekday: 'long' })
    const short = new Intl.DateTimeFormat(locale, { weekday: 'short' })
    // 2021-08-01 is a Sunday.
    c = {
      long: Array.from({ length: 7 }, (_, d) => long.format(new Date(2021, 7, 1 + d))),
      short: Array.from({ length: 7 }, (_, d) => short.format(new Date(2021, 7, 1 + d))),
    }
    weekdayCache.set(locale, c)
  }
  return c
}

function dayPeriods(locale: string) {
  let c = dayperiodCache.get(locale)
  if (!c) {
    const f = new Intl.DateTimeFormat(locale, { hour: 'numeric', hour12: true })
    const am = f.formatToParts(new Date(2021, 0, 1, 9)).find((p) => p.type === 'dayPeriod')?.value ?? 'AM'
    const pm = f.formatToParts(new Date(2021, 0, 1, 21)).find((p) => p.type === 'dayPeriod')?.value ?? 'PM'
    c = { am, pm }
    dayperiodCache.set(locale, c)
  }
  return c
}

/** Render `date` per `mask` in `locale`. */
export function formatDate(date: Date, mask: string, locale = 'en-US'): string {
  const parts = tokenizeMask(mask)
  const h24 = date.getHours()
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const ms = date.getMilliseconds()
  let out = ''
  for (const p of parts) {
    if ('literal' in p) {
      out += p.literal
      continue
    }
    switch (p.token) {
      case 'd': out += String(date.getDate()); break
      case 'dd': out += pad(date.getDate(), 2); break
      case 'ddd': out += weekdayNames(locale).short[date.getDay()]; break
      case 'dddd': out += weekdayNames(locale).long[date.getDay()]; break
      case 'M': out += String(date.getMonth() + 1); break
      case 'MM': out += pad(date.getMonth() + 1, 2); break
      case 'MMM': out += monthNames(locale).short[date.getMonth()]; break
      case 'MMMM': out += monthNames(locale).long[date.getMonth()]; break
      case 'yy': out += pad(date.getFullYear() % 100, 2); break
      case 'yyyy': out += pad(date.getFullYear(), 4); break
      case 'H': out += String(h24); break
      case 'HH': out += pad(h24, 2); break
      case 'h': out += String(h12); break
      case 'hh': out += pad(h12, 2); break
      case 'm': out += String(date.getMinutes()); break
      case 'mm': out += pad(date.getMinutes(), 2); break
      case 's': out += String(date.getSeconds()); break
      case 'ss': out += pad(date.getSeconds(), 2); break
      case 'f': out += pad(ms, 3).slice(0, 1); break
      case 'ff': out += pad(ms, 3).slice(0, 2); break
      case 'fff': out += pad(ms, 3); break
      case 't': out += (h24 < 12 ? dayPeriods(locale).am : dayPeriods(locale).pm).slice(0, 1); break
      case 'tt': out += h24 < 12 ? dayPeriods(locale).am : dayPeriods(locale).pm; break
      default: out += p.token
    }
  }
  return out
}

type Acc = {
  year?: number
  month?: number // 0-11
  day?: number
  hour?: number // 24h accumulator
  hour12?: number
  minute?: number
  second?: number
  ms?: number
  pm?: boolean
  isPm?: boolean
}

const MAX_DIGITS: Record<string, number> = {
  d: 2, dd: 2, M: 2, MM: 2, yy: 2, yyyy: 4,
  H: 2, HH: 2, h: 2, hh: 2, m: 2, mm: 2, s: 2, ss: 2, f: 1, ff: 2, fff: 3,
}

function readDigits(str: string, at: number, max: number): { value: number; len: number } | null {
  let len = 0
  while (len < max && at + len < str.length && str[at + len]! >= '0' && str[at + len]! <= '9') len++
  if (len === 0) return null
  return { value: parseInt(str.slice(at, at + len), 10), len }
}

function matchName(str: string, at: number, names: string[]): { index: number; len: number } | null {
  // Longest-first so 'June' wins over a hypothetical 'Jun' prefix collision.
  const ordered = names
    .map((name, index) => ({ name, index }))
    .sort((a, b) => b.name.length - a.name.length)
  const lower = str.slice(at).toLowerCase()
  for (const { name, index } of ordered) {
    if (name && lower.startsWith(name.toLowerCase())) return { index, len: name.length }
  }
  return null
}

/**
 * Parse `str` against `mask` in `locale`. Returns a Date or null if the string
 * does not satisfy the mask. `yearCutoff` disambiguates 2-digit years: values
 * <= (yearCutoff % 100) map to 2000s, above to 1900s (Smart's default 1926 ->
 * a 26 pivot). `base` supplies fields the mask omits (defaults to epoch-zero
 * local midnight so a time-only mask yields a today-agnostic time).
 */
export function parseDate(
  str: string,
  mask: string,
  locale = 'en-US',
  yearCutoff = 2029,
  base?: Date,
): Date | null {
  const parts = tokenizeMask(mask)
  const acc: Acc = {}
  let i = 0
  const s = str
  for (const p of parts) {
    if ('literal' in p) {
      // Literals must match (whitespace-insensitive at the boundary).
      for (const ch of p.literal) {
        if (ch === ' ') {
          while (s[i] === ' ') i++
          continue
        }
        if (s[i] !== ch) return null
        i++
      }
      continue
    }
    const tok = p.token
    switch (tok) {
      case 'ddd':
      case 'dddd': {
        const m = matchName(s, i, weekdayNames(locale)[tok === 'ddd' ? 'short' : 'long'])
        if (!m) return null
        i += m.len // weekday is informational; day-of-month drives the date
        break
      }
      case 'MMM':
      case 'MMMM': {
        const m = matchName(s, i, monthNames(locale)[tok === 'MMM' ? 'short' : 'long'])
        if (!m) return null
        acc.month = m.index
        i += m.len
        break
      }
      case 't':
      case 'tt': {
        const dp = dayPeriods(locale)
        const lower = s.slice(i).toLowerCase()
        if (lower.startsWith(dp.pm.toLowerCase())) { acc.isPm = true; i += dp.pm.length }
        else if (lower.startsWith(dp.am.toLowerCase())) { acc.isPm = false; i += dp.am.length }
        else if (lower.startsWith(dp.pm.slice(0, 1).toLowerCase())) { acc.isPm = true; i += 1 }
        else if (lower.startsWith(dp.am.slice(0, 1).toLowerCase())) { acc.isPm = false; i += 1 }
        else return null
        break
      }
      default: {
        const r = readDigits(s, i, MAX_DIGITS[tok] ?? 2)
        if (!r) return null
        i += r.len
        const v = r.value
        switch (tok) {
          case 'd': case 'dd': acc.day = v; break
          case 'M': case 'MM': acc.month = v - 1; break
          case 'yy': acc.year = v <= yearCutoff % 100 ? 2000 + v : 1900 + v; break
          case 'yyyy': acc.year = v; break
          case 'H': case 'HH': acc.hour = v; break
          case 'h': case 'hh': acc.hour12 = v; break
          case 'm': case 'mm': acc.minute = v; break
          case 's': case 'ss': acc.second = v; break
          case 'f': acc.ms = v * 100; break
          case 'ff': acc.ms = v * 10; break
          case 'fff': acc.ms = v; break
        }
      }
    }
  }
  // Trailing input that the mask did not consume is a mismatch.
  if (i !== s.length && s.slice(i).trim() !== '') return null

  const b = base ?? new Date(1970, 0, 1)
  let hour = acc.hour
  if (hour == null && acc.hour12 != null) {
    hour = acc.hour12 % 12
    if (acc.isPm) hour += 12
  }
  const year = acc.year ?? b.getFullYear()
  const month = acc.month ?? b.getMonth()
  const day = acc.day ?? b.getDate()
  const result = new Date(
    year,
    month,
    day,
    hour ?? b.getHours(),
    acc.minute ?? b.getMinutes(),
    acc.second ?? b.getSeconds(),
    acc.ms ?? b.getMilliseconds(),
  )
  // Reject impossible dates the constructor silently rolls over (e.g. Feb 31).
  if (
    (acc.day != null && result.getDate() !== day) ||
    (acc.month != null && result.getMonth() !== month)
  ) {
    return null
  }
  return isNaN(result.getTime()) ? null : result
}
