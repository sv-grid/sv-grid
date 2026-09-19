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

type ConditionOp = '<' | '<=' | '>' | '>=' | '=' | '<>'

type Section = {
  raw: string
  color?: string
  /** `[<=9999999]`: the section applies only to values that pass. */
  condition?: { op: ConditionOp; value: number }
  /** Pattern with the colour and other bracket directives removed. */
  body: string
}

const CONDITION = /^(<=|>=|<>|<|>|=)\s*(-?\d+(?:\.\d+)?)$/

function passes(condition: { op: ConditionOp; value: number }, n: number): boolean {
  switch (condition.op) {
    case '<': return n < condition.value
    case '<=': return n <= condition.value
    case '>': return n > condition.value
    case '>=': return n >= condition.value
    case '=': return n === condition.value
    case '<>': return n !== condition.value
  }
}

function parseSection(raw: string): Section {
  let color: string | undefined
  let condition: Section['condition']
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
      // An elapsed-time token is part of the pattern rather than a
      // directive about it, so it stays in the body for the renderer.
      if (ELAPSED_TOKEN.test(raw.slice(i))) { body += raw.slice(i, end + 1); i = end; continue }
      const named = COLORS[inner]
      if (named) color = named
      const cond = CONDITION.exec(inner)
      if (cond) condition = { op: cond[1] as ConditionOp, value: Number(cond[2]) }
      // Anything else ([$-409] locale tags and the like) is dropped rather
      // than printed.
      i = end
      continue
    }
    body += ch
  }
  return condition ? { raw, color, condition, body } : { raw, color, body }
}

const DATE_TOKEN = /^(yyyy|yy|mmmmm|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|AM\/PM|am\/pm|A\/P|a\/p)/
/**
 * Excel's elapsed-time tokens: the hours, minutes or seconds a duration
 * holds in TOTAL rather than the clock's reading of it, which is what a
 * timesheet needs. `[h]:mm` over 1.5 days is 36:00, not 12:00. Only h, m
 * and s go in these brackets, so a colour (`[Red]`) or a condition
 * (`[>100]`) never matches.
 */
const ELAPSED_TOKEN = /^\[(hh?|mm?|ss?)\]/

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
    if (ELAPSED_TOKEN.test(body.slice(i))) return true
    if (ch === '[') {
      // Any other bracket is a colour or a condition, and says nothing
      // about whether this is a date.
      const end = body.indexOf(']', i + 1)
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

/** The meridiem token a pattern carries, which puts `h` on a 12-hour clock. */
function meridiemOf(body: string): 'AM/PM' | 'am/pm' | 'A/P' | 'a/p' | null {
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] === '\\') { i += 1; continue }
    if (body[i] === '"') { const end = body.indexOf('"', i + 1); i = end < 0 ? body.length : end; continue }
    const m = /^(AM\/PM|am\/pm|A\/P|a\/p)/.exec(body.slice(i))
    if (m) return m[1] as 'AM/PM'
  }
  return null
}

/**
 * The finest unit a time pattern shows, in milliseconds, or null for a
 * pattern that shows no time. Excel ROUNDS to it: 23:59:40 under `hh:mm`
 * reads 00:00, and the date rolls with it where the pattern shows one.
 */
function finestUnit(body: string): number | null {
  let unit: number | null = null
  let sawHour = false
  const finer = (ms: number) => { unit = unit === null ? ms : Math.min(unit, ms) }
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] === '\\') { i += 1; continue }
    if (body[i] === '"') { const end = body.indexOf('"', i + 1); i = end < 0 ? body.length : end; continue }
    const fraction = /^\.(0+)/.exec(body.slice(i))
    if (fraction && unit !== null) { finer(Math.pow(10, 3 - fraction[1]!.length)); i += fraction[0].length - 1; continue }
    const m = DATE_TOKEN.exec(body.slice(i))
    if (!m) continue
    const token = m[1]!
    i += token.length - 1
    if (token === 'h' || token === 'hh') { sawHour = true; finer(3600000) }
    else if (token === 's' || token === 'ss') finer(1000)
    else if ((token === 'm' || token === 'mm') && sawHour) finer(60000)
  }
  return unit
}

function renderDate(body: string, date: Date, serial?: number): string {
  const unit = finestUnit(body)
  if (unit !== null && unit > 0) date = new Date(Math.round(date.getTime() / unit) * unit)
  const meridiem = meridiemOf(body)
  const hourOf = (d: Date) => (meridiem ? ((d.getUTCHours() + 11) % 12) + 1 : d.getUTCHours())
  let out = ''
  let sawHour = false
  let sawSecond = false
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]!
    if (ch === '\\') { out += body[i + 1] ?? ''; i += 1; continue }
    const elapsed = ELAPSED_TOKEN.exec(body.slice(i))
    if (elapsed) {
      const token = elapsed[1]!
      i += elapsed[0].length - 1
      // Without a serial there is no duration to total, so the clock's own
      // reading is the best answer; with one, the whole of it counts.
      const days = serial ?? 0
      const total = token.startsWith('h') ? days * 24 : token.startsWith('m') ? days * 1440 : days * 86400
      const whole = Math.floor(Math.abs(total) + 1e-9) * (total < 0 ? -1 : 1)
      out += token.length === 2 ? pad2(whole) : String(whole)
      if (token.startsWith('h')) sawHour = true
      continue
    }
    if (ch === '"') {
      const end = body.indexOf('"', i + 1)
      out += body.slice(i + 1, end < 0 ? body.length : end)
      i = end < 0 ? body.length : end
      continue
    }
    const fraction = sawSecond ? /^\.(0+)/.exec(body.slice(i)) : null
    if (fraction) {
      const digits = fraction[1]!.length
      out += `.${String(date.getUTCMilliseconds()).padStart(3, '0').slice(0, digits).padEnd(digits, '0')}`
      i += fraction[0].length - 1
      continue
    }
    const m = DATE_TOKEN.exec(body.slice(i))
    if (!m) { out += ch; continue }
    const token = m[1]!
    i += token.length - 1
    if (token === 's' || token === 'ss') sawSecond = true
    switch (token) {
      case 'yyyy': out += date.getUTCFullYear(); break
      case 'yy': out += pad2(date.getUTCFullYear() % 100); break
      case 'mmmm': out += MONTHS[date.getUTCMonth()]; break
      case 'mmm': out += MONTHS[date.getUTCMonth()]!.slice(0, 3); break
      case 'dddd': out += DAYS[date.getUTCDay()]; break
      case 'ddd': out += DAYS[date.getUTCDay()]!.slice(0, 3); break
      case 'dd': out += pad2(date.getUTCDate()); break
      case 'd': out += date.getUTCDate(); break
      case 'hh': out += pad2(hourOf(date)); sawHour = true; break
      case 'h': out += hourOf(date); sawHour = true; break
      case 'ss': out += pad2(date.getUTCSeconds()); break
      case 's': out += date.getUTCSeconds(); break
      // Excel prints what the token spells: AM/PM in full, A/P as the one
      // letter, and each in the case it was written in.
      case 'AM/PM': out += date.getUTCHours() < 12 ? 'AM' : 'PM'; break
      case 'am/pm': out += date.getUTCHours() < 12 ? 'am' : 'pm'; break
      case 'A/P': out += date.getUTCHours() < 12 ? 'A' : 'P'; break
      case 'a/p': out += date.getUTCHours() < 12 ? 'a' : 'p'; break
      case 'mmmmm': out += MONTHS[date.getUTCMonth()]!.slice(0, 1); break
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

/** One piece of the integer side of a pattern: a digit slot, or literal
 *  text sitting between digit slots, as the `-` in `000-00-0000`. */
type MaskToken = { kind: 'digit'; ch: '0' | '#' | '?' } | { kind: 'lit'; text: string }

type NumericPlan = {
  prefix: string
  suffix: string
  intPlaceholders: string
  /** The integer side in order, when literals sit between its digits; null
   *  when it is digits alone and the plain path applies. */
  intMask: MaskToken[] | null
  fracPlaceholders: string
  expPlaceholders: string
  useGrouping: boolean
  scale: number
  percent: boolean
  scientific: boolean
}


/**
 * Excel's fraction patterns: `# ?/?`, `# ??/??`, `?/?`, `# ?/8`.
 *
 * The placeholders count DIGITS rather than values, so `?/?` allows a
 * denominator up to 9 and `??/??` up to 99, and Excel shows the closest
 * fraction that fits. A literal denominator (`?/8`) is used as it stands,
 * which is how eighths of a dollar and sixteenths of an inch are written.
 * The integer part is optional: without one the whole value goes into the
 * numerator, so `?/?` over 1.25 reads 5/4.
 */
type FractionPlan = {
  /** Placeholders before the space, or null when there is no integer part. */
  int: string | null
  num: string
  den: string
  denLiteral: number | null
}

const FRACTION = /^(?:([#0?]+)\s+)?([#0?]+)\/([#0?]+|\d+)$/

/** The plan for a fraction section, or null when it is not one. */
function planFraction(body: string): FractionPlan | null {
  // Only the bare shape reads as a fraction; anything with quoted text or an
  // escape around it stays on the ordinary numeric path, where it always was.
  const m = FRACTION.exec(body.trim())
  if (!m) return null
  const den = m[3]!
  return { int: m[1] ?? null, num: m[2]!, den, denLiteral: /^\d+$/.test(den) ? Number(den) : null }
}

/** The closest numerator and denominator, with the denominator capped. */
function bestFraction(value: number, maxDen: number): { num: number; den: number } {
  // Stern-Brocot: take the mediant of the two bounding fractions until the
  // denominator would pass the cap. Exact for anything that fits, and it
  // cannot run longer than the cap.
  let loNum = 0
  let loDen = 1
  let hiNum = 1
  let hiDen = 0
  let bestNum = Math.round(value)
  let bestDen = 1
  let bestErr = Math.abs(value - bestNum)
  for (let i = 0; i < 64; i += 1) {
    const num = loNum + hiNum
    const den = loDen + hiDen
    if (den > maxDen) break
    const mediant = num / den
    const err = Math.abs(value - mediant)
    if (err < bestErr - 1e-12) { bestErr = err; bestNum = num; bestDen = den }
    if (err < 1e-12) break
    if (mediant < value) { loNum = num; loDen = den } else { hiNum = num; hiDen = den }
  }
  return { num: bestNum, den: bestDen }
}

/** A placeholder group as Excel pads it: `0` a zero, `?` a space, `#` nothing. */
function padHolders(text: string, holders: string): string {
  if (text.length >= holders.length) return text
  const filler = holders.includes('0') ? '0' : holders.includes('?') ? ' ' : ''
  return filler ? filler.repeat(holders.length - text.length) + text : text
}

/** One number through a fraction pattern. */
function renderFraction(plan: FractionPlan, value: number): string {
  const sign = value < 0 ? '-' : ''
  const magnitude = Math.abs(value)
  const whole = plan.int ? Math.floor(magnitude + 1e-12) : 0
  const rest = magnitude - whole
  const maxDen = plan.denLiteral ?? Math.pow(10, plan.den.length) - 1
  const found = plan.denLiteral
    ? { num: Math.round(rest * plan.denLiteral), den: plan.denLiteral }
    : bestFraction(rest, maxDen)
  let num = found.num
  const den = found.den
  let carried = whole
  // Rounding up to a whole: 0.99 over `# ?/?` is 1, not 1/1.
  if (den > 0 && num >= den) { carried += Math.floor(num / den); num %= den }

  if (!plan.int) {
    return `${sign}${padHolders(String(num + carried * den), plan.num)}/${padHolders(String(den), plan.den)}`
  }
  const blanks = (holders: string) => (holders.includes('?') ? ' '.repeat(holders.length) : '')
  const wholeText = carried === 0 && !plan.int.includes('0')
    ? ' '.repeat(plan.int.includes('?') ? plan.int.length : 0)
    : padHolders(String(carried), plan.int)
  // No remainder: Excel leaves the fraction's width blank rather than
  // printing 0/1, so a column of them still lines up.
  const fraction = num === 0
    ? `${blanks(plan.num)} ${blanks(plan.den)}`
    : `${padHolders(String(num), plan.num)}/${padHolders(String(den), plan.den)}`
  return `${sign}${wholeText} ${fraction}`.replace(/\s+$/, '')
}

/**
 * Pull a numeric section apart into literal text and digit placeholders.
 *
 * Literal text before the first digit is the prefix and after the last is
 * the suffix. Literal text BETWEEN integer digits, as in `000-00-0000` or
 * `(###) ###-####`, turns the integer side into a mask that the digits are
 * laid into from the right, which is how Excel's Special formats work.
 *
 * `_x` (Excel: leave the width of x) and `*x` (fill the cell with x) both
 * become one space here: text has no cell width to leave or fill, and one
 * space is what keeps `_($* #,##0.00_)` reading as `$ 1,234.00`.
 */
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
  // The integer side as tokens, literal text included, until the decimal
  // point. `pending` holds literal text after the last integer digit, which
  // is part of the mask only if another digit follows it.
  const mask: MaskToken[] = []
  let pending = ''
  let maskHasLiteral = false

  const literal = (text: string) => {
    if (!seenPlaceholder) prefix += text
    else if (afterDecimal || scientific) suffix += text
    else pending += text
  }

  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]!

    if (ch === '\\') {
      literal(body[i + 1] ?? '')
      i += 1
      continue
    }
    if (ch === '_' || ch === '*') {
      literal(' ')
      i += 1
      continue
    }
    if (ch === '"') {
      const end = body.indexOf('"', i + 1)
      literal(body.slice(i + 1, end < 0 ? body.length : end))
      i = end < 0 ? body.length : end
      continue
    }
    if (ch === '0' || ch === '#' || ch === '?') {
      seenPlaceholder = true
      // After an E+ the placeholders size the EXPONENT, not the mantissa.
      // Counting them as decimals turns 0.00E+00 into four decimal places.
      if (scientific) expPlaceholders += ch
      else if (afterDecimal) fracPlaceholders += ch
      else {
        intPlaceholders += ch
        if (pending) { mask.push({ kind: 'lit', text: pending }); maskHasLiteral = true; pending = '' }
        mask.push({ kind: 'digit', ch })
      }
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
    if (ch === '%') { percent = true; literal('%'); continue }
    if ((ch === 'E' || ch === 'e') && /^[+-]/.test(body.slice(i + 1))) {
      scientific = true
      i += 1
      continue
    }
    literal(ch)
  }
  // Literal text after the last integer digit belongs to the suffix, before
  // whatever the fraction and exponent added.
  if (pending) suffix = pending + suffix

  // A `?` on the integer side pads with a space, which the mask renderer
  // does and the plain path (digits, grouping) does not.
  const needsMask = maskHasLiteral || intPlaceholders.includes('?')
  return {
    prefix, suffix, intPlaceholders, intMask: needsMask ? mask : null,
    fracPlaceholders, expPlaceholders,
    useGrouping, scale, percent, scientific,
  }
}

/** Lay digits into a mask from the right: `000-00-0000` on 123456789 is
 *  `123-45-6789`; digits left over go in front, missing ones follow the
 *  placeholder's rule, so `###-####` on 1234 is `-1234` as Excel gives. */
function renderMask(mask: MaskToken[], digits: string): string {
  let out = ''
  let at = digits.length
  for (let i = mask.length - 1; i >= 0; i -= 1) {
    const token = mask[i]!
    if (token.kind === 'lit') { out = token.text + out; continue }
    if (at > 0) { at -= 1; out = digits[at]! + out; continue }
    if (token.ch === '0') out = `0${out}`
    else if (token.ch === '?') out = ` ${out}`
  }
  return digits.slice(0, at) + out
}

function group(intText: string): string {
  return intText.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function renderNumeric(plan: NumericPlan, value: number): string {
  let n = value
  if (plan.percent) n *= 100
  if (plan.scale !== 1) n /= plan.scale

  if (plan.scientific) {
    // The integer placeholders set the STEP of the exponent, which is what
    // makes `##0.0E+0` engineering notation: three of them means the
    // exponent moves in threes and the mantissa carries up to three integer
    // digits, so 12345 reads 12.3E+3 rather than 1.2E+4. The everyday
    // `0.00E+00` has one, and is the ordinary scientific form.
    const step = Math.max(1, plan.intPlaceholders.length)
    const decimals = plan.fracPlaceholders.length
    let exponent = n === 0 ? 0 : Math.floor(Math.log10(Math.abs(n)))
    exponent = Math.floor(exponent / step) * step
    let mantissa = n / Math.pow(10, exponent)
    // Rounding can carry the mantissa over its own width: 999.95 with one
    // decimal is 1000.0, which is 1.0 a step further out.
    if (Math.abs(Number(mantissa.toFixed(decimals))) >= Math.pow(10, step)) {
      mantissa /= Math.pow(10, step)
      exponent += step
    }
    const sign = exponent < 0 ? '-' : '+'
    const digits = String(Math.abs(exponent)).padStart(plan.expPlaceholders.length || 1, '0')
    return `${plan.prefix}${mantissa.toFixed(decimals)}E${sign}${digits}${plan.suffix}`
  }

  const decimals = plan.fracPlaceholders.length
  const fixed = Math.abs(n).toFixed(decimals)
  const [rawInt = '0', rawFrac = ''] = fixed.split('.')

  // Pad the integer side out to the number of `0` placeholders, and drop a
  // leading zero entirely when the pattern is all `#`.
  const minInt = plan.intPlaceholders.split('').filter((c) => c === '0').length
  let intText = rawInt
  if (plan.intMask) {
    intText = renderMask(plan.intMask, rawInt === '0' && minInt === 0 ? '' : rawInt)
  } else {
    if (intText.length < minInt) intText = intText.padStart(minInt, '0')
    if (minInt === 0 && intText === '0' && plan.intPlaceholders.length > 0) intText = ''
    if (plan.useGrouping && intText !== '') intText = group(intText)
  }

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

/** The text section: `@` is the value, quotes and backslashes wrap
 *  literals, `_x` and `*x` are one space, as on the numeric side. */
function renderText(body: string, value: string): string {
  let out = ''
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]!
    if (ch === '\\') { out += body[i + 1] ?? ''; i += 1; continue }
    if (ch === '_' || ch === '*') { out += ' '; i += 1; continue }
    if (ch === '"') {
      const end = body.indexOf('"', i + 1)
      out += body.slice(i + 1, end < 0 ? body.length : end)
      i = end < 0 ? body.length : end
      continue
    }
    out += ch === '@' ? value : ch
  }
  return out
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
  const conditional = sections.some((sec) => sec.condition)

  // Plans are built once here, not per value.
  const plans = new Map<Section, NumericPlan>()
  const fractions = new Map<Section, FractionPlan>()
  const dateFlags = new Map<Section, boolean>()
  for (const s of sections) {
    if (!s) continue
    const isDate = looksLikeDate(s.body)
    dateFlags.set(s, isDate)
    if (isDate) continue
    const fraction = planFraction(s.body)
    if (fraction) fractions.set(s, fraction)
    else plans.set(s, planNumeric(s.body))
  }

  const compiled: CompiledFormat = {
    pattern,
    format(value) {
      if (pattern.trim() === '' || pattern.toUpperCase() === 'GENERAL') {
        return { text: general(value) }
      }

      if (typeof value === 'string' && value !== '') {
        // Excel's FOURTH section is the one that governs text. With one, `@`
        // puts the text where it stands and a section without an `@` shows
        // only its own literals, which is what makes `;;;` hide a cell and
        // `;;;"n/a"` show n/a whatever was typed. With no fourth section the
        // text is shown as it is, even under a numeric pattern like `0.00`.
        const section = text ?? (positive?.body.includes('@') ? positive : undefined)
        if (!section) return { text: value }
        return { text: renderText(section.body, section.body.includes('@') ? value : ''), color: section.color }
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
      // With conditions, the first section whose condition the value passes
      // wins and an unconditioned one is the fallback, as in Excel's
      // `[<=9999999]###-####;(###) ###-####`.
      let section: Section | undefined
      if (conditional) {
        section = sections.find((sec) => sec && (sec.condition ? passes(sec.condition, n) : true))
      } else {
        section = positive
        if (n < 0 && negative) section = negative
        else if (n === 0 && zero) section = zero
      }
      if (!section) return { text: general(value) }

      if (dateFlags.get(section)) {
        const d = toDate(value)
        // `n` is the serial the value stands for, which is what an elapsed
        // token totals: 1.5 is a day and a half, [h]:mm reads 36:00.
        return d
          ? { text: renderDate(section.body, d, n), color: section.color }
          : { text: general(value) }
      }

      const asFraction = fractions.get(section)
      if (asFraction) {
        // A negative with its own section is rendered from its magnitude,
        // as everywhere else: the section supplies the sign.
        const usingNegative = n < 0 && section === negative && !conditional
        return { text: renderFraction(asFraction, usingNegative ? Math.abs(n) : n), color: section.color }
      }

      const plan = plans.get(section)!
      if (!hasPlaceholders(plan)) {
        // `@` is the text placeholder, and a NUMBER in a cell formatted as
        // Text is still shown by Excel as the number rather than as the
        // placeholder: `@` over 5 reads 5, not @.
        if (section.body.includes('@')) {
          return { text: renderText(section.body, general(value)), color: section.color }
        }
        return { text: plan.prefix + plan.suffix, color: section.color }
      }
      // A negative shown by its own section renders its ABSOLUTE value: the
      // section supplies the sign, usually as parentheses or a literal minus.
      const usingNegativeSection = n < 0 && section === negative && !conditional
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
  accounting: '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)',
  percent: '0.00%',
  scientific: '0.00E+00',
} as const

/** Excel's Special category: fixed-shape numbers laid into a mask. */
export const SPECIAL_FORMATS = {
  zip: { label: 'Zip Code', pattern: '00000' },
  zip4: { label: 'Zip Code + 4', pattern: '00000-0000' },
  phone: { label: 'Phone Number', pattern: '[<=9999999]###-####;(###) ###-####' },
  ssn: { label: 'Social Security Number', pattern: '000-00-0000' },
} as const

export type SpecialFormatName = keyof typeof SPECIAL_FORMATS

/** The pattern Excel's Accounting category spells for a symbol and a
 *  number of decimals; an empty symbol is its "None". */
export function accountingPattern(symbol: string, decimals: number): string {
  const digits = `#,##0${decimals > 0 ? '.' + '0'.repeat(decimals) : ''}`
  const sym = symbol === '$' ? '$* ' : symbol ? `${JSON.stringify(symbol)}* ` : '* '
  return `_(${sym}${digits}_);_(${sym}(${digits});_(${sym}"-"${'?'.repeat(decimals)}_);_(@_)`
}

/** The symbol and decimals an accounting pattern was built from, or null
 *  when the pattern is not one `accountingPattern` would spell. */
export function accountingParts(fmt: string | undefined): { symbol: string; decimals: number } | null {
  if (!fmt) return null
  const m = /^_\((?:"([^"]*)"|\$)?\* #,##0(\.0+)?_\);/.exec(fmt)
  if (!m) return null
  const symbol = m[1] !== undefined ? m[1] : fmt.startsWith('_($') ? '$' : ''
  return { symbol, decimals: m[2] ? m[2].length - 1 : 0 }
}

export type FormatPresetName = keyof typeof FORMAT_PRESETS

/**
 * Which of Excel's categories a pattern belongs to, with the decimals and
 * separator it carries, so the ribbon's combo can say "Percentage" for a
 * cell holding `0%` (a typed 12%) as well as for the preset's `0.00%`, and
 * Format Cells can open on the right category. A pattern that is none of
 * them is 'custom'.
 */
export function formatCategory(fmt: string | undefined): {
  category: FormatPresetName | 'special' | 'custom'
  decimals: number
  thousands: boolean
} {
  if (!fmt || fmt === 'General') return { category: 'general', decimals: 2, thousands: true }
  const decimals = fmt.match(/\.(0+)/)?.[1]?.length ?? 0
  if (accountingParts(fmt)) return { category: 'accounting', decimals, thousands: true }
  if (Object.values(SPECIAL_FORMATS).some((sp) => sp.pattern === fmt)) return { category: 'special', decimals: 0, thousands: false }
  if (/E\+/i.test(fmt)) return { category: 'scientific', decimals, thousands: false }
  if (/%$/.test(fmt)) return { category: 'percent', decimals, thousands: false }
  if (/^\$/.test(fmt)) return { category: 'currency', decimals, thousands: true }
  if (/[hs]:|AM\/PM/i.test(fmt)) return { category: 'time', decimals: 0, thousands: false }
  if (/y|d/i.test(fmt) && !/[#0]/.test(fmt)) return { category: 'date', decimals: 0, thousands: false }
  if (/^#?,?#*0(\.0+)?$/.test(fmt)) return { category: 'number', decimals, thousands: fmt.includes(',') }
  return { category: 'custom', decimals, thousands: false }
}
