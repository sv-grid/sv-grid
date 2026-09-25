/**
 * Excel's Database family: the twelve aggregates that read a labelled
 * block of records through a labelled block of criteria.
 *
 * All twelve share one shape, `D<agg>(database, field, criteria)`, and all
 * the interesting behaviour is in how the criteria block is read:
 *
 *   - Its first row is header names, matched against the database's own
 *     headers by text, ignoring case. A header the database does not have
 *     matches nothing.
 *   - Every row UNDER the header is one alternative: the conditions across
 *     a row are ANDed, and the rows are ORed. That is Excel's advanced
 *     filter grammar, and it is why the criteria block is two-dimensional
 *     rather than a list.
 *   - An empty criteria cell places no condition, so a criteria block that
 *     is nothing but headers matches every record.
 *
 * `field` is either a header's text or its one-based position. Excel takes
 * both, and a model built by hand usually holds the text while one built
 * by a formula holds the number.
 *
 * These are the only aggregates that need the 2-D shape of their range
 * rather than its flattened values, so they read `a.grids` throughout.
 */
import { err, isError, type CellValue } from '../ast'
import { toText, matchesCriterion, numericOnly, isBlank } from '../coerce'
import type { FnArgs, SheetFunction } from '../functions'

type Grid = ReadonlyArray<ReadonlyArray<CellValue>>

const nth = (a: FnArgs, i: number): CellValue => a.args[i]?.[0] ?? ''

/** A header row into a lookup from its lower-cased label to its column. */
function headerIndex(header: ReadonlyArray<CellValue>): Map<string, number> {
  const out = new Map<string, number>()
  header.forEach((label, i) => {
    const key = toText(label).trim().toLowerCase()
    // The first of a duplicated label wins, as Excel's own resolution does.
    if (key !== '' && !out.has(key)) out.set(key, i)
  })
  return out
}

/** The column `field` names, or -1 when it names none. */
function fieldColumn(field: CellValue, header: ReadonlyArray<CellValue>): number {
  if (typeof field === 'number') {
    const at = Math.trunc(field) - 1
    return at >= 0 && at < header.length ? at : -1
  }
  const key = toText(field).trim().toLowerCase()
  return headerIndex(header).get(key) ?? -1
}

/**
 * The records that satisfy the criteria block, as rows of the database.
 *
 * A criteria row with every cell blank matches everything, which is what
 * Excel does and what makes a criteria block of headers alone a no-op.
 */
function selected(database: Grid, criteria: Grid): Array<ReadonlyArray<CellValue>> {
  const dbHeader = database[0] ?? []
  const index = headerIndex(dbHeader)
  const critHeader = criteria[0] ?? []
  const records = database.slice(1)
  const rules = criteria.slice(1)
  if (rules.length === 0) return [...records]

  // Each criteria row becomes a list of (column, condition) pairs once,
  // rather than once per record.
  const alternatives = rules.map((row) =>
    critHeader.flatMap((label, c) => {
      const condition = row[c]
      if (condition === undefined || isBlank(condition)) return []
      const column = index.get(toText(label).trim().toLowerCase())
      // A criteria header the database does not carry can never match.
      return [{ column: column ?? -1, condition }]
    }),
  )

  return records.filter((record) =>
    alternatives.some((row) =>
      row.every(({ column, condition }) =>
        column >= 0 && matchesCriterion(record[column] ?? '', condition),
      ),
    ),
  )
}

/** The values of `field` across the records that match. */
function column(a: FnArgs): CellValue[] | CellValue {
  const database = a.grids[0]
  const criteria = a.grids[2]
  if (!database || !criteria) return err('#VALUE!')
  const header = database[0] ?? []
  const at = fieldColumn(nth(a, 1), header)
  if (at < 0) return err('#VALUE!')
  const out: CellValue[] = []
  for (const record of selected(database, criteria)) {
    const v = record[at] ?? ''
    if (isError(v)) return v
    out.push(v)
  }
  return out
}

/** Wrap an aggregate so it sees only the matching values. */
const over = (agg: (values: CellValue[]) => CellValue): SheetFunction => (a) => {
  const values = column(a)
  return Array.isArray(values) ? agg(values) : values
}

/** The same, over the numbers among them, with Excel's empty-set answer. */
const overNumbers = (
  agg: (values: number[]) => CellValue,
  empty: CellValue = err('#NUM!'),
): SheetFunction =>
  over((values) => {
    const ns = numericOnly(values)
    return ns.length === 0 ? empty : agg(ns)
  })

function variance(values: number[], sample: boolean): CellValue {
  const n = values.length
  if (n < (sample ? 2 : 1)) return err('#DIV/0!')
  const mean = values.reduce((x, y) => x + y, 0) / n
  const ss = values.reduce((acc, v) => acc + (v - mean) ** 2, 0)
  return ss / (sample ? n - 1 : n)
}

const stdev = (values: number[], sample: boolean): CellValue => {
  const v = variance(values, sample)
  return typeof v === 'number' ? Math.sqrt(v) : v
}

export const DATABASE_FUNCTIONS: Record<string, SheetFunction> = {
  DSUM: overNumbers((ns) => ns.reduce((x, y) => x + y, 0), 0),
  DPRODUCT: overNumbers((ns) => ns.reduce((x, y) => x * y, 1), 0),
  DAVERAGE: overNumbers((ns) => ns.reduce((x, y) => x + y, 0) / ns.length, err('#DIV/0!')),
  DMAX: overNumbers((ns) => Math.max(...ns), 0),
  DMIN: overNumbers((ns) => Math.min(...ns), 0),
  // DCOUNT counts the numbers; DCOUNTA counts anything that is not blank.
  DCOUNT: over((values) => numericOnly(values).length),
  DCOUNTA: over((values) => values.filter((v) => !isBlank(v)).length),
  DSTDEV: overNumbers((ns) => stdev(ns, true), err('#DIV/0!')),
  DSTDEVP: overNumbers((ns) => stdev(ns, false), err('#DIV/0!')),
  DVAR: overNumbers((ns) => variance(ns, true), err('#DIV/0!')),
  DVARP: overNumbers((ns) => variance(ns, false), err('#DIV/0!')),
  // DGET is the odd one: it wants exactly one match, and says so when the
  // count is anything else.
  DGET: over((values) => {
    const found = values.filter((v) => !isBlank(v))
    if (found.length === 0) return err('#VALUE!')
    if (found.length > 1) return err('#NUM!')
    return found[0]!
  }),
}

/** Exported for the tests, which check the criteria grammar on its own. */
export const __selectRecords = selected

/** Exported for the tests: `field` resolution takes text or a position. */
export const __fieldColumn = fieldColumn
