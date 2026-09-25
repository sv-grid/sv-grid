/**
 * What Excel makes of a typed entry before it is stored.
 *
 * `12%` is the number 0.12 shown as a percentage, `$1,200` is 1200 shown
 * as currency, `1,234.5` is 1234.5 with a thousands separator: the text
 * the user typed names both a value and how to show it, and the cell keeps
 * both, so `=A1*2` over a `12%` cell is 0.24 rather than `#VALUE!`. The
 * format is the one Excel would pick, with the decimals the user typed.
 * `3/4/2026` is the sheet's `2026-03-04` under a date format and `10:30`
 * is 0.4375 of a day under a time format, for the same reason. Anything
 * else, formulas included, is stored as typed.
 */
import { INVARIANT_CULTURE, isInvariant, parseNumberInCulture, slashDateParts, SPACE_GROUP_MARKS, type SheetCulture } from './culture'

export type ParsedEntry = {
  /** The number, as text the workbook stores. */
  value: string
  /** The Excel format string the entry implies; none for a bare number
   *  read out of an accountant's parentheses, which Excel shows as General. */
  numFmt?: string
}

const zeros = (n: number): string => (n > 0 ? '.' + '0'.repeat(n) : '')

/** For putting a separator that may be `.` or a space inside a pattern. */
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The patterns for one culture, built once per culture rather than per
 * keystroke. Only the two marks vary, so they key the cache.
 *
 * The format strings these produce stay invariant: an Excel number format
 * is always written with `.` and `,` whatever the locale shows, the same
 * way the stored value is.
 */
type Patterns = {
  culture: SheetCulture
  percent: RegExp
  currency: RegExp
  currencyParen: RegExp
  thousands: RegExp
  paren: RegExp
  slashDate: RegExp
}

const PATTERN_CACHE = new Map<string, Patterns>()

function patternsFor(culture: SheetCulture): Patterns {
  const key = `${culture.decimal}\u0000${culture.group}\u0000${culture.dateOrder}`
  const hit = PATTERN_CACHE.get(key)
  if (hit) return hit
  const d = escapeRe(culture.decimal)
  // A space-like group mark is accepted in any of its shapes, since a
  // narrow no-break space is what fr-FR formats with and a plain space is
  // what anyone types.
  const g = /\s/.test(culture.group) ? '[\\s\\u00a0\\u202f]' : escapeRe(culture.group)
  const grouped = String.raw`(?:\d{1,3}(?:${g}\d{3})+|\d+)(?:${d}\d+)?`
  const built: Patterns = {
    culture,
    percent: new RegExp(String.raw`^(-?)(${grouped})\s?%$`),
    currency: new RegExp(String.raw`^(-?)\$\s?(${grouped})$`),
    currencyParen: new RegExp(String.raw`^\(\$\s?(${grouped})\)$`),
    thousands: new RegExp(String.raw`^(-?)(\d{1,3}(?:${g}\d{3})+(?:${d}\d+)?)$`),
    /** (5): a negative the way a statement writes one, read as -5. */
    paren: new RegExp(String.raw`^\((${grouped})\)$`),
    slashDate: /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/,
  }
  PATTERN_CACHE.set(key, built)
  return built
}

/** Digits with optional group marks and decimals, as a number. */
function numberOf(digits: string, culture: SheetCulture): number | null {
  let plain = digits
  for (const g of [culture.group, ...SPACE_GROUP_MARKS]) {
    if (g !== '' && g !== culture.decimal) plain = plain.split(g).join('')
  }
  if (culture.decimal !== '.') plain = plain.split(culture.decimal).join('.')
  const n = Number(plain)
  return Number.isFinite(n) ? n : null
}

const decimalsOf = (digits: string, culture: SheetCulture): number =>
  digits.split(culture.decimal)[1]?.length ?? 0

/** Round away the binary noise of a division: 33.3% is 0.333, not 0.33299999. */
const trim = (n: number, places: number): string => String(Number(n.toFixed(places)))
// A fraction typed with a whole part, as Excel takes one: `3 1/2` is 3.5 and
// `0 1/2` is the way to enter a bare half without `1/2` becoming a date. The
// whole part is required - that space is what tells it apart from a date.
const FRACTION = /^(-?)(\d+)\s+(\d+)\/(\d+)$/
const CLOCK = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])\.?[Mm]?\.?)?$/
const pad2 = (n: number): string => String(n).padStart(2, '0')

/** English month names to a 1-12 number: `jan`/`january` alike. */
const MONTH_NUMBER: Record<string, number> = (() => {
  const full = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
  const out: Record<string, number> = {}
  full.forEach((name, i) => { out[name] = i + 1; out[name.slice(0, 3)] = i + 1 })
  out.sept = 9
  return out
})()
// A day and a month name in either order, with an optional year:
// 4-Mar-2026, 4 Mar 26, Mar 4, March 4, 2026. The separator is a space,
// a hyphen or (for the day-first form) a slash; a comma may follow the day.
const DAY_MONTH = /^(\d{1,2})[\s\-/]+([A-Za-z]{3,9})(?:,?[\s\-/]+(\d{2}|\d{4}))?$/
const MONTH_DAY = /^([A-Za-z]{3,9})[\s\-/]+(\d{1,2})(?:,?[\s\-/]+(\d{2}|\d{4}))?$/
const yearOf = (raw: string | undefined): number =>
  raw === undefined ? new Date().getFullYear() : raw.length === 2 ? (Number(raw) < 30 ? 2000 : 1900) + Number(raw) : Number(raw)

/**
 * Excel's AutoComplete for a column of text.
 *
 * As a cell is typed into, the entries in the same column that run without
 * a blank above and below it are the candidates; when exactly one distinct
 * text entry starts with what was typed, that entry is the completion, in
 * its own case ("jo" completes to "John Smith"). Two candidates that both
 * fit ("Apple", "Apricot" for "Ap") complete nothing until the typing tells
 * them apart. Numbers, formulas and booleans never complete, and a typed
 * text that already is an entry needs none.
 *
 * `entries` are the distinct text entries of the run, any order.
 */
export function completeEntry(typed: string, entries: Iterable<string>): string | null {
  if (typed === '' || typed.startsWith('=') || typed.includes('\n')) return null
  const lower = typed.toLowerCase()
  let found: string | null = null
  for (const entry of entries) {
    if (entry.length <= typed.length || !entry.toLowerCase().startsWith(lower)) continue
    if (found !== null && found !== entry) return null
    found = entry
  }
  return found
}

export function parseEntry(text: string, culture: SheetCulture = INVARIANT_CULTURE): ParsedEntry | null {
  const t = text.trim()
  // An apostrophe says the rest is text, so nothing is read out of it and no
  // format is implied: '12% is the text 12%, not twelve percent.
  if (t === '' || t.startsWith('=') || t.startsWith("'")) return null
  const p = patternsFor(culture)

  let m = p.percent.exec(t)
  if (m) {
    const n = numberOf(m[2]!, culture)
    if (n === null) return null
    const places = decimalsOf(m[2]!, culture)
    return { value: trim((m[1] ? -n : n) / 100, places + 2), numFmt: `0${zeros(places)}%` }
  }

  m = p.currency.exec(t)
  const paren = m ? null : p.currencyParen.exec(t)
  if (m || paren) {
    const digits = (m ? m[2] : paren![1])!
    const n = numberOf(digits, culture)
    if (n === null) return null
    const negative = m ? m[1] === '-' : true
    const places = decimalsOf(digits, culture) > 0 ? 2 : 0
    const body = `$#,##0${zeros(places)}`
    return { value: String(negative ? -n : n), numFmt: `${body};(${body})` }
  }

  m = p.thousands.exec(t)
  if (m) {
    const n = numberOf(m[2]!, culture)
    if (n === null) return null
    const places = decimalsOf(m[2]!, culture)
    return { value: String(m[1] ? -n : n), numFmt: `#,##0${zeros(places)}` }
  }

  m = p.paren.exec(t)
  if (m) {
    const n = numberOf(m[1]!, culture)
    return n === null ? null : { value: String(-n) }
  }

  // A plain number written the culture's way, with no format implied.
  //
  // The invariant culture never reaches here with anything to do, since
  // `1.5` is already what the document stores, and returning null lets the
  // caller keep the text exactly as typed. A culture that spells it `1,5`
  // does have something to do: the stored value has to be turned back into
  // the invariant spelling, or the engine reads a comma it cannot parse.
  if (!isInvariant(culture)) {
    const n = parseNumberInCulture(t, culture)
    if (n !== null) return { value: String(n) }
  }

  // A mixed fraction: 3 1/2 is 3.5, shown back as the fraction under Excel's
  // `# ?/?` format, so it adds up and =A1*2 over it is 7 rather than #VALUE!.
  // The whole part is required, which is what keeps 1/2 a date and 0 1/2 a
  // half. The format widens to the digits typed, so 3 11/16 keeps two.
  m = FRACTION.exec(t)
  if (m) {
    const den = Number(m[4]!)
    if (den === 0) return null
    const value = (m[1] ? -1 : 1) * (Number(m[2]!) + Number(m[3]!) / den)
    return { value: trim(value, 10), numFmt: `# ${'?'.repeat(m[3]!.length)}/${'?'.repeat(m[4]!.length)}` }
  }

  // A slash date, in the order the culture writes one: 3/4/2026 is the
  // fourth of March where the locale puts the month first and the third of
  // April where it puts the day first. A two-digit year 00-29 is this
  // century, 30-99 the last. Stored as the sheet's `yyyy-mm-dd` text,
  // which is what the date functions read and what the file writer turns
  // into a serial, under a date format so the ribbon says Date and a
  // formula over it inherits one.
  m = p.slashDate.exec(t)
  if (m) {
    const parts = slashDateParts(Number(m[1]), Number(m[2]), culture)
    if (!parts) return null
    const y = yearOf(m[3])
    const { month, day } = parts
    if (day <= new Date(Date.UTC(y, month, 0)).getUTCDate()) {
      return { value: `${y}-${pad2(month)}-${pad2(day)}`, numFmt: 'yyyy-mm-dd' }
    }
    return null
  }

  // A date written with the month spelled out, as Excel reads one:
  // 4-Mar-2026, 4 Mar 26, March 4, 2026, Mar 4. English month names only,
  // the language the shell speaks; stored the same yyyy-mm-dd as a slash
  // date. Either order, so both 4-Mar and Mar-4 are the fourth of March.
  const monthDate = (dayText: string, monthName: string, yearText: string | undefined): ParsedEntry | null => {
    const month = MONTH_NUMBER[monthName.toLowerCase()]
    if (month === undefined) return null
    const day = Number(dayText)
    const y = yearOf(yearText)
    if (day < 1 || day > new Date(Date.UTC(y, month, 0)).getUTCDate()) return null
    return { value: `${y}-${pad2(month)}-${pad2(day)}`, numFmt: 'd-mmm-yyyy' }
  }
  m = DAY_MONTH.exec(t)
  if (m) return monthDate(m[1]!, m[2]!, m[3])
  m = MONTH_DAY.exec(t)
  if (m) return monthDate(m[2]!, m[1]!, m[3])

  // A clock time is the fraction of the day it is, 10:30 being 0.4375, under
  // the time format that shows it back, so times add up and =A1*2 over one
  // is 21:00 rather than #VALUE!. 10:30 PM is the same fraction past noon.
  m = CLOCK.exec(t)
  if (m) {
    let hours = Number(m[1])
    const minutes = Number(m[2]), seconds = Number(m[3] ?? 0)
    const meridiem = m[4]?.toLowerCase()
    if (meridiem) {
      if (hours < 1 || hours > 12) return null
      hours = (hours % 12) + (meridiem === 'p' ? 12 : 0)
    }
    if (hours > 23 || minutes > 59 || seconds > 59) return null
    const fraction = (hours * 3600 + minutes * 60 + seconds) / 86400
    return { value: String(Number(fraction.toFixed(10))), numFmt: `h:mm${m[3] ? ':ss' : ''}${meridiem ? ' AM/PM' : ''}` }
  }

  return null
}
