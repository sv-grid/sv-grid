/**
 * How a locale spells a number, a date and a formula.
 *
 * The rule this module exists to enforce: **the workbook stores the
 * invariant spelling, always.** A formula in the document is
 * `=SUM(1.5, A1)` whatever the user's locale, and a number is `1234.5`.
 * The culture is a layer over the top, applied when a formula is shown for
 * editing and un-applied when one is typed.
 *
 * That is what Excel does, and it is the only arrangement where a file
 * written in Berlin opens in Boston. Storing `=SUMME(1,5;A1)` would make
 * the document's meaning depend on who saved it, and every reader, writer
 * and test would have to carry the locale to make sense of a cell.
 *
 * What a culture changes:
 *   - the decimal mark and the group mark, `1.234,5` against `1,234.5`
 *   - the argument separator, which Excel makes `;` wherever the decimal
 *     mark is `,`, since `,` is then busy
 *   - the order of a slash date, `31/12` against `12/31`
 *
 * What it does NOT change: function names, which stay English here, and
 * the spelling in the file, which stays invariant.
 */

export type SheetCulture = {
  /** The locale this was derived from, for the number formatter. */
  locale: string
  /** The decimal mark, `.` or `,`. */
  decimal: string
  /** The group mark, which may be a non-breaking space. */
  group: string
  /** What separates a function's arguments: `,`, or `;` where `,` is the
   *  decimal mark. */
  argSeparator: string
  /** How a slash date reads: day first, month first, or year first. */
  dateOrder: 'dmy' | 'mdy' | 'ymd'
}

/**
 * The space-like group marks, written by code point rather than as
 * literals so they are visible in the source.
 *
 * `fr-FR` formats with a narrow no-break space and `nb-NO` with a plain
 * no-break one; neither is on anybody's keyboard, so a typed plain space
 * has to mean the same thing.
 */
const NO_BREAK_SPACE = String.fromCharCode(0x00a0)
const NARROW_NO_BREAK_SPACE = String.fromCharCode(0x202f)
export const SPACE_GROUP_MARKS: ReadonlyArray<string> = [' ', NO_BREAK_SPACE, NARROW_NO_BREAK_SPACE]

/** The spelling the document itself uses, and the default. */
export const INVARIANT_CULTURE: SheetCulture = {
  locale: 'en-US',
  decimal: '.',
  group: ',',
  argSeparator: ',',
  dateOrder: 'mdy',
}

/**
 * The culture a locale implies, read off `Intl` rather than a table, so a
 * locale nobody thought of still comes out right.
 *
 * Falls back to the invariant culture where `Intl` is missing or the
 * locale is not one it knows, since a sheet that renders in the wrong
 * separators is better than one that does not render.
 */
export function cultureFromLocale(locale: string): SheetCulture {
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(12345.6)
    const decimal = parts.find((p) => p.type === 'decimal')?.value ?? '.'
    const group = parts.find((p) => p.type === 'group')?.value ?? ','
    const order = dateOrderOf(locale)
    return {
      locale,
      decimal,
      group,
      // Excel's rule, not a preference: where the decimal mark is a comma
      // the comma cannot also separate arguments.
      argSeparator: decimal === ',' ? ';' : ',',
      dateOrder: order,
    }
  } catch {
    return INVARIANT_CULTURE
  }
}

/** Which of day, month and year a locale writes first. */
function dateOrderOf(locale: string): SheetCulture['dateOrder'] {
  try {
    const parts = new Intl.DateTimeFormat(locale).formatToParts(new Date(Date.UTC(2026, 11, 31)))
    const order = parts.filter((p) => p.type === 'day' || p.type === 'month' || p.type === 'year')
      .map((p) => p.type[0]).join('')
    if (order.startsWith('y')) return 'ymd'
    if (order.startsWith('d')) return 'dmy'
    return 'mdy'
  } catch {
    return 'mdy'
  }
}

/** True where the culture spells everything the way the document does. */
export const isInvariant = (c: SheetCulture): boolean =>
  c.decimal === '.' && c.argSeparator === ','

/**
 * Walk a formula, handing each piece to `onNumber` and `onSeparator`.
 *
 * Shared by both directions so they cannot disagree about what counts as a
 * number. The three things that must survive untouched are a string
 * literal (`"a,b"`), a quoted sheet name (`'Q1,Q2'!A1`) and a function
 * name with a dot in it (`NORM.DIST`), which is why a word is consumed
 * whole before any punctuation is looked at.
 */
function scanFormula(
  text: string,
  decimal: string,
  separator: string,
  onNumber: (digits: string) => string,
  onSeparator: () => string,
): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i]!
    // A string literal, with Excel's doubled quote for an embedded one.
    if (ch === '"') {
      let j = i + 1
      while (j < text.length) {
        if (text[j] === '"') {
          if (text[j + 1] === '"') { j += 2; continue }
          j += 1
          break
        }
        j += 1
      }
      out += text.slice(i, j)
      i = j
      continue
    }
    // A quoted sheet name.
    if (ch === "'") {
      const end = text.indexOf("'", i + 1)
      const close = end < 0 ? text.length : end + 1
      out += text.slice(i, close)
      i = close
      continue
    }
    // A word: a function name, a defined name or a cell reference. Taken
    // whole so the dot in NORM.DIST is never read as a decimal mark.
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i
      while (j < text.length && /[A-Za-z0-9_.$]/.test(text[j]!)) j += 1
      out += text.slice(i, j)
      i = j
      continue
    }
    // A number, which is where the decimal mark lives.
    if (/[0-9]/.test(ch)) {
      let j = i
      while (j < text.length && /[0-9]/.test(text[j]!)) j += 1
      let digits = text.slice(i, j)
      // A decimal mark only counts with a digit after it, so `1,` in
      // `SUM(1,2)` stays a separator where the mark is a comma.
      if (text.startsWith(decimal, j) && /[0-9]/.test(text[j + decimal.length] ?? '')) {
        let k = j + decimal.length
        while (k < text.length && /[0-9]/.test(text[k]!)) k += 1
        digits = text.slice(i, k)
        j = k
      }
      // An exponent rides along so `1.5E-3` is one number.
      if (/[eE]/.test(text[j] ?? '') && /[0-9+-]/.test(text[j + 1] ?? '')) {
        let k = j + 1
        if (/[+-]/.test(text[k]!)) k += 1
        while (k < text.length && /[0-9]/.test(text[k]!)) k += 1
        digits = text.slice(i, k)
        j = k
      }
      out += onNumber(digits)
      i = j
      continue
    }
    if (separator !== '' && text.startsWith(separator, i)) {
      out += onSeparator()
      i += separator.length
      continue
    }
    out += ch
    i += 1
  }
  return out
}

/**
 * A stored formula as the user's locale spells it, for the formula bar.
 *
 * `=SUM(1.5, A1)` becomes `=SUM(1,5; A1)` in a German sheet.
 */
export function formulaToCulture(formula: string, culture: SheetCulture): string {
  if (isInvariant(culture)) return formula
  return scanFormula(
    formula,
    '.',
    ',',
    (digits) => digits.replace('.', culture.decimal),
    () => culture.argSeparator,
  )
}

/**
 * A typed formula back to the spelling the document stores.
 *
 * The inverse of `formulaToCulture`, with one deliberate kindness: where
 * the culture's separator is `;`, a `,` between arguments is taken as a
 * separator too, so a user with an English keyboard habit is not stopped.
 * A `,` that sits between digits is still the decimal mark, so nothing
 * ambiguous is guessed at.
 */
export function formulaFromCulture(formula: string, culture: SheetCulture): string {
  if (isInvariant(culture)) return formula
  return scanFormula(
    formula,
    culture.decimal,
    culture.argSeparator,
    (digits) => digits.replace(culture.decimal, '.'),
    () => ',',
  )
}

/**
 * A number as the culture writes it, back to a plain number.
 *
 * Returns null when the text is not a number in this culture, so the
 * caller can fall through to treating it as text. The group mark is
 * dropped wherever it appears rather than checked for position, as Excel
 * does: `1.2.3,4` is not worth refusing on a technicality.
 */
export function parseNumberInCulture(text: string, culture: SheetCulture): number | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const groups = culture.group === '' ? [] : [culture.group]
  // A non-breaking or thin space as a group mark also arrives as a plain
  // space when it is typed rather than pasted.
  if (/\s/.test(culture.group)) groups.push(...SPACE_GROUP_MARKS)
  let plain = trimmed
  for (const g of groups) plain = plain.split(g).join('')
  if (culture.decimal !== '.') plain = plain.split(culture.decimal).join('.')
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(plain)) return null
  const n = Number(plain)
  return Number.isFinite(n) ? n : null
}

/** A number as the culture writes it, for display. */
export function formatNumberInCulture(value: number, culture: SheetCulture): string {
  const plain = String(value)
  if (culture.decimal === '.') return plain
  return plain.replace('.', culture.decimal)
}

/**
 * The day, month and year a slash date names, in this culture's order.
 *
 * Returns null when the pieces cannot be a date, which is what tells a
 * slash date apart from a fraction typed without a whole part.
 */
export function slashDateParts(
  a: number,
  b: number,
  culture: SheetCulture,
): { month: number; day: number } | null {
  const [month, day] = culture.dateOrder === 'dmy' ? [b, a] : [a, b]
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { month, day }
}
