/**
 * Value coercions, shared by the evaluator and the function table.
 *
 * Excel's rules, not JavaScript's. The differences that matter:
 *   - An empty cell is 0 in arithmetic but is NOT counted by COUNT or averaged
 *     by AVERAGE, so "coerce to number" and "is a number" are separate tests.
 *   - Text that does not parse as a number is `#VALUE!`, not NaN. Returning NaN
 *     would let a bad cell poison a total silently.
 *   - Text comparison is case-insensitive: `="a"="A"` is TRUE.
 *   - Booleans are 1 and 0 in arithmetic but are skipped by numeric aggregates.
 */
import { FormulaError, isError, type CellValue } from './ast'

/** The epoch Excel's date serials count from: serial 1 is 1900-01-01. Day 60
 *  is Excel's phantom 1900-02-29, so every date from 1900-03-01 on is right
 *  and the two months before it are a day out, which no sheet has cared
 *  about. */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30)

/** A date from a cell: a serial number, or text `new Date` can read
 *  (`2024-03-09`, `2024-03-09 13:45`). Anything else is `#VALUE!`. */
export function toDate(v: CellValue): Date {
  if (typeof v === 'number') return new Date(EXCEL_EPOCH_MS + v * 86400000)
  const d = new Date(toText(v))
  if (Number.isNaN(d.getTime())) throw new FormulaError('#VALUE!')
  return d
}

/** The `yyyy-mm-dd` the date functions hand back. */
export const isoDate = (d: Date): string => d.toISOString().slice(0, 10)

/** Excel's serial for a date, fractional when it carries a time. */
export function dateSerial(d: Date): number {
  return (d.getTime() - EXCEL_EPOCH_MS) / 86400000
}

const ISO_DATE_TEXT = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
const SLASH_DATE_TEXT = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
const CLOCK_TEXT = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/

/**
 * The serial a date or a time written as text is worth in arithmetic, or
 * null when the text is neither. Dates are `yyyy-mm-dd` text in a sheet
 * (see `toDate`), so `=A1+1` under one has to read it as Excel reads a
 * date cell: as its day number, so the sum is the next day rather than
 * `#VALUE!`. A clock time is the fraction of a day it is, `="10:30"*2` being
 * 0.875, and `m/d/yyyy` is read the way `new Date` reads it, as toDate does.
 */
export function dateTextSerial(text: string): number | null {
  const t = text.trim()
  let m = ISO_DATE_TEXT.exec(t)
  if (m) {
    const month = Number(m[2]), day = Number(m[3]), hours = Number(m[4] ?? 0), minutes = Number(m[5] ?? 0)
    if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59) return null
    const ms = Date.UTC(Number(m[1]), month - 1, day, hours, minutes, Number(m[6] ?? 0))
    return (ms - EXCEL_EPOCH_MS) / 86400000
  }
  m = SLASH_DATE_TEXT.exec(t)
  if (m) {
    const month = Number(m[1]), day = Number(m[2])
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return (Date.UTC(Number(m[3]), month - 1, day) - EXCEL_EPOCH_MS) / 86400000
  }
  m = CLOCK_TEXT.exec(t)
  if (m) {
    const hours = Number(m[1]), minutes = Number(m[2]), seconds = Number(m[3] ?? 0)
    if (hours > 23 || minutes > 59 || seconds > 59) return null
    return (hours * 3600 + minutes * 60 + seconds) / 86400
  }
  return null
}

export function toNumber(v: CellValue): number {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string') {
    if (v.trim() === '') return 0
    const n = Number(v)
    if (Number.isFinite(n)) return n
    const serial = dateTextSerial(v)
    if (serial !== null) return serial
    throw new FormulaError('#VALUE!')
  }
  if (isError(v)) throw new FormulaError(v.error)
  return 0
}

export function toBool(v: CellValue): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') {
    const upper = v.trim().toUpperCase()
    if (upper === 'TRUE') return true
    if (upper === 'FALSE') return false
    return v.length > 0
  }
  if (isError(v)) throw new FormulaError(v.error)
  return false
}

export function toText(v: CellValue): string {
  if (typeof v === 'string') return v
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (typeof v === 'number') return String(v)
  if (isError(v)) throw new FormulaError(v.error)
  return ''
}

/** Excel's `=` between two values. Text compares case-insensitively; a number
 *  never equals the text that looks like it. */
export function looseEquals(a: CellValue, b: CellValue): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a === b
  if (typeof a === 'string' && typeof b === 'string') {
    return a.toLowerCase() === b.toLowerCase()
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b
  if (isError(a) || isError(b)) return false
  return false
}

/**
 * Excel's wildcards, which every text criterion and exact lookup speaks:
 * `*` stands for any run of characters, `?` for exactly one, and `~` asks
 * for the next character itself, so `"~*"` is a literal asterisk.
 */
export function hasWildcards(pattern: string): boolean {
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i]
    if (ch === '~') { i += 1; continue }
    if (ch === '*' || ch === '?') return true
  }
  return false
}

const LITERAL = /[\\^$.*+?()[\]{}|]/g

/** The pattern as a regular expression, anchored at both ends and
 *  case-insensitive, which is how Excel compares text. */
export function wildcardRegExp(pattern: string): RegExp {
  let out = ''
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i]!
    if (ch === '~' && i + 1 < pattern.length) {
      out += pattern[i + 1]!.replace(LITERAL, '\\$&')
      i += 1
      continue
    }
    if (ch === '*') { out += '[\\s\\S]*'; continue }
    if (ch === '?') { out += '[\\s\\S]'; continue }
    out += ch.replace(LITERAL, '\\$&')
  }
  return new RegExp(`^${out}$`, 'i')
}

/** The pattern with its `~` escapes taken off, which is the text a plain
 *  comparison should look for: `"~*"` means a literal asterisk. */
export function unescapeWildcards(pattern: string): string {
  if (!pattern.includes('~')) return pattern
  let out = ''
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i]!
    if (ch === '~' && i + 1 < pattern.length) { out += pattern[i + 1]!; i += 1; continue }
    out += ch
  }
  return out
}

/** Does this cell match a wildcard pattern? Only text takes part: Excel
 *  never turns a number into text to match `"1*"`. */
export function wildcardMatches(value: CellValue, pattern: string): boolean {
  if (typeof value !== 'string') return false
  return wildcardRegExp(pattern).test(value)
}

/** Equality as a criterion or an exact lookup reads it: a pattern carrying
 *  wildcards matches, anything else compares as `=` does. */
export function patternEquals(value: CellValue, operand: CellValue): boolean {
  if (typeof operand !== 'string') return looseEquals(value, operand)
  if (hasWildcards(operand)) return wildcardMatches(value, operand)
  return looseEquals(value, unescapeWildcards(operand))
}

/** Ordering for `<` and friends. Excel orders number < text < boolean. */
export function compare(a: CellValue, b: CellValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0
  if (typeof a === 'string' && typeof b === 'string') {
    const x = a.toLowerCase()
    const y = b.toLowerCase()
    return x < y ? -1 : x > y ? 1 : 0
  }
  return toNumber(a) < toNumber(b) ? -1 : toNumber(a) > toNumber(b) ? 1 : 0
}

/** The numeric members of a flattened argument list. Blanks, text and booleans
 *  are skipped, which is what makes AVERAGE of a column with a header work. */
export function numericOnly(values: ReadonlyArray<CellValue>): number[] {
  const out: number[] = []
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) out.push(v)
  }
  return out
}

/** Is this cell empty for COUNTA / COUNTBLANK purposes. */
export function isBlank(v: CellValue): boolean {
  return v === '' || v === null || v === undefined
}

/**
 * An Excel criterion: a bare value matches by equality, a string starting with
 * an operator compares (`">100"`, `"<>x"`). Used by SUMIF / COUNTIF / their
 * plural forms, which all share this grammar.
 */
export function matchesCriterion(value: CellValue, criterion: CellValue): boolean {
  if (typeof criterion === 'string') {
    const m = /^(<=|>=|<>|<|>|=)(.*)$/.exec(criterion.trim())
    if (m) {
      const opText = m[1]!
      const rest = m[2]!.trim()
      const n = Number(rest)
      const operand: CellValue = rest !== '' && Number.isFinite(n) ? n : rest
      switch (opText) {
        case '=': return patternEquals(value, operand)
        case '<>': return !patternEquals(value, operand)
        case '<': return compare(value, operand) < 0
        case '>': return compare(value, operand) > 0
        case '<=': return compare(value, operand) <= 0
        case '>=': return compare(value, operand) >= 0
        default: break
      }
    }
  }
  return patternEquals(value, criterion)
}

/** The indexes in `range` that meet `criterion`, for the IF family. */
export function criteriaHits(
  range: ReadonlyArray<CellValue>,
  criterion: CellValue,
): number[] {
  const out: number[] = []
  for (let i = 0; i < range.length; i += 1) {
    if (matchesCriterion(range[i]!, criterion)) out.push(i)
  }
  return out
}

/** SUMIFS and its family: every (range, criterion) pair must match at an index. */
export function multiCriteriaHits(pairs: Array<[ReadonlyArray<CellValue>, CellValue]>): number[] {
  const firstPair = pairs[0]
  if (!firstPair) return []
  const out: number[] = []
  for (let i = 0; i < firstPair[0].length; i += 1) {
    if (pairs.every(([range, crit]) => matchesCriterion(range[i] ?? '', crit))) out.push(i)
  }
  return out
}

/** The (range, criterion) pairs of a *IFS call, starting at argument `from`. */
export function criteriaPairs(
  args: ReadonlyArray<ReadonlyArray<CellValue>>,
  from: number,
): Array<[ReadonlyArray<CellValue>, CellValue]> {
  const pairs: Array<[ReadonlyArray<CellValue>, CellValue]> = []
  for (let i = from; i < args.length; i += 2) {
    const range = args[i]
    if (!range) break
    pairs.push([range, args[i + 1]?.[0] ?? ''])
  }
  return pairs
}
