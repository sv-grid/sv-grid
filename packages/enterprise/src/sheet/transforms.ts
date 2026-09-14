/**
 * Text to Columns and Remove Duplicates: the two one-shot transforms an Excel
 * user reaches for on arriving data, before any formula work starts.
 *
 * Both are pure functions over cell text rather than commands that reach into
 * a grid, because both are things a consumer may want to run from a button, a
 * menu, a paste handler or a test, and none of those want a keystroke.
 */

export type SplitOptions = {
  /**
   * Split on these strings. Excel's dialog offers tab, semicolon, comma, space
   * and "other"; passing several splits on any of them.
   */
  delimiters?: ReadonlyArray<string>
  /** Treat runs of delimiters as one. Excel's "treat consecutive delimiters as
   *  one" checkbox, and what you want for space-separated text. */
  collapse?: boolean
  /** Text inside these is not split, and the quotes come off. */
  quote?: string
  /** Trim surrounding whitespace from each field. */
  trim?: boolean
  /** Stop after this many fields, leaving the rest in the last one. Excel has
   *  no equivalent; it is here because "name: free text with: colons" is the
   *  common real case. */
  limit?: number
}

const DEFAULTS: Required<Omit<SplitOptions, 'limit'>> = {
  delimiters: [','],
  collapse: false,
  quote: '"',
  trim: false,
}

/**
 * Split one string into fields.
 *
 * A scan rather than `String.split`, because a quoted field may contain a
 * delimiter and a doubled quote is an escaped one. Splitting first and
 * repairing afterwards is how CSV parsers get subtly wrong.
 */
export function splitText(text: string, options: SplitOptions = {}): string[] {
  const { delimiters, collapse, quote, trim } = { ...DEFAULTS, ...options }
  const limit = options.limit
  // Longest first, so ", " wins over "," when both are offered.
  const seps = [...delimiters].filter((d) => d !== '').sort((a, b) => b.length - a.length)
  if (seps.length === 0) return [text]

  const out: string[] = []
  let current = ''
  let inQuote = false
  let i = 0

  const push = () => {
    out.push(trim ? current.trim() : current)
    current = ''
  }

  while (i < text.length) {
    const ch = text[i]!

    if (quote && ch === quote) {
      if (inQuote && text[i + 1] === quote) { current += quote; i += 2; continue }
      inQuote = !inQuote
      i += 1
      continue
    }

    if (!inQuote && (limit === undefined || out.length < limit - 1)) {
      const hit = seps.find((sep) => text.startsWith(sep, i))
      if (hit) {
        push()
        i += hit.length
        if (collapse) {
          // Swallow the run that follows, so "a   b" on a space delimiter
          // gives two fields rather than four.
          for (;;) {
            const more = seps.find((sep) => text.startsWith(sep, i))
            if (!more) break
            i += more.length
          }
        }
        continue
      }
    }

    current += ch
    i += 1
  }
  push()
  return out
}

/**
 * Split a column of text into a grid, padded so every row is the same width.
 *
 * Padding matters: writing a ragged result into a grid leaves whatever was
 * already in the cell, so a row that split into two fields would keep stale
 * text in the third column.
 */
export function textToColumns(
  column: ReadonlyArray<string>,
  options: SplitOptions = {},
): { rows: string[][]; width: number } {
  const rows = column.map((text) => splitText(text, options))
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  for (const row of rows) {
    while (row.length < width) row.push('')
  }
  return { rows, width }
}

/** Guess which delimiter a column uses, the way Excel's wizard previews one. */
export function guessDelimiter(
  column: ReadonlyArray<string>,
  candidates: ReadonlyArray<string> = ['\t', ';', ',', '|', ' '],
): string | null {
  let best: { sep: string; score: number } | null = null
  for (const sep of candidates) {
    // A good delimiter appears in most rows AND the same number of times in
    // each. A comma in one row out of fifty is prose, not structure.
    const counts = column.map((text) => text.split(sep).length - 1)
    const present = counts.filter((n) => n > 0).length
    if (present === 0) continue
    const first = counts.find((n) => n > 0) ?? 0
    const consistent = counts.every((n) => n === 0 || n === first)
    const score = present * (consistent ? 2 : 1)
    if (!best || score > best.score) best = { sep, score }
  }
  return best ? best.sep : null
}

export type DuplicateOptions = {
  /** Column indexes that decide identity. Default: every column given. */
  columns?: ReadonlyArray<number>
  /** Compare case-sensitively. Excel's Remove Duplicates is case
   *  INSENSITIVE, which surprises people, so that is the default here too. */
  matchCase?: boolean
  /** Keep the last of each group rather than the first. */
  keep?: 'first' | 'last'
}

export type DuplicateReport = {
  /** Indexes into the input, in order, of the rows to keep. */
  keep: number[]
  /** Indexes of the rows that duplicate another. */
  remove: number[]
}

/**
 * Which rows are duplicates.
 *
 * Reports rather than removes, so the caller decides what removal means for
 * its data structure, and so a UI can say "3 duplicates found, 5 unique values
 * remain" before anything is written. That message is most of what Excel's
 * dialog does.
 */
export function findDuplicates(
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
  options: DuplicateOptions = {},
): DuplicateReport {
  const keepWhich = options.keep ?? 'first'
  const matchCase = options.matchCase ?? false

  const keyOf = (row: ReadonlyArray<unknown>): string => {
    const cols = options.columns ?? row.map((_v, i) => i)
    return cols
      .map((c) => {
        const v = row[c]
        const text = v === null || v === undefined ? '' : String(v)
        return matchCase ? text : text.toLowerCase()
      })
      // A separator a cell cannot contain. Joining on a space would make
      // ["a", "b"] and ["a b"] the same row.
      .join('\u0000')
  }

  const seen = new Map<string, number>()
  for (let i = 0; i < rows.length; i += 1) {
    const key = keyOf(rows[i]!)
    if (!seen.has(key) || keepWhich === 'last') seen.set(key, i)
  }
  const kept = new Set(seen.values())

  const keep: number[] = []
  const remove: number[] = []
  for (let i = 0; i < rows.length; i += 1) {
    if (kept.has(i)) keep.push(i)
    else remove.push(i)
  }
  return { keep, remove }
}

/** The rows that survive, in their original order, and how many went. */
export function removeDuplicates<T>(
  rows: ReadonlyArray<T>,
  toCells: (row: T) => ReadonlyArray<unknown>,
  options: DuplicateOptions = {},
): { rows: T[]; removed: number } {
  const report = findDuplicates(rows.map(toCells), options)
  return {
    rows: report.keep.map((i) => rows[i]!),
    removed: report.remove.length,
  }
}
