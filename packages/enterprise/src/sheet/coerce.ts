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

export function toNumber(v: CellValue): number {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string') {
    if (v.trim() === '') return 0
    const n = Number(v)
    if (Number.isFinite(n)) return n
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
        case '=': return looseEquals(value, operand)
        case '<>': return !looseEquals(value, operand)
        case '<': return compare(value, operand) < 0
        case '>': return compare(value, operand) > 0
        case '<=': return compare(value, operand) <= 0
        case '>=': return compare(value, operand) >= 0
        default: break
      }
    }
  }
  return looseEquals(value, criterion)
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
