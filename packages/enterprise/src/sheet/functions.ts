/**
 * The function table.
 *
 * Each entry receives its arguments already evaluated, in two shapes:
 *   - `flat`  every argument flattened into one list, ranges expanded. What
 *             SUM and COUNT want.
 *   - `args`  one list per argument, so a function can tell `SUM(A1:A3, 5)`
 *             from `SUM(A1:A3)` and `SUMIF` can line a range up against a
 *             parallel one.
 *   - `grids` the 2-D shape of any range argument, kept for VLOOKUP / INDEX /
 *             MATCH, which lose meaning once flattened.
 *
 * Functions that must NOT evaluate every argument (IF, IFERROR, AND, OR with
 * short-circuit semantics) are handled in the evaluator instead, because by the
 * time a table entry runs, evaluation has already happened.
 */
import { FormulaError, isError, err, type CellValue } from './ast'
import {
  toNumber, toBool, toText, looseEquals, compare,
  numericOnly, isBlank, matchesCriterion,
} from './coerce'

export type FnArgs = {
  flat: ReadonlyArray<CellValue>
  args: ReadonlyArray<ReadonlyArray<CellValue>>
  grids: ReadonlyArray<ReadonlyArray<ReadonlyArray<CellValue>> | null>
}

export type SheetFunction = (a: FnArgs) => CellValue

const first = (a: FnArgs): CellValue => a.flat[0] ?? ''
const nth = (a: FnArgs, i: number): CellValue => a.args[i]?.[0] ?? ''

function sum(values: ReadonlyArray<CellValue>): number {
  return numericOnly(values).reduce((x, y) => x + y, 0)
}

function average(values: ReadonlyArray<CellValue>): CellValue {
  const ns = numericOnly(values)
  if (ns.length === 0) return err('#DIV/0!')
  return ns.reduce((x, y) => x + y, 0) / ns.length
}

function roundTo(value: number, digits: number): number {
  const f = Math.pow(10, digits)
  // Scale, round, unscale. The epsilon nudge keeps 1.005 -> 1.01 rather than
  // 1.00, which is the binary-float surprise users report as a bug.
  return Math.round((value * f) * (1 + Number.EPSILON)) / f
}

function toDate(v: CellValue): Date {
  if (typeof v === 'number') {
    // Excel serial: day 1 is 1900-01-01, with the famous phantom leap day.
    return new Date(Date.UTC(1899, 11, 30) + v * 86400000)
  }
  const d = new Date(toText(v))
  if (Number.isNaN(d.getTime())) throw new FormulaError('#VALUE!')
  return d
}

const iso = (d: Date): string => d.toISOString().slice(0, 10)

/** Sum / count / average over a criterion range, optionally summing a parallel
 *  range. The three IF functions differ only in what they do with the hits. */
function criteriaHits(
  range: ReadonlyArray<CellValue>,
  criterion: CellValue,
): number[] {
  const out: number[] = []
  for (let i = 0; i < range.length; i += 1) {
    if (matchesCriterion(range[i]!, criterion)) out.push(i)
  }
  return out
}

/** SUMIFS / COUNTIFS: every (range, criterion) pair must match at an index. */
function multiCriteriaHits(pairs: Array<[ReadonlyArray<CellValue>, CellValue]>): number[] {
  const firstPair = pairs[0]
  if (!firstPair) return []
  const out: number[] = []
  for (let i = 0; i < firstPair[0].length; i += 1) {
    if (pairs.every(([range, crit]) => matchesCriterion(range[i] ?? '', crit))) out.push(i)
  }
  return out
}

export const FUNCTIONS: Record<string, SheetFunction> = {
  // ---- Math and aggregation -------------------------------------------
  SUM: (a) => sum(a.flat),
  AVERAGE: (a) => average(a.flat),
  AVG: (a) => average(a.flat),
  MIN: (a) => { const n = numericOnly(a.flat); return n.length ? Math.min(...n) : 0 },
  MAX: (a) => { const n = numericOnly(a.flat); return n.length ? Math.max(...n) : 0 },
  COUNT: (a) => a.flat.filter((v) => typeof v === 'number').length,
  COUNTA: (a) => a.flat.filter((v) => !isBlank(v)).length,
  COUNTBLANK: (a) => a.flat.filter((v) => isBlank(v)).length,
  ABS: (a) => Math.abs(toNumber(first(a))),
  INT: (a) => Math.floor(toNumber(first(a))),
  MOD: (a) => {
    const d = toNumber(nth(a, 1))
    if (d === 0) return err('#DIV/0!')
    // Excel's MOD follows the sign of the divisor, unlike JavaScript's %.
    const n = toNumber(nth(a, 0))
    return n - d * Math.floor(n / d)
  },
  POWER: (a) => Math.pow(toNumber(nth(a, 0)), toNumber(nth(a, 1))),
  SQRT: (a) => {
    const n = toNumber(first(a))
    return n < 0 ? err('#NUM!') : Math.sqrt(n)
  },
  ROUND: (a) => roundTo(toNumber(nth(a, 0)), Math.round(toNumber(nth(a, 1) || 0))),
  ROUNDUP: (a) => {
    const d = Math.round(toNumber(nth(a, 1) || 0))
    const f = Math.pow(10, d)
    const v = toNumber(nth(a, 0))
    return (v < 0 ? -Math.ceil(-v * f) : Math.ceil(v * f)) / f
  },
  ROUNDDOWN: (a) => {
    const d = Math.round(toNumber(nth(a, 1) || 0))
    const f = Math.pow(10, d)
    const v = toNumber(nth(a, 0))
    return (v < 0 ? -Math.floor(-v * f) : Math.floor(v * f)) / f
  },
  MEDIAN: (a) => {
    const n = numericOnly(a.flat).sort((x, y) => x - y)
    if (!n.length) return err('#NUM!')
    const mid = Math.floor(n.length / 2)
    return n.length % 2 ? n[mid]! : (n[mid - 1]! + n[mid]!) / 2
  },
  STDEV: (a) => {
    const n = numericOnly(a.flat)
    if (n.length < 2) return err('#DIV/0!')
    const mean = n.reduce((x, y) => x + y, 0) / n.length
    const variance = n.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n.length - 1)
    return Math.sqrt(variance)
  },
  RANK: (a) => {
    const value = toNumber(nth(a, 0))
    const pool = numericOnly(a.args[1] ?? [])
    const ascending = a.args[2] !== undefined && toBool(nth(a, 2))
    const sorted = pool.slice().sort((x, y) => (ascending ? x - y : y - x))
    const at = sorted.indexOf(value)
    return at < 0 ? err('#N/A') : at + 1
  },

  // ---- Conditional aggregation ----------------------------------------
  SUMIF: (a) => {
    const range = a.args[0] ?? []
    const hits = criteriaHits(range, nth(a, 1))
    // The optional third argument is the range actually summed.
    const target = a.args[2] ?? range
    return sum(hits.map((i) => target[i] ?? ''))
  },
  COUNTIF: (a) => criteriaHits(a.args[0] ?? [], nth(a, 1)).length,
  AVERAGEIF: (a) => {
    const range = a.args[0] ?? []
    const hits = criteriaHits(range, nth(a, 1))
    const target = a.args[2] ?? range
    return average(hits.map((i) => target[i] ?? ''))
  },
  SUMIFS: (a) => {
    const target = a.args[0] ?? []
    const pairs: Array<[ReadonlyArray<CellValue>, CellValue]> = []
    for (let i = 1; i + 1 < a.args.length + 1; i += 2) {
      const range = a.args[i]
      if (!range) break
      pairs.push([range, a.args[i + 1]?.[0] ?? ''])
    }
    return sum(multiCriteriaHits(pairs).map((i) => target[i] ?? ''))
  },
  COUNTIFS: (a) => {
    const pairs: Array<[ReadonlyArray<CellValue>, CellValue]> = []
    for (let i = 0; i < a.args.length; i += 2) {
      const range = a.args[i]
      if (!range) break
      pairs.push([range, a.args[i + 1]?.[0] ?? ''])
    }
    return multiCriteriaHits(pairs).length
  },

  // ---- Logical ---------------------------------------------------------
  NOT: (a) => !toBool(first(a)),
  AND: (a) => a.flat.every((v) => toBool(v)),
  OR: (a) => a.flat.some((v) => toBool(v)),
  XOR: (a) => a.flat.filter((v) => toBool(v)).length % 2 === 1,

  // ---- Text ------------------------------------------------------------
  LEN: (a) => toText(first(a)).length,
  LEFT: (a) => toText(nth(a, 0)).slice(0, Math.max(0, Math.round(toNumber(a.args[1] ? nth(a, 1) : 1)))),
  RIGHT: (a) => {
    const s = toText(nth(a, 0))
    const n = Math.max(0, Math.round(toNumber(a.args[1] ? nth(a, 1) : 1)))
    return n >= s.length ? s : s.slice(s.length - n)
  },
  MID: (a) => {
    const s = toText(nth(a, 0))
    const start = Math.round(toNumber(nth(a, 1)))
    if (start < 1) return err('#VALUE!')
    return s.slice(start - 1, start - 1 + Math.max(0, Math.round(toNumber(nth(a, 2)))))
  },
  UPPER: (a) => toText(first(a)).toUpperCase(),
  LOWER: (a) => toText(first(a)).toLowerCase(),
  TRIM: (a) => toText(first(a)).trim().replace(/\s+/g, ' '),
  CONCAT: (a) => a.flat.map((v) => toText(v)).join(''),
  CONCATENATE: (a) => a.flat.map((v) => toText(v)).join(''),
  TEXTJOIN: (a) => {
    const sep = toText(nth(a, 0))
    const skipEmpty = toBool(nth(a, 1))
    const rest = a.args.slice(2).flat()
    return rest.filter((v) => !skipEmpty || !isBlank(v)).map((v) => toText(v)).join(sep)
  },
  SUBSTITUTE: (a) => {
    const s = toText(nth(a, 0))
    const find = toText(nth(a, 1))
    const replace = toText(nth(a, 2))
    if (find === '') return s
    return s.split(find).join(replace)
  },
  FIND: (a) => {
    // Case sensitive, 1-based, #VALUE! when absent. SEARCH is its
    // case-insensitive twin.
    const at = toText(nth(a, 1)).indexOf(toText(nth(a, 0)))
    return at < 0 ? err('#VALUE!') : at + 1
  },
  SEARCH: (a) => {
    const at = toText(nth(a, 1)).toLowerCase().indexOf(toText(nth(a, 0)).toLowerCase())
    return at < 0 ? err('#VALUE!') : at + 1
  },
  TEXT: (a) => {
    // Minimal: the full Excel format grammar arrives with per-cell number
    // formats. Until then this covers the common fixed-decimal case.
    const v = toNumber(nth(a, 0))
    const pattern = toText(nth(a, 1))
    const decimals = /\.(0+)/.exec(pattern)?.[1]?.length ?? 0
    const body = v.toFixed(decimals)
    if (pattern.includes(',')) {
      const [int = '', frac] = body.split('.')
      const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return frac ? `${grouped}.${frac}` : grouped
    }
    return body
  },

  // ---- Date ------------------------------------------------------------
  TODAY: () => iso(new Date()),
  NOW: () => new Date().toISOString().slice(0, 19).replace('T', ' '),
  YEAR: (a) => toDate(first(a)).getUTCFullYear(),
  MONTH: (a) => toDate(first(a)).getUTCMonth() + 1,
  DAY: (a) => toDate(first(a)).getUTCDate(),
  DATE: (a) => iso(new Date(Date.UTC(
    Math.round(toNumber(nth(a, 0))),
    Math.round(toNumber(nth(a, 1))) - 1,
    Math.round(toNumber(nth(a, 2))),
  ))),
  EOMONTH: (a) => {
    const d = toDate(nth(a, 0))
    const months = Math.round(toNumber(nth(a, 1)))
    // Day 0 of the following month is the last day of the target month.
    return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months + 1, 0)))
  },

  // ---- Lookup ----------------------------------------------------------
  VLOOKUP: (a) => {
    const needle = nth(a, 0)
    const grid = a.grids[1]
    if (!grid) return err('#REF!')
    const col = Math.round(toNumber(nth(a, 2)))
    if (col < 1) return err('#VALUE!')
    for (const row of grid) {
      if (row[0] !== undefined && looseEquals(row[0], needle)) {
        const cell = row[col - 1]
        return cell === undefined ? err('#REF!') : cell
      }
    }
    return err('#N/A')
  },
  HLOOKUP: (a) => {
    const needle = nth(a, 0)
    const grid = a.grids[1]
    if (!grid) return err('#REF!')
    const rowIndex = Math.round(toNumber(nth(a, 2)))
    if (rowIndex < 1) return err('#VALUE!')
    const header = grid[0] ?? []
    for (let c = 0; c < header.length; c += 1) {
      if (looseEquals(header[c]!, needle)) {
        const cell = grid[rowIndex - 1]?.[c]
        return cell === undefined ? err('#REF!') : cell
      }
    }
    return err('#N/A')
  },
  MATCH: (a) => {
    const needle = nth(a, 0)
    const pool = a.args[1] ?? []
    const mode = a.args[2] ? Math.round(toNumber(nth(a, 2))) : 1
    if (mode === 0) {
      const at = pool.findIndex((v) => looseEquals(v, needle))
      return at < 0 ? err('#N/A') : at + 1
    }
    // Ordered search: the last value not past the needle.
    let best = -1
    for (let i = 0; i < pool.length; i += 1) {
      const cmp = compare(pool[i]!, needle)
      if (mode === 1 ? cmp <= 0 : cmp >= 0) best = i
    }
    return best < 0 ? err('#N/A') : best + 1
  },
  INDEX: (a) => {
    const grid = a.grids[0]
    if (!grid) {
      const at = Math.round(toNumber(nth(a, 1)))
      const v = (a.args[0] ?? [])[at - 1]
      return v === undefined ? err('#REF!') : v
    }
    const rowIndex = Math.round(toNumber(nth(a, 1)))
    const colIndex = a.args[2] ? Math.round(toNumber(nth(a, 2))) : 1
    // A one-column range indexes by row even when only one number is given.
    const row = grid[rowIndex - 1]
    if (!row) return err('#REF!')
    const cell = row[colIndex - 1]
    return cell === undefined ? err('#REF!') : cell
  },
  XLOOKUP: (a) => {
    const needle = nth(a, 0)
    const haystack = a.args[1] ?? []
    const results = a.args[2] ?? []
    const at = haystack.findIndex((v) => looseEquals(v, needle))
    if (at < 0) return a.args[3] ? nth(a, 3) : err('#N/A')
    const cell = results[at]
    return cell === undefined ? err('#REF!') : cell
  },
}

/** Merge caller-supplied functions over the built-ins. Keys are uppercased so
 *  a consumer can register `myFn` and write `=MYFN()`. */
export function withCustomFunctions(
  custom: Record<string, SheetFunction> | undefined,
): Record<string, SheetFunction> {
  if (!custom) return FUNCTIONS
  const out: Record<string, SheetFunction> = { ...FUNCTIONS }
  for (const [name, fn] of Object.entries(custom)) out[name.toUpperCase()] = fn
  return out
}

export { isError }
