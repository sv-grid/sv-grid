/**
 * Server-side pivot: the column builder on its own, then the row model
 * driving the in-memory reference backend end to end.
 */
import { describe, expect, it } from 'vitest'
import type { ColumnDef } from '@svgrid/grid'
import type { EntitySchema } from '../schema'
import { createInMemoryDataSource } from '../sveltekit/in-memory'
import { buildPivotResultColumns } from './server-pivot'
import { createServerRowModel } from './server-row-model'

type Col = ColumnDef<any, any> & { columns?: Col[] }

/** `id(children)` per node, for a compact tree assertion. */
const shape = (cols: ReadonlyArray<unknown>): string =>
  (cols as Col[]).map((c) => (c.columns ? `${c.header}(${shape(c.columns)})` : String(c.id))).join(' ')

describe('buildPivotResultColumns', () => {
  const sum = { col: 'amount', fn: 'sum' } as const

  it('makes one header group per pivot key with a value column under it', () => {
    const cols = buildPivotResultColumns(['2024_amount', '2025_amount'], [sum])
    expect(shape(cols)).toBe('2024(2024_amount) 2025(2025_amount)')
    const leaf = (cols[0] as Col).columns![0]!
    expect(leaf).toMatchObject({ id: '2024_amount', field: '2024_amount', header: 'sum(amount)', align: 'right', width: 120 })
  })

  it('nests a multi-key path into nested header groups', () => {
    const cols = buildPivotResultColumns(['2024_Q1_amount', '2024_Q2_amount', '2025_Q1_amount'], [sum])
    expect(shape(cols)).toBe('2024(Q1(2024_Q1_amount) Q2(2024_Q2_amount)) 2025(Q1(2025_Q1_amount))')
  })

  it('puts every aggregation of one key under the same group', () => {
    const cols = buildPivotResultColumns(
      ['2024_amount', '2024_qty', '2025_amount', '2025_qty'],
      [sum, { col: 'qty', fn: 'count' }],
    )
    expect(shape(cols)).toBe('2024(2024_amount 2024_qty) 2025(2025_amount 2025_qty)')
  })

  it('matches the longest aggregation column when the separator is inside a name', () => {
    const cols = buildPivotResultColumns(
      ['2024_net_amount', '2024_amount'],
      [
        { col: 'amount', fn: 'sum' },
        { col: 'net_amount', fn: 'sum' },
      ],
    )
    expect(shape(cols)).toBe('2024(2024_net_amount 2024_amount)')
  })

  it('skips a field that ends in no aggregation column', () => {
    expect(buildPivotResultColumns(['2024_amount', 'childCount'], [sum])).toHaveLength(1)
  })

  it('honours the separator, the header hook and the column hook', () => {
    const cols = buildPivotResultColumns(['2024|amount'], [sum], {
      separator: '|',
      valueHeader: (a) => `Total ${a.col}`,
      width: 90,
      pivotResultColumn: (field, def) => ({ ...def, id: `p_${field}`, cellClass: 'money' }),
    })
    const leaf = (cols[0] as Col).columns![0]!
    expect(leaf).toMatchObject({ id: 'p_2024|amount', field: '2024|amount', header: 'Total amount', width: 90, cellClass: 'money' })
  })

  it('returns a flat value column for a field with no key', () => {
    expect(shape(buildPivotResultColumns(['amount'], [sum]))).toBe('amount')
  })

  it('appends a row-totals group reading the plain aggregate fields when asked', () => {
    const fields = ['2024_amount', '2025_amount']
    expect(shape(buildPivotResultColumns(fields, [sum], { rowTotals: true }))).toBe('2024(2024_amount) 2025(2025_amount) Total(amount)')
    expect(shape(buildPivotResultColumns(fields, [sum], { rowTotals: 'All years' }))).toBe('2024(2024_amount) 2025(2025_amount) All years(amount)')
    expect(shape(buildPivotResultColumns(fields, [sum]))).toBe('2024(2024_amount) 2025(2025_amount)')
    // The hook shapes the total column like any other value column.
    const cols = buildPivotResultColumns(fields, [sum], { rowTotals: true, pivotResultColumn: (field, def) => ({ ...def, cellClass: `c-${field}` }) })
    expect((cols.at(-1) as Col).columns![0]).toMatchObject({ field: 'amount', cellClass: 'c-amount' })
  })
})

// ---------------------------------------------------------------- model

type Sale = { id: string; region: string; country: string; year: string; amount: number }

const schema: EntitySchema<Sale> = {
  name: 'sale',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true },
    { field: 'region', type: 'text' },
    { field: 'country', type: 'text' },
    { field: 'year', type: 'text' },
    { field: 'amount', type: 'number' },
  ],
} as EntitySchema<Sale>

const rows: Sale[] = [
  { id: '1', region: 'EMEA', country: 'DE', year: '2024', amount: 100 },
  { id: '2', region: 'EMEA', country: 'DE', year: '2025', amount: 200 },
  { id: '3', region: 'EMEA', country: 'FR', year: '2024', amount: 300 },
  { id: '4', region: 'APAC', country: 'JP', year: '2024', amount: 400 },
  { id: '5', region: 'APAC', country: 'JP', year: '2025', amount: 500 },
]

const settle = async () => {
  for (let i = 0; i < 40; i += 1) await Promise.resolve()
}

const cellsOf = (state: { displayRows: ReadonlyArray<unknown> }) =>
  state.displayRows.map((r) => {
    const row = r as { kind: string; key?: string; data?: Record<string, unknown> }
    if (row.kind !== 'group') return row.kind
    const d = row.data ?? {}
    return `${row.key}:${d['2024_amount'] ?? '-'}/${d['2025_amount'] ?? '-'}`
  })

describe('createServerRowModel pivot', () => {
  it('requests pivoted groups and builds the result columns from the response', async () => {
    const source = createInMemoryDataSource(rows, schema)
    const requests: Array<{ pivotBy?: string[]; pivotMode?: boolean }> = []
    const getRows = source.getRows.bind(source)
    source.getRows = (req) => {
      requests.push({ pivotBy: req.pivotBy, pivotMode: req.pivotMode })
      return getRows(req)
    }
    let view: ReturnType<typeof ctl.getState> | null = null
    const ctl = createServerRowModel<Sale>(source, {
      groupBy: ['region'],
      aggregations: [{ col: 'amount', fn: 'sum' }],
      pivotBy: ['year'],
      pivotMode: true,
      pivotLeadingColumns: [{ id: 'region', field: 'region', header: 'Region' }],
      onChange: (s) => (view = s),
    })
    ctl.refresh()
    await settle()

    expect(requests[0]).toEqual({ pivotBy: ['year'], pivotMode: true })
    expect(cellsOf(view!)).toEqual(['APAC:400/500', 'EMEA:400/200'])
    expect(view!.pivotResultFields).toEqual(['2024_amount', '2025_amount'])
    // The leading column first, then the generated tree.
    expect(shape(ctl.pivotResultColumns!)).toBe('region 2024(2024_amount) 2025(2025_amount)')
    // Row totals switch on without a request: the group rows already carry
    // the plain aggregate the Total column reads.
    const before = requests.length
    ctl.setLayout({ pivotRowTotals: true })
    await settle()
    expect(requests.length).toBe(before)
    expect(shape(ctl.pivotResultColumns!)).toBe('region 2024(2024_amount) 2025(2025_amount) Total(amount)')
    expect((view!.gridRows[0] as unknown as { amount: number }).amount).toBe(900)
    ctl.dispose()
  })

  it('exposes no result columns outside pivot mode', async () => {
    const source = createInMemoryDataSource(rows, schema)
    const ctl = createServerRowModel<Sale>(source, {
      groupBy: ['region'],
      aggregations: [{ col: 'amount', fn: 'sum' }],
      pivotBy: ['year'],
    })
    ctl.refresh()
    await settle()
    expect(ctl.pivotResultColumns).toBeNull()
    expect(ctl.getState().pivotMode).toBe(false)
    ctl.dispose()
  })

  it('setPivot switches modes, reloads, and forgets the old fields', async () => {
    const source = createInMemoryDataSource(rows, schema)
    let view: ReturnType<typeof ctl.getState> | null = null
    const ctl = createServerRowModel<Sale>(source, {
      groupBy: ['region'],
      aggregations: [{ col: 'amount', fn: 'sum' }],
      onChange: (s) => (view = s),
    })
    ctl.refresh()
    await settle()
    expect(ctl.pivotResultColumns).toBeNull()
    expect((view!.displayRows[0] as { data: Sale }).data.amount).toBe(900)

    ctl.setPivot({ pivotBy: ['year'], pivotMode: true })
    await settle()
    expect(shape(ctl.pivotResultColumns!)).toBe('2024(2024_amount) 2025(2025_amount)')
    expect(cellsOf(view!)).toEqual(['APAC:400/500', 'EMEA:400/200'])

    ctl.setPivot({ pivotBy: ['country'] })
    await settle()
    expect(shape(ctl.pivotResultColumns!)).toBe('DE(DE_amount) FR(FR_amount) JP(JP_amount)')
    expect(view!.pivotResultFields).toEqual(['DE_amount', 'FR_amount', 'JP_amount'])

    ctl.setPivot({ pivotMode: false })
    await settle()
    expect(ctl.pivotResultColumns).toBeNull()
    expect((view!.displayRows[0] as { data: Sale }).data.amount).toBe(900)
    ctl.dispose()
  })

  it('does not open the innermost group level under pivot', async () => {
    const source = createInMemoryDataSource(rows, schema)
    const calls: string[] = []
    const getRows = source.getRows.bind(source)
    source.getRows = (req) => {
      calls.push(JSON.stringify(req.groupKeys))
      return getRows(req)
    }
    let view: ReturnType<typeof ctl.getState> | null = null
    const ctl = createServerRowModel<Sale>(source, {
      groupBy: ['region', 'country'],
      aggregations: [{ col: 'amount', fn: 'sum' }],
      pivotBy: ['year'],
      pivotMode: true,
      onChange: (s) => (view = s),
    })
    ctl.refresh()
    await settle()
    // A pivoted region row still opens onto its countries...
    ctl.expandGroup(['EMEA'])
    await settle()
    expect(calls).toEqual(['[]', '["EMEA"]'])
    expect(cellsOf(view!)).toEqual(['APAC:400/500', 'EMEA:400/200', 'DE:100/200', 'FR:300/-'])
    // ...but a country row is the pivoted result itself: nothing beneath it.
    ctl.expandGroup(['EMEA', 'DE'])
    await settle()
    expect(calls).toHaveLength(2)
    expect(ctl.isExpanded(['EMEA', 'DE'])).toBe(false)
    ctl.dispose()
  })

  it('takes full column definitions from a backend that sends them', async () => {
    const source = createInMemoryDataSource(rows, schema)
    const getRows = source.getRows.bind(source)
    source.getRows = async (req) => ({
      ...(await getRows(req)),
      pivotResultColumns: [{ id: 'custom', field: '2024_amount', header: 'FY24' }],
    })
    const ctl = createServerRowModel<Sale>(source, {
      groupBy: ['region'],
      aggregations: [{ col: 'amount', fn: 'sum' }],
      pivotBy: ['year'],
      pivotMode: true,
    })
    ctl.refresh()
    await settle()
    expect(shape(ctl.pivotResultColumns!)).toBe('custom')
    ctl.dispose()
  })

  it('shows the pivoted grand total', async () => {
    const source = createInMemoryDataSource(rows, schema)
    let view: ReturnType<typeof ctl.getState> | null = null
    const ctl = createServerRowModel<Sale>(source, {
      groupBy: ['region'],
      aggregations: [{ col: 'amount', fn: 'sum' }],
      pivotBy: ['year'],
      pivotMode: true,
      grandTotalRow: 'bottom',
      onChange: (s) => (view = s),
    })
    ctl.refresh()
    await settle()
    const total = view!.displayRows.at(-1) as { kind: string; data: Record<string, unknown> }
    expect(total.kind).toBe('grandTotal')
    expect(total.data).toEqual({ '2024_amount': 800, '2025_amount': 700, amount: 1500 })
    ctl.dispose()
  })
})
