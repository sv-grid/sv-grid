/**
 * What Excel makes of a typed entry before it is stored.
 *
 * `12%` is the number 0.12 shown as a percentage, `$1,200` is 1200 shown
 * as currency, `1,234.5` is 1234.5 with a thousands separator: the text
 * the user typed names both a value and how to show it, and the cell keeps
 * both, so `=A1*2` over a `12%` cell is 0.24 rather than `#VALUE!`. The
 * format is the one Excel would pick, with the decimals the user typed.
 * Anything else, formulas included, is stored as typed.
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

  return null
}
