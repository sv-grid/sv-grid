/**
 * A row model that groups on the server (it has `group` accessors) hands the
 * grid its group rows already. The grid must not bucket them again under its
 * own grouping state: that would group one page of rows, not the table. The
 * state itself stays, for a view bar or a chip that shows it.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import type { GridRowModel, SvGridApi } from './index'

type Row = { id: string; region: string; name: string; group?: boolean }

const tick = () => new Promise<void>((r) => setTimeout(r))

function model(rows: Row[], grouped: boolean): GridRowModel<Row> {
  return {
    subscribe: () => () => {},
    getRows: () => rows,
    isLoading: () => false,
    getRowId: (r) => r.id,
    ...(grouped
      ? { group: { isGroup: (r: Row) => !!r.group, level: (r: Row) => (r.group ? 0 : 1), expanded: () => true, onToggle: () => {} } }
      : {}),
  }
}

async function mountGrid(rowModel: GridRowModel<Row>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  let api!: SvGridApi<any, Row>
  const app = mount(SvGrid, {
    target,
    props: {
      rowModel,
      columns: [{ field: 'region', header: 'Region' }, { field: 'name', header: 'Name' }],
      groupBy: ['region'],
      containerHeight: 300,
      virtualization: false,
      onApiReady: (a: SvGridApi<any, Row>) => (api = a),
    } as any,
  })
  for (let i = 0; i < 20 && !api; i++) await tick()
  await tick()
  return { api, target, destroy: () => (unmount(app), target.remove()) }
}

const ROWS: Row[] = [
  { id: 'g:EU', region: 'EU', name: '', group: true },
  { id: 'a', region: 'EU', name: 'Ana' },
  { id: 'b', region: 'EU', name: 'Ben' },
  { id: 'g:US', region: 'US', name: '', group: true },
]

describe('grouping with a row model that groups on the server', () => {
  it('shows the model\'s rows as they are, and keeps the grouping state', async () => {
    const g = await mountGrid(model(ROWS, true))
    const shown = (g.api.getDisplayedRows?.() ?? []) as unknown[]
    expect(shown.length || g.target.querySelectorAll('[data-svgrid-row]').length / 2).toBeGreaterThan(0)
    const names = [...g.target.querySelectorAll<HTMLElement>('.sv-grid-cell[data-col-id="name"]')].map((c) => c.textContent?.trim())
    expect(names).toEqual(['', 'Ana', 'Ben', ''])
    expect(g.api.getState().grouping).toEqual(['region'])
    g.destroy()
  })

  it('still groups a model without group accessors in the page', async () => {
    const flat = ROWS.filter((r) => !r.group)
    const g = await mountGrid(model(flat, false))
    // Grouped in the page: one collapsed EU group, its two rows under it out of sight.
    const names = [...g.target.querySelectorAll<HTMLElement>('.sv-grid-cell[data-col-id="name"]')].map((c) => c.textContent?.trim())
    expect(names).not.toContain('Ana')
    expect(g.target.textContent).toContain('EU')
    g.destroy()
  })
})
