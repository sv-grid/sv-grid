/**
 * Selection on `createServerRowModel`: the rule the model keeps, how a grid
 * row maps onto it, the honest count, and a bulk edit that reaches rows the
 * grid never loaded through the datasource's `updateWhere`.
 */
import { describe, expect, it } from 'vitest'
import type { ServerRequest } from '@svgrid/grid/server'
import { createInMemoryDataSource } from '../sveltekit/in-memory'
import type { EntitySchema } from '../schema'
import { createServerRowModel } from './server-row-model'

type Sale = { id: string; region: string; country: string; amount: number; flag?: string }

const schema: EntitySchema<Sale> = {
  name: 'sale',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true },
    { field: 'region', type: 'text' },
    { field: 'country', type: 'text' },
    { field: 'amount', type: 'number' },
    { field: 'flag', type: 'text' },
  ],
} as EntitySchema<Sale>

function sales(): Sale[] {
  const out: Sale[] = []
  let n = 0
  for (const [region, countries] of Object.entries({ EMEA: ['DE', 'FR'], APAC: ['JP'] })) {
    for (const country of countries) {
      for (let i = 0; i < 4; i += 1) out.push({ id: `s${n++}`, region, country, amount: 10 + i })
    }
  }
  return out
}

const settle = async () => {
  for (let i = 0; i < 40; i += 1) await Promise.resolve()
}

async function opened(groupSelects: 'self' | 'descendants' = 'self') {
  const source = createInMemoryDataSource(sales(), schema)
  const ctl = createServerRowModel<Sale>(source, {
    groupBy: ['region', 'country'],
    aggregations: [{ col: 'amount', fn: 'sum' }],
    getRowId: (r) => r.id,
    selection: { groupSelects },
    onChange: () => {},
  })
  ctl.refresh()
  await settle()
  ctl.expandGroup(['EMEA'])
  await settle()
  ctl.expandGroup(['EMEA', 'DE'])
  await settle()
  return { ctl, source }
}

/** The grid row for a leaf id, as the grid would hand it to the adapter. */
function gridRowFor(ctl: Awaited<ReturnType<typeof opened>>['ctl'], id: string) {
  return ctl.getRows().find((r) => r.__group.kind === 'leaf' && (r.__group as { data: Sale }).data.id === id)!
}
function gridRowForGroup(ctl: Awaited<ReturnType<typeof opened>>['ctl'], key: string) {
  return ctl.getRows().find((r) => r.__group.kind === 'group' && r.__group.key === key)!
}

describe('createServerRowModel selection', () => {
  it('is absent unless configured', async () => {
    const ctl = createServerRowModel<Sale>(createInMemoryDataSource(sales(), schema), { onChange: () => {} })
    expect(ctl.selectionModel).toBeNull()
    expect(ctl.selection).toBeUndefined()
    expect(ctl.getSelectionState()).toBeNull()
    ctl.dispose()
  })

  it('maps grid rows onto the rule through the GridRowModel adapter', async () => {
    const { ctl } = await opened()
    const sel = ctl.selection!
    const row = gridRowFor(ctl, 's1')

    expect(sel.isSelected('x', row)).toBe(false)
    sel.toggle('x', row, true)
    expect(sel.isSelected('x', row)).toBe(true)
    expect(ctl.getSelectionState()).toEqual({ selectAll: false, toggled: ['s1'] })
    expect(sel.headerState()).toBe('some')
    expect(sel.selectedCount!()).toBe(1)
    ctl.dispose()
  })

  it('counts rows the grid never loaded under select-all', async () => {
    const { ctl } = await opened()
    const sel = ctl.selection!
    sel.toggleAll(true)
    // The header can say 'all' with three rows on screen because the rule,
    // not the loaded rows, is what is being asked.
    expect(sel.headerState()).toBe('all')
    expect(ctl.getSelectionState()).toEqual({ selectAll: true, toggled: [] })

    sel.toggle('x', gridRowFor(ctl, 's2'), false)
    expect(sel.headerState()).toBe('some')
    expect(sel.isSelected('x', gridRowFor(ctl, 's2'))).toBe(false)
    expect(sel.isSelected('x', gridRowFor(ctl, 's3'))).toBe(true)
    ctl.dispose()
  })

  it('selects a whole group with its descendants when asked to', async () => {
    const { ctl } = await opened('descendants')
    const sel = ctl.selection!
    sel.toggle('x', gridRowForGroup(ctl, 'EMEA'), true)

    expect(sel.isSelected('x', gridRowForGroup(ctl, 'DE'))).toBe(true)
    expect(sel.isSelected('x', gridRowFor(ctl, 's0'))).toBe(true)
    expect(sel.isSelected('x', gridRowForGroup(ctl, 'APAC'))).toBe(false)

    sel.toggle('x', gridRowFor(ctl, 's0'), false)
    expect(ctl.getSelectionState()).toEqual({
      selectAllChildren: false,
      group: true,
      toggled: {
        EMEA: {
          selectAllChildren: true,
          group: true,
          toggled: {
            DE: { selectAllChildren: true, group: true, toggled: { s0: { selectAllChildren: false, toggled: {} } } },
          },
        },
      },
    })
    ctl.dispose()
  })

  it('re-renders the grid on every selection change', async () => {
    const { ctl } = await opened()
    let notified = 0
    ctl.subscribe(() => (notified += 1))
    ctl.selection!.toggle('x', gridRowFor(ctl, 's1'), true)
    await settle()
    expect(notified).toBeGreaterThan(0)
    ctl.dispose()
  })

  it('bulkUpdate writes by rule through updateWhere and reloads every level', async () => {
    const { ctl, source } = await opened()
    ctl.selection!.toggleAll(true)
    ctl.selection!.toggle('x', gridRowFor(ctl, 's1'), false)

    const changed = await ctl.bulkUpdate({ flag: 'bulk' })
    await settle()

    // 12 rows in the table, one excepted.
    expect(changed).toBe(11)
    const flagged = source.rows().filter((r) => r.flag === 'bulk').map((r) => r.id)
    expect(flagged).toHaveLength(11)
    expect(flagged).not.toContain('s1')
    // The open levels reloaded; the leaf under EMEA/DE shows the write.
    const s0 = gridRowFor(ctl, 's0') as unknown as Sale
    expect(s0.flag).toBe('bulk')
    ctl.dispose()
  })

  it('bulkUpdate resolves a nested rule level by level on the server', async () => {
    const { ctl, source } = await opened('descendants')
    ctl.selection!.toggle('x', gridRowForGroup(ctl, 'EMEA'), true)
    ctl.selection!.toggle('x', gridRowForGroup(ctl, 'DE'), false)

    const changed = await ctl.bulkUpdate({ flag: 'fr-only' })
    // EMEA selected, DE excepted: only FR's four rows.
    expect(changed).toBe(4)
    expect(source.rows().filter((r) => r.flag === 'fr-only').every((r) => r.country === 'FR')).toBe(true)
    ctl.dispose()
  })

  it('refuses a bulk edit when the source cannot reach unloaded rows', async () => {
    const source = createInMemoryDataSource(sales(), schema)
    const readOnly = { getRows: (r: ServerRequest) => source.getRows(r) }
    const ctl = createServerRowModel<Sale>(readOnly, {
      groupBy: ['region'],
      getRowId: (r) => r.id,
      selection: {},
      onChange: () => {},
    })
    ctl.refresh()
    await settle()
    ctl.selection!.toggleAll(true)
    await expect(ctl.bulkUpdate({ flag: 'x' })).rejects.toThrow(/updateWhere/)
    ctl.dispose()
  })

  it('round-trips the rule through set/getSelectionState', async () => {
    const { ctl } = await opened()
    // s0 and s1 sit under EMEA/DE, which is open; that is what the grid holds.
    ctl.setSelectionState({ selectAll: true, toggled: ['s0'] })
    expect(ctl.selection!.isSelected('x', gridRowFor(ctl, 's0'))).toBe(false)
    expect(ctl.selection!.isSelected('x', gridRowFor(ctl, 's1'))).toBe(true)
    ctl.dispose()
  })

  it('accepts a saved rule in the callback-style shape, flat and per group', async () => {
    const flat = await opened()
    flat.ctl.setSelectionState({ selectAll: true, toggledNodes: ['s0'] })
    expect(flat.ctl.getSelectionState()).toEqual({ selectAll: true, toggled: ['s0'] })
    expect(flat.ctl.selection!.isSelected('x', gridRowFor(flat.ctl, 's0'))).toBe(false)
    expect(flat.ctl.selection!.isSelected('x', gridRowFor(flat.ctl, 's1'))).toBe(true)
    flat.ctl.dispose()

    const grouped = await opened('descendants')
    // Nothing, except all of EMEA, except s1 inside DE.
    grouped.ctl.setSelectionState({
      selectAllChildren: false,
      toggledNodes: [{ nodeId: 'EMEA', selectAllChildren: true, toggledNodes: [{ nodeId: 'DE', selectAllChildren: true, toggledNodes: [{ nodeId: 's1', selectAllChildren: false }] }] }],
    })
    expect(grouped.ctl.selection!.isSelected('x', gridRowFor(grouped.ctl, 's0'))).toBe(true)
    expect(grouped.ctl.selection!.isSelected('x', gridRowFor(grouped.ctl, 's1'))).toBe(false)
    expect(grouped.ctl.selection!.isSelected('x', gridRowForGroup(grouped.ctl, 'APAC'))).toBe(false)
    grouped.ctl.dispose()
  })
})
