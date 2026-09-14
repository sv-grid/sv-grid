/**
 * Excel number-format strings, compiled once and applied many times.
 *
 * The grammar is small but full of traps, so this file is explicit about the
 * ones that bite:
 *
 *   - A pattern has up to four sections separated by `;`:
 *     positive;negative;zero;text. With two, the second covers negatives AND
 *     zero. With one, it covers everything. A negative rendered by section two
 *     uses its ABSOLUTE value, which is why `0.00;(0.00)` shows `(1.50)` and
 *     not `(-1.50)`.
 *   - `,` means two different things. Between placeholders it is a thousands
 *     separator; immediately before the decimal point (or at the end) it scales
 *     the number down by a thousand per comma.
 *   - `%` scales UP by 100 and prints a literal percent.
 *   - `0` prints a digit or a zero, `#` prints a digit or nothing, `?` prints a
 *     digit or a space. They can be mixed: `#,##0.0#` keeps one decimal always
 *     and a second only when it is there.
 *   - Anything in quotes, after a backslash, or in the set of always-literal
 *     characters is emitted as-is.
 *   - `[Red]` and friends set a colour rather than printing.
 *   - `@` is the text placeholder and only appears in the fourth section.
 *
 * Dates are detected rather than configured: a pattern containing date tokens
 * outside quotes is a date pattern. `m` is minutes when it follows an hour
 * token and months otherwise, which is the one piece of context the token
 * scanner has to carry.
 */

export type CompiledFormat = {
  /** Render a value. `color` is set when the matching section named one. */
  format(value: unknown): { text: string; color?: string }
  /** The pattern this was compiled from, for round-tripping to xlsx. */
  readonly pattern: string
}

const COLORS: Record<string, string> = {
  BLACK: '#000000', BLUE: '#0000ff', CYAN: '#00ffff', GREEN: '#008000',
  MAGENTA: '#ff00ff', RED: '#ff0000', WHITE: '#ffffff', YELLOW: '#ffff00',
}

/** Split on `;` at the top level, ignoring separators inside quotes, brackets
 *  or escapes. A naive `pattern.split(';')` breaks `"a;b"` and `[<100]`. */
function splitSections(pattern: string): string[] {
  const out: string[] = []
  let current = ''
  let inQuote = false
  let inBracket = false
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i]!
    if (ch === '\\') {
      current += ch + (pattern[i + 1] ?? '')
      i += 1
      continue
    }
    if (ch === '"') { inQuote = !inQuote; current += ch; continue }
    if (!inQuote && ch === '[') { inBracket = true; current += ch; continue }
    if (!inQuote && ch === ']') { inBracket = false; current += ch; continue }
    if (ch === ';' && !inQuote && !inBracket) { out.push(current); current = ''; continue }
    current += ch
  }
  out.push(current)
  return out
}

type Section = {
  raw: string
  color?: string
  /** Pattern with the colour and other bracket directives removed. */
  body: string
}

function parseSection(raw: string): Section {
  let color: string | undefined
  let body = ''
  // Walk rather than regex-replace: a pattern like `"[" @ "]"` has brackets
  // INSIDE quoted literals, and a global /\[[^\]]*\]/ happily eats the text
  // between them.
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]!
    if (ch === '\\') { body += ch + (raw[i + 1] ?? ''); i += 1; continue }
    if (ch === '"') {
      const end = raw.indexOf('"', i + 1)
      const stop = end < 0 ? raw.length : end
      body += raw.slice(i, stop + 1)
      i = stop
      continue
    }
    if (ch === '[') {
      const end = raw.indexOf(']', i + 1)
      if (end < 0) { body += ch; continue }
      const inner = raw.slice(i + 1, end).trim().toUpperCase()
      const named = COLORS[inner]
      if (named) color = named
      // Anything else (a condition like [<100]) is unsupported: drop it rather
      // than print it.
      i = end
      continue
    }
    body += ch
  }
  return { raw, color, body }
}

const DATE_TOKEN = /^(yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|AM\/PM|am\/pm|A\/P)/

/** Does this section describe a date? Scans outside quotes and escapes. */
function looksLikeDate(body: string): boolean {
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]!
    if (ch === '\\') { i += 1; continue }
    if (ch === '"') {
      const end = body.indexOf('"', i + 1)
      i = end < 0 ? body.length : end
      continue
    }
    if (DATE_TOKEN.test(body.slice(i))) {
      // `m` alone is ambiguous with the thousands/number grammar only in
      // theory: a numeric pattern never contains a bare letter outside quotes.
      return true
    }
  }
  return false
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const pad2 = (n: number) => String(n).padStart(2, '0')

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (typeof value === 'number') {
    // Excel serial day, with the usual 1899-12-30 epoch. That is correct for
    // every date from 1900-03-01 on, which is every date anyone stores. Excel
    // itself is a day out below serial 61 because it counts a 1900-02-29 that
    // never existed; matching that bug exactly would break real dates.
    return new Date(Date.UTC(1899, 11, 30) + value * 86400000)
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

function renderDate(body: string, date: Date): string {
  let out = ''
  let sawHour = false
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]!
    if (ch === '\\') { out += body[i + 1] ?? ''; i += 1; continue }
    if (ch === '"') {
      const end = body.indexOf('"', i + 1)
      out += body.slice(i + 1, end < 0 ? body.length : end)
      i = end < 0 ? body.length : end
      continue
    }
    const m = DATE_TOKEN.exec(body.slice(i))
    if (!m) { out += ch; continue }
    const token = m[1]!
    i += token.length - 1
    switch (token) {
      case 'yyyy': out += date.getUTCFullYear(); break
      case 'yy': out += pad2(date.getUTCFullYear() % 100); break
      case 'mmmm': out += MONTHS[date.getUTCMonth()]; break
      case 'mmm': out += MONTHS[date.getUTCMonth()]!.slice(0, 3); break
      case 'dddd': out += DAYS[date.getUTCDay()]; break
      case 'ddd': out += DAYS[date.getUTCDay()]!.slice(0, 3); break
      case 'dd': out += pad2(date.getUTCDate()); break
      case 'd': out += date.getUTCDate(); break
      case 'hh': out += pad2(date.getUTCHours()); sawHour = true; break
      case 'h': out += date.getUTCHours(); sawHour = true; break
      case 'ss': out += pad2(date.getUTCSeconds()); break
      case 's': out += date.getUTCSeconds(); break
      case 'AM/PM': case 'am/pm': case 'A/P':
        out += date.getUTCHours() < 12 ? 'AM' : 'PM'
        break
      // `m` and `mm` are MINUTES after an hour token, MONTHS otherwise. This
      // is the one piece of context the scanner carries, and getting it wrong
      // turns 09:05 into 09:09.
      case 'mm': out += sawHour ? pad2(date.getUTCMinutes()) : pad2(date.getUTCMonth() + 1); break
      case 'm': out += sawHour ? date.getUTCMinutes() : date.getUTCMonth() + 1; break
      default: out += token
    }
  }
  return out
}

type NumericPlan = {
  prefix: string
  suffix: string
  intPlaceholders: string
  fracPlaceholders: string
  expPlaceholders: string
  useGrouping: boolean
  scale: number
  percent: boolean
  scientific: boolean
}

/** Pull a numeric section apart into literal text and digit placeholders. */
function planNumeric(body: string): NumericPlan {
  let prefix = ''
  let suffix = ''
  let intPlaceholders = ''
  let fracPlaceholders = ''
  let useGrouping = false
  let percent = false
  let scientific = false
  let expPlaceholders = ''
  let scale = 1
  let seenPlaceholder = false
  let afterDecimal = false

  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]!

    if (ch === '\\') {
      const next = body[i + 1] ?? ''
      if (seenPlaceholder) suffix += next
      else prefix += next
      i += 1
      continue
    }
    if (ch === '"') {
      const end = body.indexOf('"', i + 1)
      const text = body.slice(i + 1, end < 0 ? body.length : end)
      if (seenPlaceholder) suffix += text
      else prefix += text
      i = end < 0 ? body.length : end
      continue
    }
    if (ch === '0' || ch === '#' || ch === '?') {
      seenPlaceholder = true
      // After an E+ the placeholders size the EXPONENT, not the mantissa.
      // Counting them as decimals turns 0.00E+00 into four decimal places.
      if (scientific) expPlaceholders += ch
      else if (afterDecimal) fracPlaceholders += ch
      else intPlaceholders += ch
      continue
    }
    if (ch === '.') { afterDecimal = true; seenPlaceholder = true; continue }
    if (ch === ',') {
      // A comma between placeholders groups; one trailing (before the decimal
      // point or at the end of the pattern) scales by a thousand.
      const rest = body.slice(i + 1)
      if (/^[0#?]/.test(rest)) useGrouping = true
      else scale *= 1000
      continue
    }
    if (ch === '%') { percent = true; if (seenPlaceholder) suffix += '%'; else prefix += '%'; continue }
    if ((ch === 'E' || ch === 'e') && /^[+-]/.test(body.slice(i + 1))) {
      scientific = true
      i += 1
      continue
    }
    if (seenPlaceholder) suffix += ch
    else prefix += ch
  }

  return {
    prefix, suffix, intPlaceholders, fracPlaceholders, expPlaceholders,
    useGrouping, scale, percent, scientific,
  }
}

function group(intText: string): string {
  return intText.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function renderNumeric(plan: NumericPlan, value: number): string {
  let n = value
  if (plan.percent) n *= 100
  if (plan.scale !== 1) n /= plan.scale

  if (plan.scientific) {
    const text = n.toExponential(plan.fracPlaceholders.length)
    // toExponential gives "1.23e+4"; Excel writes the exponent with at least
    // as many digits as the pattern asked for.
    const [mantissa = '', exponent = ''] = text.split('e')
    const sign = exponent.startsWith('-') ? '-' : '+'
    const digits = exponent.replace(/^[+-]/, '').padStart(plan.expPlaceholders.length || 1, '0')
    return `${plan.prefix}${mantissa}E${sign}${digits}${plan.suffix}`
  }

  const decimals = plan.fracPlaceholders.length
  const fixed = Math.abs(n).toFixed(decimals)
  const [rawInt = '0', rawFrac = ''] = fixed.split('.')

  // Pad the integer side out to the number of `0` placeholders, and drop a
  // leading zero entirely when the pattern is all `#`.
  const minInt = plan.intPlaceholders.split('').filter((c) => c === '0').length
  let intText = rawInt
  if (intText.length < minInt) intText = intText.padStart(minInt, '0')
  if (minInt === 0 && intText === '0' && plan.intPlaceholders.length > 0) intText = ''
  if (plan.useGrouping && intText !== '') intText = group(intText)

  // Trim optional decimals from the right: `0.0#` on 1.5 gives "1.5", not
  // "1.50". A `0` placeholder is never trimmed, a `#` always may be, and a
  // `?` becomes a space so columns line up.
  let fracText = rawFrac
  for (let i = plan.fracPlaceholders.length - 1; i >= 0; i -= 1) {
    const kind = plan.fracPlaceholders[i]!
    if (kind === '0') break
    if (fracText[i] !== '0') break
    fracText = kind === '?' ? `${fracText.slice(0, i)} ` : fracText.slice(0, i)
  }

  const body = fracText === '' ? intText : `${intText}.${fracText}`
  // `#` on zero prints nothing, which is how "hide zeros" patterns work. The
  // fallback below is only for a pattern with no digit placeholders at all.
  return plan.prefix + body + plan.suffix
}

/** A section with no digit placeholders is pure literal text: `"-"` as the
 *  zero section must print `-`, not `-0`. */
function hasPlaceholders(plan: NumericPlan): boolean {
  return plan.intPlaceholders !== '' || plan.fracPlaceholders !== ''
}

/** Excel's General: up to 11 significant digits, no trailing zeros. */
function general(value: unknown): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value)
    if (Number.isInteger(value)) return String(value)
    return String(Number(value.toPrecision(11)))
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return value === null || value === undefined ? '' : String(value)
}

/**
 * Compile a format string. Compilation is cached per pattern, so a column of
 * ten thousand cells sharing one format parses it once.
 */
const cache = new Map<string, CompiledFormat>()

export function compileNumberFormat(pattern: string): CompiledFormat {
  const hit = cache.get(pattern)
  if (hit) return hit

  const sections = splitSections(pattern).map(parseSection)
  const positive = sections[0]
  const negative = sections[1]
  const zero = sections[2]
  const text = sections[3]

  // Plans are built once here, not per value.
  const plans = new Map<Section, NumericPlan>()
  const dateFlags = new Map<Section, boolean>()
  for (const s of sections) {
    if (!s) continue
    const isDate = looksLikeDate(s.body)
    dateFlags.set(s, isDate)
    if (!isDate) plans.set(s, planNumeric(s.body))
  }

  const compiled: CompiledFormat = {
    pattern,
    format(value) {
      if (pattern.trim() === '' || pattern.toUpperCase() === 'GENERAL') {
        return { text: general(value) }
      }

      if (typeof value === 'string' && value !== '') {
        const section = text ?? positive
        if (!section) return { text: value }
        // The text section substitutes @ for the value; without an @ the
        // section's literal text is all you get.
        const body = section.body.includes('@')
          ? section.body.replace(/@/g, value).replace(/"/g, '')
          : value
        return { text: body, color: section.color }
      }

      if (value === null || value === undefined || value === '') return { text: '' }
      if (typeof value === 'boolean') return { text: value ? 'TRUE' : 'FALSE' }

      const n = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(n)) {
        const d = toDate(value)
        if (d && positive && dateFlags.get(positive)) {
          return { text: renderDate(positive.body, d), color: positive.color }
        }
        return { text: String(value) }
      }

      // Pick the section. Two sections means the second covers zero too.
      let section = positive
      if (n < 0 && negative) section = negative
      else if (n === 0 && zero) section = zero
      if (!section) return { text: general(value) }

      if (dateFlags.get(section)) {
        const d = toDate(value)
        return d
          ? { text: renderDate(section.body, d), color: section.color }
          : { text: general(value) }
      }

      const plan = plans.get(section)!
      if (!hasPlaceholders(plan)) {
        return { text: plan.prefix + plan.suffix, color: section.color }
      }
      // A negative shown by its own section renders its ABSOLUTE value: the
      // section supplies the sign, usually as parentheses or a literal minus.
      const usingNegativeSection = n < 0 && section === negative
      const magnitude = usingNegativeSection ? Math.abs(n) : n
      let out = renderNumeric(plan, magnitude)
      // With no negative section, put the sign back on.
      if (n < 0 && !usingNegativeSection && !out.startsWith('-')) out = `-${out}`
      return { text: out, color: section.color }
    },
  }

  cache.set(pattern, compiled)
  return compiled
}

/** Format one value against a pattern. Convenience over compile-then-call. */
export function formatWithPattern(value: unknown, pattern: string): string {
  return compileNumberFormat(pattern).format(value).text
}

/** The presets behind Ctrl+Shift+1 through 6. */
export const FORMAT_PRESETS = {
  general: 'General',
  number: '#,##0.00',
  time: 'h:mm AM/PM',
  date: 'yyyy-mm-dd',
  currency: '$#,##0.00;($#,##0.00)',
  percent: '0.00%',
  scientific: '0.00E+00',
} as const

export type FormatPresetName = keyof typeof FORMAT_PRESETS
