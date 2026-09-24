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
  toNumber, toBool, toText, looseEquals, compare, patternEquals,
  hasWildcards, wildcardRegExp, unescapeWildcards,
  numericOnly, isBlank, toDate, isoDate as iso,
  criteriaHits, multiCriteriaHits, criteriaPairs,
} from './coerce'
import { formatWithPattern } from './number-format'
import { FINANCIAL_FUNCTIONS } from './packs/financial'
import { MATH_STATS_FUNCTIONS } from './packs/math-stats'
import { TEXT_DATE_FUNCTIONS } from './packs/text-date'
import { TRIG_FUNCTIONS } from './packs/trig'
import { ENGINEERING_FUNCTIONS } from './packs/engineering'
import { DATABASE_FUNCTIONS } from './packs/database'
import { STATS_DIST_FUNCTIONS } from './packs/stats-dist'

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


/**
 * Excel's approximate match, which is what the lookup family does when it
 * cannot find the value itself. The column is taken as sorted, and the answer
 * is the entry NEAREST the needle on one side: `dir` 1 for the largest entry
 * not past it (VLOOKUP / HLOOKUP with range_lookup TRUE, MATCH 1, XLOOKUP -1),
 * -1 for the smallest entry not before it (MATCH -1, XLOOKUP 1).
 *
 * Only cells of the needle's own type take part, so the text header sitting
 * above a numeric tier table cannot become the answer. Among equal entries the
 * later one wins, as Excel's own search lands on the last of a run.
 */
function nearestIndex(
  pool: ReadonlyArray<CellValue>,
  needle: CellValue,
  dir: 1 | -1,
): number {
  let best = -1
  for (let i = 0; i < pool.length; i += 1) {
    const v = pool[i]
    if (v === undefined || v === '' || isError(v)) continue
    if (typeof v !== typeof needle) continue
    const side = compare(v, needle)
    if (dir === 1 ? side > 0 : side < 0) continue
    if (best < 0 || compare(v, pool[best]!) * dir >= 0) best = i
  }
  return best
}


/** FIND and SEARCH count their optional start from 1; -1 says the argument
 *  is out of range, which Excel reports as #VALUE!. */
function startPosition(a: FnArgs): number {
  if (a.args[2] === undefined) return 0
  const given = Math.trunc(toNumber(nth(a, 2)))
  return given < 1 ? -1 : given - 1
}

/** The index of the `instance`-th `delim` in `s`, counted from the start for
 *  a positive instance and from the end for a negative one, or null when
 *  there are fewer than that many. Backs TEXTBEFORE and TEXTAFTER. */
function nthDelimiter(s: string, delim: string, instance: number): number | null {
  const positions: number[] = []
  for (let from = 0; ; ) {
    const at = s.indexOf(delim, from)
    if (at < 0) break
    positions.push(at)
    from = at + delim.length
  }
  if (instance > 0) return instance <= positions.length ? positions[instance - 1]! : null
  if (instance < 0) {
    const k = positions.length + instance
    return k >= 0 ? positions[k]! : null
  }
  return null
}


/** Where a wildcard pattern starts inside a text, or -1. Excel reports the
 *  earliest position a match can begin at, so the search walks forward and
 *  tries every ending from the shortest up. */
function wildcardSearch(text: string, pattern: string, from = 0): number {
  const re = wildcardRegExp(pattern)
  for (let start = from; start <= text.length; start += 1) {
    for (let end = start; end <= text.length; end += 1) {
      if (re.test(text.slice(start, end))) return start
    }
  }
  return -1
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
  // Excel's TRUE() and FALSE(). Worth having for their own sake, and a file
  // from LibreOffice writes every boolean cell as one of them.
  TRUE: () => true,
  FALSE: () => false,
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
  // SUBSTITUTE(text, old, new, [instance]): every occurrence by default, or
  // just the instance-th one when the fourth argument names it, the way Excel
  // rewrites the second slash of a date and leaves the first.
  SUBSTITUTE: (a) => {
    const s = toText(nth(a, 0))
    const find = toText(nth(a, 1))
    const replace = toText(nth(a, 2))
    if (find === '') return s
    if (a.args[3] === undefined) return s.split(find).join(replace)
    const instance = Math.trunc(toNumber(nth(a, 3)))
    if (instance < 1) return err('#VALUE!')
    let count = 0
    let from = 0
    for (;;) {
      const at = s.indexOf(find, from)
      // Fewer than `instance` occurrences: Excel leaves the text as it is.
      if (at < 0) return s
      count += 1
      if (count === instance) return s.slice(0, at) + replace + s.slice(at + find.length)
      from = at + find.length
    }
  },
  // TEXTBEFORE / TEXTAFTER(text, delimiter, [instance]): the part before or
  // after the instance-th delimiter, counted from the end when instance is
  // negative. The delimiter that is not there is #N/A, unless a sixth
  // `if_not_found` is given.
  TEXTBEFORE: (a) => {
    const s = toText(nth(a, 0))
    const delim = toText(nth(a, 1))
    const instance = a.args[2] !== undefined ? Math.trunc(toNumber(nth(a, 2))) : 1
    if (delim === '') return ''
    const at = nthDelimiter(s, delim, instance)
    return at === null ? (a.args[5] !== undefined ? nth(a, 5) : err('#N/A')) : s.slice(0, at)
  },
  TEXTAFTER: (a) => {
    const s = toText(nth(a, 0))
    const delim = toText(nth(a, 1))
    const instance = a.args[2] !== undefined ? Math.trunc(toNumber(nth(a, 2))) : 1
    if (delim === '') return s
    const at = nthDelimiter(s, delim, instance)
    return at === null ? (a.args[5] !== undefined ? nth(a, 5) : err('#N/A')) : s.slice(at + delim.length)
  },
  // DOLLAR / FIXED(number, [decimals], [no_commas]): a number as the text of
  // a currency or a fixed-decimal figure, grouped in thousands. DOLLAR wraps
  // a negative in parentheses; a negative decimals rounds to the left of the
  // point, so DOLLAR(1234.5, -2) is "$1,200".
  DOLLAR: (a) => {
    const decimals = a.args[1] !== undefined ? Math.trunc(toNumber(nth(a, 1))) : 2
    const rounded = roundTo(toNumber(nth(a, 0)), decimals)
    const places = Math.max(decimals, 0)
    const body = `$${Math.abs(rounded).toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places })}`
    return rounded < 0 ? `(${body})` : body
  },
  FIXED: (a) => {
    const decimals = a.args[1] !== undefined ? Math.trunc(toNumber(nth(a, 1))) : 2
    const noCommas = a.args[2] !== undefined && toBool(nth(a, 2))
    const rounded = roundTo(toNumber(nth(a, 0)), decimals)
    const places = Math.max(decimals, 0)
    return noCommas
      ? rounded.toFixed(places)
      : rounded.toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places })
  },
  // COMBIN / PERMUT(n, k): the ways to choose k of n, unordered and ordered.
  // The product form keeps the intermediate values small, so a big n does not
  // overflow the way n! would.
  COMBIN: (a) => {
    const n = Math.trunc(toNumber(nth(a, 0)))
    const k = Math.trunc(toNumber(nth(a, 1)))
    if (n < 0 || k < 0 || k > n) return err('#NUM!')
    let result = 1
    for (let i = 0; i < k; i += 1) result = (result * (n - i)) / (i + 1)
    return Math.round(result)
  },
  PERMUT: (a) => {
    const n = Math.trunc(toNumber(nth(a, 0)))
    const k = Math.trunc(toNumber(nth(a, 1)))
    if (n < 0 || k < 0 || k > n) return err('#NUM!')
    let result = 1
    for (let i = 0; i < k; i += 1) result *= n - i
    return result
  },
  // TYPE(value): 1 a number, 2 text, 4 a logical, 16 an error, 64 an array.
  TYPE: (a) => {
    const grid = a.grids[0]
    if (grid && (grid.length > 1 || (grid[0]?.length ?? 0) > 1)) return 64
    const v = nth(a, 0)
    if (isError(v)) return 16
    if (typeof v === 'number') return 1
    if (typeof v === 'boolean') return 4
    return 2
  },
  // FIND(find, within, [start]): case sensitive, 1-based, #VALUE! when the
  // text is not there. The third argument is where the search BEGINS, and
  // the answer is still counted from the start of the text, which is what
  // makes the walk over every occurrence work.
  FIND: (a) => {
    const from = startPosition(a)
    if (from < 0) return err('#VALUE!')
    const at = toText(nth(a, 1)).indexOf(toText(nth(a, 0)), from)
    return at < 0 ? err('#VALUE!') : at + 1
  },
  // SEARCH is FIND's case-insensitive twin, and unlike FIND it reads Excel's
  // wildcards: =SEARCH("n?rth", A1) finds either spelling.
  SEARCH: (a) => {
    const needle = toText(nth(a, 0))
    const hay = toText(nth(a, 1))
    const from = startPosition(a)
    if (from < 0) return err('#VALUE!')
    if (hasWildcards(needle)) {
      const at = wildcardSearch(hay, needle, from)
      return at < 0 ? err('#VALUE!') : at + 1
    }
    const at = hay.toLowerCase().indexOf(unescapeWildcards(needle).toLowerCase(), from)
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
  // DATEDIF(start, end, unit): Excel's six units - "d", "m", "y" for the
  // whole difference, and "md", "ym", "yd" for the part left when the higher
  // units are set aside, which is how an age reads "y years, m months, d
  // days". #NUM! when the start comes after the end, as Excel gives.
  DATEDIF: (a) => {
    const start = toDate(nth(a, 0))
    const end = toDate(nth(a, 1))
    if (end.getTime() < start.getTime()) return err('#NUM!')
    const unit = toText(nth(a, 2)).toUpperCase()
    const day = 86400000
    if (unit === 'D') return Math.floor((end.getTime() - start.getTime()) / day)
    let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth())
    if (end.getUTCDate() < start.getUTCDate()) months -= 1
    if (unit === 'M') return months
    if (unit === 'Y') return Math.floor(months / 12)
    // Months ignoring years: the month part of the whole difference.
    if (unit === 'YM') return months % 12
    // Days ignoring months and years: the days past the last whole month.
    // Anchoring `months` months onto the start, its day clamped to that
    // month's length, keeps the count from going negative on the awkward
    // month-end cases Excel itself is inconsistent about (Jan 31 -> Mar 1).
    if (unit === 'MD') {
      const anchorMonth = start.getUTCMonth() + months
      const lastDay = new Date(Date.UTC(start.getUTCFullYear(), anchorMonth + 1, 0)).getUTCDate()
      const anchorDay = Math.min(start.getUTCDate(), lastDay)
      const anchor = Date.UTC(start.getUTCFullYear(), anchorMonth, anchorDay)
      return Math.floor((end.getTime() - anchor) / day)
    }
    // Days ignoring years: the days between, with the start moved to end's
    // year (or the year before, when that would overshoot the end).
    if (unit === 'YD') {
      let anchor = Date.UTC(end.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
      if (anchor > end.getTime()) anchor = Date.UTC(end.getUTCFullYear() - 1, start.getUTCMonth(), start.getUTCDate())
      return Math.floor((end.getTime() - anchor) / day)
    }
    return err('#NUM!')
  },

  // ---- Lookup ----------------------------------------------------------
  // VLOOKUP(lookup, table, colIndex, [rangeLookup]). The fourth argument is
  // Excel's range_lookup and it defaults to TRUE: the banded lookup - tax
  // brackets, commission tiers, a grade table - is the DEFAULT reading, and
  // FALSE is how you ask for an exact match.
  VLOOKUP: (a) => {
    const needle = nth(a, 0)
    const grid = a.grids[1]
    if (!grid) return err('#REF!')
    const col = Math.round(toNumber(nth(a, 2)))
    if (col < 1) return err('#VALUE!')
    const keys = grid.map((row) => row[0] ?? '')
    const exact = a.args[3] !== undefined && !toBool(nth(a, 3))
    const at = exact
      ? keys.findIndex((v) => patternEquals(v, needle))
      : nearestIndex(keys, needle, 1)
    if (at < 0) return err('#N/A')
    const cell = grid[at]![col - 1]
    return cell === undefined ? err('#REF!') : cell
  },
  // HLOOKUP reads the same way, along the header row instead of down the
  // first column.
  HLOOKUP: (a) => {
    const needle = nth(a, 0)
    const grid = a.grids[1]
    if (!grid) return err('#REF!')
    const rowIndex = Math.round(toNumber(nth(a, 2)))
    if (rowIndex < 1) return err('#VALUE!')
    const header = grid[0] ?? []
    const exact = a.args[3] !== undefined && !toBool(nth(a, 3))
    const at = exact
      ? header.findIndex((v) => patternEquals(v, needle))
      : nearestIndex(header, needle, 1)
    if (at < 0) return err('#N/A')
    const cell = grid[rowIndex - 1]?.[at]
    return cell === undefined ? err('#REF!') : cell
  },
  MATCH: (a) => {
    const needle = nth(a, 0)
    const pool = a.args[1] ?? []
    const mode = a.args[2] ? Math.round(toNumber(nth(a, 2))) : 1
    if (mode === 0) {
      // An exact match takes Excel's wildcards: =MATCH("North*", ...).
      const at = pool.findIndex((v) => patternEquals(v, needle))
      return at < 0 ? err('#N/A') : at + 1
    }
    // Ordered search: 1 wants the last value not past the needle in an
    // ascending range, -1 the last value not before it in a descending one.
    const best = nearestIndex(pool, needle, mode === 1 ? 1 : -1)
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
  // XLOOKUP(lookup, haystack, results, [ifMissing], [matchMode], [searchMode]).
  // matchMode 0 is the exact match it defaults to, -1 falls back to the next
  // smaller item, 1 to the next larger one and 2 reads the value as a wildcard
  // pattern; a negative searchMode reads the range from the end, which is how
  // you pick the LAST of several matches.
  XLOOKUP: (a) => {
    const needle = nth(a, 0)
    const haystack = a.args[1] ?? []
    const results = a.args[2] ?? []
    const mode = a.args[4] !== undefined ? Math.round(toNumber(nth(a, 4))) : 0
    const back = a.args[5] !== undefined && Math.round(toNumber(nth(a, 5))) < 0
    // Unlike the older lookups, XLOOKUP reads wildcards only when asked:
    // match mode 2.
    const same = mode === 2
      ? (v: CellValue) => patternEquals(v, needle)
      : (v: CellValue) => looseEquals(v, needle)
    let at = -1
    for (let i = 0; i < haystack.length; i += 1) {
      const j = back ? haystack.length - 1 - i : i
      if (same(haystack[j]!)) { at = j; break }
    }
    if (at < 0 && mode === -1) at = nearestIndex(haystack, needle, 1)
    if (at < 0 && mode === 1) at = nearestIndex(haystack, needle, -1)
    if (at < 0) return a.args[3] !== undefined ? nth(a, 3) : err('#N/A')
    const cell = results[at]
    return cell === undefined ? err('#REF!') : cell
  },
  // LOOKUP(value, vector, [result]): the old approximate lookup that assumes
  // its vector is sorted ascending and takes the largest item not past the
  // value, returning the matching cell of the result vector - the lookup
  // vector itself when none is given.
  LOOKUP: (a) => {
    const needle = nth(a, 0)
    const vector = a.args[1] ?? []
    const result = a.args[2] ?? vector
    const at = nearestIndex(vector, needle, 1)
    if (at < 0) return err('#N/A')
    const cell = result[at]
    return cell === undefined ? err('#N/A') : cell
  },
  // XMATCH(value, array, [matchMode], [searchMode]): MATCH's modern twin.
  // matchMode 0 is the exact default, -1 falls back to the next smaller item,
  // 1 to the next larger, 2 reads a wildcard; a negative searchMode reads from
  // the end, so it finds the LAST of several matches.
  XMATCH: (a) => {
    const needle = nth(a, 0)
    const pool = a.args[1] ?? []
    const mode = a.args[2] !== undefined ? Math.round(toNumber(nth(a, 2))) : 0
    const back = a.args[3] !== undefined && Math.round(toNumber(nth(a, 3))) < 0
    const same = mode === 2
      ? (v: CellValue) => patternEquals(v, needle)
      : (v: CellValue) => looseEquals(v, needle)
    let at = -1
    for (let i = 0; i < pool.length; i += 1) {
      const j = back ? pool.length - 1 - i : i
      if (same(pool[j]!)) { at = j; break }
    }
    if (at < 0 && mode === -1) at = nearestIndex(pool, needle, 1)
    if (at < 0 && mode === 1) at = nearestIndex(pool, needle, -1)
    return at < 0 ? err('#N/A') : at + 1
  },

  // ---- The packs: financial, more math and statistics, more text and
  // date. Each lives in its own module under ./packs so this table stays
  // readable; all of them are on by default, as a sheet user expects PMT
  // to work without registering anything.
  ...FINANCIAL_FUNCTIONS,
  ...MATH_STATS_FUNCTIONS,
  ...TEXT_DATE_FUNCTIONS,
  ...TRIG_FUNCTIONS,
  ...ENGINEERING_FUNCTIONS,
  ...DATABASE_FUNCTIONS,
  ...STATS_DIST_FUNCTIONS,
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
