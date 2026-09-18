/**
 * The array pack: Excel's dynamic array functions, the ones whose answer
 * is a grid rather than a value. FILTER, UNIQUE, SORT, SORTBY, SEQUENCE,
 * TRANSPOSE and TEXTSPLIT. Each takes its arguments the way every other
 * function does (`FnArgs`, with the 2-D shape of a range in `grids`) and
 * returns `CellValue[][]`; the evaluator spills a grid over the cells
 * below and to the right of the formula, or reads its top-left cell where
 * only a value fits. A grid with nothing in it is `#CALC!`, as in Excel.
 */
import { isError, err, type CellValue } from '../ast'
import { toNumber, toBool, toText, compare, isBlank } from '../coerce'
import type { FnArgs } from '../functions'

export type Grid = CellValue[][]
export type ArrayFunction = (a: FnArgs) => Grid | CellValue

/** The i-th argument as a grid: a range keeps its shape, a value is 1 x 1. */
export function gridArg(a: FnArgs, i: number): Grid | null {
  const grid = a.grids[i]
  if (grid) return grid.map((row) => [...row])
  const list = a.args[i]
  return list === undefined ? null : [[list[0] ?? '']]
}

const scalar = (a: FnArgs, i: number): CellValue => a.args[i]?.[0] ?? ''
const given = (a: FnArgs, i: number): boolean => a.args[i] !== undefined && !(a.args[i]!.length === 1 && a.args[i]![0] === '')

/** The values of a 1-D array, whichever way it runs. */
const line = (grid: Grid): CellValue[] => (grid.length === 1 ? [...grid[0]!] : grid.map((row) => row[0] ?? ''))

const transpose = (grid: Grid): Grid => {
  const cols = grid.reduce((m, row) => Math.max(m, row.length), 0)
  return Array.from({ length: cols }, (_, c) => grid.map((row) => row[c] ?? ''))
}

const rowsEqual = (a: ReadonlyArray<CellValue>, b: ReadonlyArray<CellValue>): boolean =>
  a.length === b.length && a.every((v, i) => compare(v, b[i]!) === 0 && typeof v === typeof b[i])

/** Rows of `grid` in the order `keys` says, a stable sort. */
function sortRows(grid: Grid, keys: ReadonlyArray<{ values: ReadonlyArray<CellValue>; descending: boolean }>): Grid {
  const index = grid.map((_, i) => i)
  index.sort((x, y) => {
    for (const key of keys) {
      const a = key.values[x] ?? ''
      const b = key.values[y] ?? ''
      const blankA = isBlank(a)
      const blankB = isBlank(b)
      // Blanks sort last whichever way, as Excel's SORT puts them.
      if (blankA !== blankB) return blankA ? 1 : -1
      const d = compare(a, b)
      if (d !== 0) return key.descending ? -d : d
    }
    return x - y
  })
  return index.map((i) => grid[i]!)
}

const empty = (): CellValue => err('#CALC!')

export const ARRAY_FUNCTIONS: Record<string, ArrayFunction> = {
  /** FILTER(array, include, [if_empty]): the rows (or columns) where include is true. */
  FILTER: (a) => {
    const array = gridArg(a, 0)
    const include = gridArg(a, 1)
    if (!array || !include) return err('#VALUE!')
    const flags = line(include)
    const byRows = include.length > 1 || (include.length === 1 && include[0]!.length === 1 && array.length === 1)
    const along = byRows && include.length !== 1 ? 'rows' : include[0]!.length > 1 ? 'cols' : 'rows'
    const count = along === 'rows' ? array.length : (array[0]?.length ?? 0)
    if (flags.length !== count) return err('#VALUE!')
    for (const f of flags) if (isError(f)) return f
    const keep = flags.map((f) => toBool(f))
    const out = along === 'rows' ? array.filter((_, i) => keep[i]) : array.map((row) => row.filter((_, i) => keep[i]))
    if (!out.length || !out[0]!.length) return given(a, 2) ? scalar(a, 2) : empty()
    return out
  },

  /** UNIQUE(array, [by_col], [exactly_once]): the distinct rows, first seen first. */
  UNIQUE: (a) => {
    const array = gridArg(a, 0)
    if (!array) return err('#VALUE!')
    const byCol = given(a, 1) && toBool(scalar(a, 1))
    const once = given(a, 2) && toBool(scalar(a, 2))
    const rows = byCol ? transpose(array) : array
    const counts = rows.map((row) => rows.filter((other) => rowsEqual(row, other)).length)
    const out: Grid = []
    rows.forEach((row, i) => {
      if (once ? counts[i] === 1 : !out.some((seen) => rowsEqual(seen, row))) out.push([...row])
    })
    if (!out.length) return empty()
    return byCol ? transpose(out) : out
  },

  /** SORT(array, [sort_index], [sort_order], [by_col]). */
  SORT: (a) => {
    const array = gridArg(a, 0)
    if (!array) return err('#VALUE!')
    const index = given(a, 1) ? Math.trunc(toNumber(scalar(a, 1))) : 1
    const order = given(a, 2) ? Math.trunc(toNumber(scalar(a, 2))) : 1
    const byCol = given(a, 3) && toBool(scalar(a, 3))
    if (index < 1 || (order !== 1 && order !== -1)) return err('#VALUE!')
    const rows = byCol ? transpose(array) : array
    if (index > (rows[0]?.length ?? 0)) return err('#VALUE!')
    const sorted = sortRows(rows, [{ values: rows.map((row) => row[index - 1] ?? ''), descending: order === -1 }])
    return byCol ? transpose(sorted) : sorted
  },

  /** SORTBY(array, by_array1, [order1], [by_array2, order2], ...). */
  SORTBY: (a) => {
    const array = gridArg(a, 0)
    if (!array) return err('#VALUE!')
    const keys: Array<{ values: CellValue[]; descending: boolean }> = []
    for (let i = 1; i < a.args.length; i += 2) {
      const by = gridArg(a, i)
      if (!by) return err('#VALUE!')
      const values = line(by)
      if (values.length !== array.length) return err('#VALUE!')
      const order = given(a, i + 1) ? Math.trunc(toNumber(scalar(a, i + 1))) : 1
      if (order !== 1 && order !== -1) return err('#VALUE!')
      keys.push({ values, descending: order === -1 })
    }
    if (!keys.length) return err('#VALUE!')
    return sortRows(array, keys)
  },

  /** SEQUENCE(rows, [columns], [start], [step]). */
  SEQUENCE: (a) => {
    const rows = Math.trunc(toNumber(scalar(a, 0)))
    const cols = given(a, 1) ? Math.trunc(toNumber(scalar(a, 1))) : 1
    const start = given(a, 2) ? toNumber(scalar(a, 2)) : 1
    const step = given(a, 3) ? toNumber(scalar(a, 3)) : 1
    if (rows < 1 || cols < 1) return err('#VALUE!')
    if (rows * cols > 1_000_000) return err('#NUM!')
    let n = start
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => { const v = n; n += step; return v }))
  },

  /** TRANSPOSE(array). */
  TRANSPOSE: (a) => {
    const array = gridArg(a, 0)
    if (!array) return err('#VALUE!')
    return transpose(array)
  },

  /** TEXTSPLIT(text, col_delimiter, [row_delimiter], [ignore_empty]). */
  TEXTSPLIT: (a) => {
    const text = scalar(a, 0)
    if (isError(text)) return text
    const colDelim = given(a, 1) ? toText(scalar(a, 1)) : ''
    const rowDelim = given(a, 2) ? toText(scalar(a, 2)) : ''
    const ignoreEmpty = given(a, 3) && toBool(scalar(a, 3))
    const split = (s: string, d: string): string[] => (d === '' ? [s] : s.split(d))
    const rows = split(toText(text), rowDelim).map((row) => split(row, colDelim))
    const kept = ignoreEmpty ? rows.map((row) => row.filter((v) => v !== '')).filter((row) => row.length) : rows
    if (!kept.length) return empty()
    const width = kept.reduce((m, row) => Math.max(m, row.length), 0)
    return kept.map((row) => Array.from({ length: width }, (_, i) => (i < row.length ? asValue(row[i]!) : err('#N/A'))))
  },
}

/** A piece of split text as the cell would read it: a number where it parses. */
function asValue(piece: string): CellValue {
  const t = piece.trim()
  if (t === '') return ''
  const n = Number(t)
  return Number.isFinite(n) ? n : piece
}
