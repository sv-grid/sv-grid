import { describe, expect, it } from 'vitest'
import {
  createTableRegistry, isValidTableName, resolveTableRange, columnIndexOf,
  rowCountOf, shiftTable, shiftTables, type TableRegion,
} from './tables'
import { parseFormula } from './parse'
import { evaluate, type EvalContext } from './evaluate'
import { withCustomFunctions } from './functions'
import { formatFormula } from './refs'
import type { CellValue, Node } from './ast'

/** Orders: header on row 0, data rows 1-3, columns A-C. */
const orders: TableRegion = {
  name: 'Orders', sheet: 'S', headerRow: 0,
  firstCol: 0, lastCol: 2, lastRow: 3, hasTotals: false,
}

const grid: CellValue[][] = [
  ['Item', 'Qty', 'Amount'],
  ['Bolt', 2, 10],
  ['Nut', 3, 20],
  ['Screw', 5, 30],
  ['', '', 60],
]

function ctxAt(
  cell: { row: number; col: number } | null,
  tables: TableRegion[] = [orders],
): EvalContext {
  const registry = createTableRegistry(tables)
  return {
    resolve: (_s, r, c) => {
      if (r < 0 || r >= grid.length) return { error: '#REF!' }
      const row = grid[r]!
      if (c < 0 || c >= row.length) return { error: '#REF!' }
      return row[c] ?? ''
    },
    lastRow: () => grid.length - 1,
    functions: withCustomFunctions(undefined),
    findTable: (n) => registry.get(n),
    tableAt: (s, r, c) => registry.at(s ?? 'S', r, c),
    ...(cell ? { currentCell: { sheet: 'S', row: cell.row, col: cell.col } } : {}),
  }
}

const run = (src: string, cell: { row: number; col: number } | null = null, tables?: TableRegion[]) =>
  evaluate(parseFormula(src), ctxAt(cell, tables))

describe('isValidTableName', () => {
  it('accepts a name and rejects a reference', () => {
    expect(isValidTableName('Orders')).toBe(true)
    expect(isValidTableName('_t1')).toBe(true)
    expect(isValidTableName('A1')).toBe(false)
    expect(isValidTableName('R')).toBe(false)
    expect(isValidTableName('has space')).toBe(false)
  })
})

describe('the registry', () => {
  it('finds by name, case-insensitively', () => {
    const r = createTableRegistry([orders])
    expect(r.get('orders')?.name).toBe('Orders')
  })

  it('finds the table containing a cell', () => {
    const r = createTableRegistry([orders])
    expect(r.at('S', 2, 1)?.name).toBe('Orders')
    expect(r.at('S', 9, 1)).toBeUndefined()
    expect(r.at('Other', 2, 1)).toBeUndefined()
  })

  it('includes the header row in the region', () => {
    const r = createTableRegistry([orders])
    expect(r.at('S', 0, 0)?.name).toBe('Orders')
  })

  it('grows to swallow the row right below the data', () => {
    const r = createTableRegistry([{ ...orders }])
    expect(r.growToInclude('S', 4, 0)).toBe(true)
    expect(r.get('Orders')!.lastRow).toBe(4)
  })

  it('does NOT grow for a write further down', () => {
    // A write five rows below is a separate thing the user put there, and
    // swallowing it would be worse than not expanding.
    const r = createTableRegistry([{ ...orders }])
    expect(r.growToInclude('S', 8, 0)).toBe(false)
    expect(r.get('Orders')!.lastRow).toBe(3)
  })

  it('does not grow into a totals row', () => {
    const r = createTableRegistry([{ ...orders, hasTotals: true }])
    expect(r.growToInclude('S', 4, 0)).toBe(false)
  })

  it('removes and lists', () => {
    const r = createTableRegistry([orders])
    expect(r.list()).toHaveLength(1)
    expect(r.remove('ORDERS')).toBe(true)
    expect(r.list()).toHaveLength(0)
  })

  it('refuses an invalid name', () => {
    expect(() => createTableRegistry([{ ...orders, name: 'A1' }])).toThrow(/not a valid table name/)
  })
})

describe('columnIndexOf', () => {
  const headerAt = (_s: string, r: number, c: number) => String(grid[r]?.[c] ?? '')

  it('finds a column by header, case-insensitively', () => {
    expect(columnIndexOf(orders, 'Amount', headerAt)).toBe(2)
    expect(columnIndexOf(orders, 'amount', headerAt)).toBe(2)
  })

  it('returns -1 for a header that is not there', () => {
    expect(columnIndexOf(orders, 'Nope', headerAt)).toBe(-1)
  })
})

describe('resolveTableRange', () => {
  it('#Data skips the header', () => {
    expect(resolveTableRange(orders, '#Data', null, null))
      .toEqual({ sheet: 'S', firstRow: 1, lastRow: 3, firstCol: 0, lastCol: 2 })
  })

  it('#Headers is the header row alone', () => {
    expect(resolveTableRange(orders, '#Headers', null, null)!.firstRow).toBe(0)
  })

  it('#All spans header through data', () => {
    const all = resolveTableRange(orders, '#All', null, null)!
    expect([all.firstRow, all.lastRow]).toEqual([0, 3])
  })

  it('#All includes a totals row when there is one', () => {
    const all = resolveTableRange({ ...orders, hasTotals: true }, '#All', null, null)!
    expect(all.lastRow).toBe(4)
  })

  it('#Totals is null without a totals row', () => {
    expect(resolveTableRange(orders, '#Totals', null, null)).toBeNull()
    expect(resolveTableRange({ ...orders, hasTotals: true }, '#Totals', null, null)!.firstRow).toBe(4)
  })

  it('#ThisRow needs a row, and one inside the data', () => {
    expect(resolveTableRange(orders, '#ThisRow', null, null)).toBeNull()
    expect(resolveTableRange(orders, '#ThisRow', null, 0)).toBeNull()
    expect(resolveTableRange(orders, '#ThisRow', null, 9)).toBeNull()
    expect(resolveTableRange(orders, '#ThisRow', null, 2)!.firstRow).toBe(2)
  })

  it('returns null for an EMPTY table rather than the header', () => {
    // Otherwise =SUM(Orders[Amount]) would add the word "Amount".
    const empty = { ...orders, lastRow: 0 }
    expect(resolveTableRange(empty, '#Data', null, null)).toBeNull()
  })

  it('narrows to a column span', () => {
    const r = resolveTableRange(orders, '#Data', { from: 1, to: 2 }, null)!
    expect([r.firstCol, r.lastCol]).toEqual([1, 2])
  })

  it('counts data rows', () => {
    expect(rowCountOf(orders)).toBe(3)
    expect(rowCountOf({ ...orders, lastRow: 0 })).toBe(0)
  })
})

describe('the grammar', () => {
  const parse = (src: string) => parseFormula(src) as Extract<Node, { k: 'table' }>

  it('reads a qualified column', () => {
    expect(parse('=Orders[Amount]')).toMatchObject({
      table: 'Orders', column: 'Amount', specifier: '#Data',
    })
  })

  it('reads the this-row form', () => {
    expect(parse('=Orders[@Amount]')).toMatchObject({
      table: 'Orders', column: 'Amount', specifier: '#ThisRow',
    })
  })

  it('reads the unqualified form', () => {
    expect(parse('=[@Amount]')).toMatchObject({ table: null, column: 'Amount', specifier: '#ThisRow' })
    expect(parse('=[Amount]')).toMatchObject({ table: null, column: 'Amount', specifier: '#Data' })
  })

  it('reads each specifier', () => {
    for (const [text, want] of [
      ['#All', '#All'], ['#Data', '#Data'], ['#Headers', '#Headers'], ['#Totals', '#Totals'],
    ] as const) {
      expect(parse(`=Orders[${text}]`).specifier).toBe(want)
    }
  })

  it('reads a specifier and a column together', () => {
    expect(parse('=Orders[[#Headers],[Amount]]')).toMatchObject({
      specifier: '#Headers', column: 'Amount',
    })
  })

  it('reads a column span', () => {
    expect(parse('=Orders[[Qty]:[Amount]]')).toMatchObject({
      column: 'Qty', columnTo: 'Amount',
    })
  })

  it('reads a bracketed column name containing a space', () => {
    expect(parse('=Orders[[Unit Price]]')).toMatchObject({ column: 'Unit Price' })
  })

  it('rejects an unclosed bracket', () => {
    expect(() => parseFormula('=Orders[Amount')).toThrow()
  })

  it('does not mistake a table for a function call', () => {
    const n = parseFormula('=SUM(Orders[Amount])') as Extract<Node, { k: 'fn' }>
    expect(n.k).toBe('fn')
    expect(n.args[0]!.k).toBe('table')
  })
})

describe('evaluating structured references', () => {
  it('sums a column', () => {
    expect(run('=SUM(Orders[Amount])')).toBe(60)
  })

  it('counts and averages a column', () => {
    expect(run('=COUNT(Orders[Qty])')).toBe(3)
    expect(run('=AVERAGE(Orders[Amount])')).toBe(20)
  })

  it('reads this row, relative to the FORMULA', () => {
    // Row 2 is the "Nut" row, so [@Amount] there is 20. The formula sits
    // INSIDE the table, which is the only place the unqualified form means
    // anything - Excel requires Orders[@Amount] from outside.
    expect(run('=[@Amount]', { row: 2, col: 1 })).toBe(20)
    expect(run('=[@Qty]', { row: 3, col: 1 })).toBe(5)
  })

  it('takes the qualified form from OUTSIDE the table', () => {
    // A total in the next column over is the common case, and there the
    // table has to be named.
    expect(run('=Orders[@Amount]', { row: 2, col: 9 })).toBe(20)
  })

  it('multiplies two columns of this row', () => {
    expect(run('=[@Qty]*[@Amount]', { row: 1, col: 1 })).toBe(20)
  })

  it('returns #REF! for the unqualified form outside any table', () => {
    expect(run('=[@Amount]', { row: 9, col: 9 })).toEqual({ error: '#REF!' })
  })

  it('returns #REF! for this-row on the header row', () => {
    expect(run('=Orders[@Amount]', { row: 0, col: 9 })).toEqual({ error: '#REF!' })
  })

  it('returns #REF! for the unqualified form with no current cell', () => {
    expect(run('=[@Amount]')).toEqual({ error: '#REF!' })
  })

  it('returns #REF! for a column that is not there', () => {
    // A renamed column is an ordinary thing to find in a sheet; one broken
    // total should not take the workbook with it.
    expect(run('=SUM(Orders[Nope])')).toEqual({ error: '#REF!' })
  })

  it('returns #REF! for a table that is not there', () => {
    expect(run('=SUM(Nope[Amount])')).toEqual({ error: '#REF!' })
  })

  it('reads the header text', () => {
    expect(run('=Orders[[#Headers],[Amount]]')).toBe('Amount')
  })

  it('sums a column span', () => {
    expect(run('=SUM(Orders[[Qty]:[Amount]])')).toBe(70)
  })

  it('sums the whole table, ignoring text', () => {
    expect(run('=SUM(Orders[#Data])')).toBe(70)
  })

  it('reads a totals row when the table has one', () => {
    const withTotals = [{ ...orders, hasTotals: true }]
    expect(run('=Orders[[#Totals],[Amount]]', null, withTotals)).toBe(60)
  })

  it('collapses to the top-left in scalar position', () => {
    expect(run('=Orders[Amount]+0')).toBe(10)
  })

  it('keeps covering rows added to the table', () => {
    // The whole point. An A1 range typed against three rows silently stops
    // covering the fourth; a structured reference does not.
    const grown = [{ ...orders, lastRow: 4 }]
    expect(run('=SUM(Orders[Amount])', null, grown)).toBe(120)
  })
})

describe('re-serialising', () => {
  const round = (src: string) => formatFormula(parseFormula(src))

  it('keeps every form intact', () => {
    expect(round('=Orders[Amount]')).toBe('=Orders[Amount]')
    expect(round('=Orders[@Amount]')).toBe('=Orders[@Amount]')
    expect(round('=[@Amount]')).toBe('=[@Amount]')
    expect(round('=Orders[#All]')).toBe('=Orders[#All]')
    expect(round('=Orders[[Qty]:[Amount]]')).toBe('=Orders[[Qty]:[Amount]]')
  })

  it('is stable across a second round trip', () => {
    for (const src of ['=Orders[Amount]', '=SUM(Orders[[Qty]:[Amount]])', '=[@Qty]*2']) {
      const once = round(src)
      expect(round(once)).toBe(once)
    }
  })
})

describe('shiftTable', () => {
  const table = (over: Partial<TableRegion> = {}): TableRegion => ({
    name: 'Orders', sheet: 'S', headerRow: 2, firstCol: 1, lastCol: 4, lastRow: 9, hasTotals: false, ...over,
  })

  it('moves with an insert above it and shrinks with a delete inside it', () => {
    expect(shiftTable(table(), 'S', { kind: 'insertRows', at: 0, count: 2 })).toMatchObject({ headerRow: 4, lastRow: 11 })
    expect(shiftTable(table(), 'S', { kind: 'insertCols', at: 0, count: 1 })).toMatchObject({ firstCol: 2, lastCol: 5 })
    // A row inserted INSIDE grows it, which is what Excel does.
    expect(shiftTable(table(), 'S', { kind: 'insertRows', at: 5, count: 1 })).toMatchObject({ headerRow: 2, lastRow: 10 })
    expect(shiftTable(table(), 'S', { kind: 'deleteRows', at: 5, count: 2 })).toMatchObject({ headerRow: 2, lastRow: 7 })
  })

  it('goes when its header row or its data does, and stays put on another sheet', () => {
    expect(shiftTable(table(), 'S', { kind: 'deleteRows', at: 0, count: 12 })).toBeNull()
    // Every data row deleted leaves a header with nothing under it.
    expect(shiftTable(table(), 'S', { kind: 'deleteRows', at: 3, count: 7 })).toBeNull()
    expect(shiftTable(table(), 'Other', { kind: 'insertRows', at: 0, count: 2 })).toMatchObject({ headerRow: 2 })
    expect(shiftTables([table(), table({ name: 'Two', sheet: 'Other' })], 'S', { kind: 'deleteRows', at: 0, count: 12 }))
      .toEqual([table({ name: 'Two', sheet: 'Other' })])
  })

  it('a totals row rides below the data', () => {
    const t = table({ hasTotals: true })
    expect(shiftTable(t, 'S', { kind: 'insertRows', at: 0, count: 1 })).toMatchObject({ headerRow: 3, lastRow: 10, hasTotals: true })
  })
})
