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
export type ParsedEntry = {
  /** The number, as text the workbook stores. */
  value: string
  /** The Excel format string the entry implies; none for a bare number
   *  read out of an accountant's parentheses, which Excel shows as General. */
  numFmt?: string
}

const zeros = (n: number): string => (n > 0 ? '.' + '0'.repeat(n) : '')

/** Digits with optional thousands separators and decimals, as a number. */
function numberOf(digits: string): number | null {
  const plain = digits.replace(/,/g, '')
  const n = Number(plain)
  return Number.isFinite(n) ? n : null
}

const decimalsOf = (digits: string): number => digits.split('.')[1]?.length ?? 0

/** Round away the binary noise of a division: 33.3% is 0.333, not 0.33299999. */
const trim = (n: number, places: number): string => String(Number(n.toFixed(places)))

const GROUPED = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?`
const PERCENT = new RegExp(String.raw`^(-?)(${GROUPED})\s?%$`)
const CURRENCY = new RegExp(String.raw`^(-?)\$\s?(${GROUPED})$`)
const CURRENCY_PAREN = new RegExp(String.raw`^\(\$\s?(${GROUPED})\)$`)
const THOUSANDS = new RegExp(String.raw`^(-?)(\d{1,3}(?:,\d{3})+(?:\.\d+)?)$`)
/** (5): a negative the way a statement writes one, which Excel reads as -5. */
const PAREN = new RegExp(String.raw`^\((${GROUPED})\)$`)
const SLASH_DATE = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/
const CLOCK = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])\.?[Mm]?\.?)?$/
const pad2 = (n: number): string => String(n).padStart(2, '0')

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

export function parseEntry(text: string): ParsedEntry | null {
  const t = text.trim()
  // An apostrophe says the rest is text, so nothing is read out of it and no
  // format is implied: '12% is the text 12%, not twelve percent.
  if (t === '' || t.startsWith('=') || t.startsWith("'")) return null

  let m = PERCENT.exec(t)
  if (m) {
    const n = numberOf(m[2]!)
    if (n === null) return null
    const places = decimalsOf(m[2]!)
    return { value: trim((m[1] ? -n : n) / 100, places + 2), numFmt: `0${zeros(places)}%` }
  }

  m = CURRENCY.exec(t)
  const paren = m ? null : CURRENCY_PAREN.exec(t)
  if (m || paren) {
    const digits = (m ? m[2] : paren![1])!
    const n = numberOf(digits)
    if (n === null) return null
    const negative = m ? m[1] === '-' : true
    const places = decimalsOf(digits) > 0 ? 2 : 0
    const body = `$#,##0${zeros(places)}`
    return { value: String(negative ? -n : n), numFmt: `${body};(${body})` }
  }

  m = THOUSANDS.exec(t)
  if (m) {
    const n = numberOf(m[2]!)
    if (n === null) return null
    const places = decimalsOf(m[2]!)
    return { value: String(m[1] ? -n : n), numFmt: `#,##0${zeros(places)}` }
  }

  m = PAREN.exec(t)
  if (m) {
    const n = numberOf(m[1]!)
    return n === null ? null : { value: String(-n) }
  }

  // A date typed the American way, as Excel reads one: 3/4/2026 is the
  // fourth of March, 3/4/26 too (00-29 are this century, 30-99 the last),
  // and 3/4 alone is this year's. Stored as the sheet's `yyyy-mm-dd` text,
  // which is what the date functions read and what the file writer turns
  // into a serial, under a date format so the ribbon says Date and a
  // formula over it inherits one.
  m = SLASH_DATE.exec(t)
  if (m) {
    const month = Number(m[1]), day = Number(m[2]), year = m[3]
    const y = year === undefined ? new Date().getFullYear() : year.length === 2 ? (Number(year) < 30 ? 2000 : 1900) + Number(year) : Number(year)
    if (month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(y, month, 0)).getUTCDate()) {
      return { value: `${y}-${pad2(month)}-${pad2(day)}`, numFmt: 'yyyy-mm-dd' }
    }
    return null
  }

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
