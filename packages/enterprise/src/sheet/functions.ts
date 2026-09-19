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
import { isError, err, type CellValue } from './ast'
import {
  toNumber, toBool, toText, looseEquals, compare,
  numericOnly, isBlank, toDate, isoDate as iso,
  criteriaHits, multiCriteriaHits, criteriaPairs,
} from './coerce'
import { formatWithPattern } from './number-format'
import { FINANCIAL_FUNCTIONS } from './packs/financial'
import { MATH_STATS_FUNCTIONS } from './packs/math-stats'
import { TEXT_DATE_FUNCTIONS } from './packs/text-date'

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
  POWER: (a) => {
    // The cube root of a negative is NaN in JavaScript and #NUM! in Excel;
    // letting NaN out reaches the sheet as a blank, which says nothing.
    const out = Math.pow(toNumber(nth(a, 0)), toNumber(nth(a, 1)))
    return Number.isFinite(out) ? out : err('#NUM!')
  },
  /** Excel's NA(): the #N/A a lookup writes when it finds nothing. */
  NA: () => err('#N/A'),
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
    return sum(multiCriteriaHits(criteriaPairs(a.args, 1)).map((i) => target[i] ?? ''))
  },
  COUNTIFS: (a) => multiCriteriaHits(criteriaPairs(a.args, 0)).length,

  // ---- Logical ---------------------------------------------------------
  NOT: (a) => !toBool(first(a)),
  AND: (a) => a.flat.every((v) => toBool(v)),
  OR: (a) => a.flat.some((v) => toBool(v)),
  XOR: (a) => a.flat.filter((v) => toBool(v)).length % 2 === 1,

  // ---- Information -----------------------------------------------------
  // What a value IS, not what it can be coerced to: "12" typed as text is
  // text here, the way Excel answers, and a blank is neither.
  ISNUMBER: (a) => typeof first(a) === 'number',
  ISTEXT: (a) => typeof first(a) === 'string' && first(a) !== '',
  ISLOGICAL: (a) => typeof first(a) === 'boolean',
  ISBLANK: (a) => first(a) === '',

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
  // Excel's HYPERLINK shows the friendly name and follows the link. The
  // shell reads the link off the cell (`sheet/links.ts`), which is where a
  // link put there by Insert > Link lives too, so a cell is clickable
  // whichever way its link arrived; the value here is only what it shows.
  HYPERLINK: (a) => {
    const target = toText(first(a))
    const friendly = a.args.length > 1 ? nth(a, 1) : undefined
    return friendly === undefined || friendly === '' ? target : friendly
  },
  /**
   * IMAGE(source, [alt]): a picture IN the cell. The value is the source,
   * so the formula reads like any other one and a cell that reads it gets
   * an address rather than a picture it cannot use; the shell is what
   * draws it, from the call it finds on the cell (`sheet/cell-images.ts`).
   */
  IMAGE: (a) => toText(first(a)),
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
  /**
   * TEXT(value, format): the value through a number-format string, which is
   * the same grammar a cell's own format speaks. It reads dates, fractions,
   * elapsed time and the rest, since it is the same compiler; a colour in
   * the pattern is ignored, as Excel ignores it here, and an empty pattern
   * is an empty string.
   */
  TEXT: (a) => {
    const pattern = toText(nth(a, 1))
    if (pattern === '') return ''
    return formatWithPattern(first(a), pattern)
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
  // DAYS(end, start): whole days, negative when the end comes first.
  DAYS: (a) => Math.round((toDate(nth(a, 0)).getTime() - toDate(nth(a, 1)).getTime()) / 86400000),
  // DATEDIF(start, end, unit): Excel's "d", "m" and "y", completed units
  // only, and #NUM! when the start comes after the end, as Excel gives.
  DATEDIF: (a) => {
    const start = toDate(nth(a, 0))
    const end = toDate(nth(a, 1))
    if (end.getTime() < start.getTime()) return err('#NUM!')
    const unit = toText(nth(a, 2)).toUpperCase()
    if (unit === 'D') return Math.floor((end.getTime() - start.getTime()) / 86400000)
    let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth())
    if (end.getUTCDate() < start.getUTCDate()) months -= 1
    if (unit === 'M') return months
    if (unit === 'Y') return Math.floor(months / 12)
    return err('#NUM!')
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
    const given = Math.round(toNumber(nth(a, 1)))
    // With one number, a one-column range indexes by row and a one-row range
    // by column, as Excel does: =INDEX(B4:D4, 2) is the second scenario
    // heading, not #REF!.
    const oneRow = grid.length === 1 && !a.args[2]
    const rowIndex = oneRow ? 1 : given
    const colIndex = oneRow ? given : a.args[2] ? Math.round(toNumber(nth(a, 2))) : 1
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

  // ---- The packs: financial, more math and statistics, more text and
  // date. Each lives in its own module under ./packs so this table stays
  // readable; all of them are on by default, as a sheet user expects PMT
  // to work without registering anything.
  ...FINANCIAL_FUNCTIONS,
  ...MATH_STATS_FUNCTIONS,
  ...TEXT_DATE_FUNCTIONS,
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
