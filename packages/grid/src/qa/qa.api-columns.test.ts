/**
 * QA sweep: the column members of `SvGridApi` - add / remove, visibility,
 * width, autosize, pinning and order.
 */
import { describe, expect, it, vi } from 'vitest'
import { flush, mountQaGrid } from './harness.svelte'
import type { ColumnDef } from '../index'
import type { QaFeatures, QaRow } from './harness.svelte'

const extraColumn: ColumnDef<QaFeatures, QaRow> = {
  id: 'idCol',
  field: 'id',
  header: 'Id',
  width: 80,
}

const headerLabels = (target: HTMLElement): string[] =>
  [...target.querySelectorAll('[data-svgrid-header-col]')].map(
    (h) => h.querySelector('.sv-grid-header-label')?.textContent?.trim() ?? '',
  )

describe('QA: api.addColumn / addColumns / removeColumn', () => {
  it('addColumn appends on the right by default', async () => {
    const { api, target } = await mountQaGrid()
    api.addColumn(extraColumn)
    await flush()
    expect(api.getColumns().map((c) => c.id)).toEqual([
      'name',
      'team',
      'salary',
      'active',
      'idCol',
    ])
    expect(headerLabels(target)).toContain('Id')
  })

  it("addColumn('left') prepends and a numeric position inserts before that index", async () => {
    const { api } = await mountQaGrid()
    api.addColumn(extraColumn, 'left')
    api.addColumn({ ...extraColumn, id: 'mid', header: 'Mid' }, 2)
    await flush()
    expect(api.getColumns().map((c) => c.id)).toEqual([
      'idCol',
      'name',
      'mid',
      'team',
      'salary',
      'active',
    ])
  })

  it('addColumns inserts a batch in order', async () => {
    const { api } = await mountQaGrid()
    api.addColumns([extraColumn, { ...extraColumn, id: 'second', header: 'Second' }], 'left')
    await flush()
    expect(api.getColumns().map((c) => c.id).slice(0, 2)).toEqual(['idCol', 'second'])
  })

  it('removeColumn removes by id', async () => {
    const { api, target } = await mountQaGrid()
    api.removeColumn('team')
    await flush()
    expect(api.getColumns().map((c) => c.id)).toEqual(['name', 'salary', 'active'])
    expect(headerLabels(target)).not.toContain('Team')
  })

  it('removeColumn removes by field when the column declared no id', async () => {
    const { api } = await mountQaGrid()
    // qaColumns declare `field` only, so the engine derives the id from it.
    api.removeColumn('salary')
    await flush()
    expect(api.getColumns().map((c) => c.id)).toEqual(['name', 'team', 'active'])
  })

  it('removeColumn with an unknown id is a no-op', async () => {
    const { api } = await mountQaGrid()
    api.removeColumn('nope')
    await flush()
    expect(api.getColumns().length).toBe(4)
  })
})

describe('QA: api.setColumnVisible / isColumnVisible / getColumns', () => {
  it('a hidden column stops rendering but stays in getColumns with visible:false', async () => {
    const { api, target } = await mountQaGrid()
    api.setColumnVisible('team', false)
    await flush()
    expect(api.isColumnVisible('team')).toBe(false)
    expect(headerLabels(target)).not.toContain('Team')
    const team = api.getColumns().find((c) => c.id === 'team')
    expect(team).toBeDefined()
    expect(team!.visible).toBe(false)
  })

  it('setColumnVisible(true) puts the column back', async () => {
    const { api, target } = await mountQaGrid()
    api.setColumnVisible('team', false)
    await flush()
    api.setColumnVisible('team', true)
    await flush()
    expect(api.isColumnVisible('team')).toBe(true)
    expect(headerLabels(target)).toContain('Team')
  })

  it('isColumnVisible reports true for an untouched column', async () => {
    const { api } = await mountQaGrid()
    expect(api.isColumnVisible('name')).toBe(true)
  })

  it('getColumns reports id, field, header, align and editorType', async () => {
    const { api } = await mountQaGrid()
    const cols = api.getColumns()
    expect(cols.map((c) => [c.id, c.field, c.header])).toEqual([
      ['name', 'name', 'Name'],
      ['team', 'team', 'Team'],
      ['salary', 'salary', 'Salary'],
      ['active', 'active', 'Active'],
    ])
    expect(cols.find((c) => c.id === 'salary')!.editorType).toBe('number')
    // A number column aligns right by default (the body applies the same rule).
    expect(cols.find((c) => c.id === 'salary')!.align).toBe('right')
    expect(cols.find((c) => c.id === 'name')!.align).toBe('left')
  })

  it('getColumns reports the column format config when one is set', async () => {
    const { api } = await mountQaGrid({}, undefined, [
      { field: 'name', header: 'Name' },
      { field: 'salary', header: 'Salary', format: { type: 'currency', currency: 'USD' } },
    ] as ColumnDef<QaFeatures, QaRow>[])
    expect(api.getColumns().find((c) => c.id === 'salary')!.format).toEqual({
      type: 'currency',
      currency: 'USD',
    })
  })
})

describe('QA: api.setColumnWidth / getColumnWidths / autosize', () => {
  it('getColumnWidths reports the declared widths', async () => {
    const { api } = await mountQaGrid()
    expect(api.getColumnWidths()).toEqual({
      name: 200,
      team: 160,
      salary: 140,
      active: 120,
    })
  })

  it('setColumnWidth applies the new width and round-trips', async () => {
    const { api } = await mountQaGrid()
    api.setColumnWidth('name', 321)
    await flush()
    expect(api.getColumnWidths().name).toBe(321)
  })

  it('setColumnWidth clamps to the 40px minimum and floors fractions', async () => {
    const { api } = await mountQaGrid()
    api.setColumnWidth('name', 5)
    expect(api.getColumnWidths().name).toBe(40)
    api.setColumnWidth('team', 123.9)
    expect(api.getColumnWidths().team).toBe(123)
  })

  it('a column with no declared width reports the grid-wide default', async () => {
    const { api } = await mountQaGrid({ columnWidth: 111 }, undefined, [
      { field: 'name', header: 'Name' },
      { field: 'team', header: 'Team' },
    ] as ColumnDef<QaFeatures, QaRow>[])
    expect(api.getColumnWidths()).toEqual({ name: 111, team: 111 })
  })

  it('autosizeColumn re-measures one column and never goes below the minimum', async () => {
    const { api } = await mountQaGrid()
    api.autosizeColumn('name')
    await flush()
    const widths = api.getColumnWidths()
    expect(widths.name).toBeGreaterThanOrEqual(40)
    expect(widths.name).not.toBe(200)
    // Untouched columns keep their declared width.
    expect(widths.team).toBe(160)
  })

  it('autosizeAllColumns re-measures every column', async () => {
    const { api } = await mountQaGrid()
    api.autosizeAllColumns()
    await flush()
    const widths = api.getColumnWidths()
    for (const id of ['name', 'team', 'salary', 'active']) {
      expect(widths[id]).toBeGreaterThanOrEqual(40)
    }
    expect(widths.name).not.toBe(200)
    expect(widths.team).not.toBe(160)
  })
})

describe('QA: api.setColumnPinning / getColumnPinning', () => {
  it('replaces the pinning state in one call and reports it back', async () => {
    const { api } = await mountQaGrid({ columnVirtualization: false })
    api.setColumnPinning({ left: ['name'], right: ['active'] })
    await flush()
    expect(api.getColumnPinning()).toEqual({ left: ['name'], right: ['active'] })
  })

  it('seeds from initialColumnPinning at mount', async () => {
    const { api } = await mountQaGrid({
      columnVirtualization: false,
      initialColumnPinning: { left: ['name'] },
    })
    expect(api.getColumnPinning()).toEqual({ left: ['name'], right: [] })
  })

  it('an omitted edge clears that edge; duplicate ids are de-duped', async () => {
    const { api } = await mountQaGrid({ columnVirtualization: false })
    api.setColumnPinning({ left: ['name', 'name', 'team'], right: ['active'] })
    await flush()
    expect(api.getColumnPinning().left).toEqual(['name', 'team'])
    api.setColumnPinning({ left: ['name'] })
    await flush()
    expect(api.getColumnPinning()).toEqual({ left: ['name'], right: [] })
  })

  it('hands back a copy, so a caller cannot mutate grid state through it', async () => {
    const { api } = await mountQaGrid({ columnVirtualization: false })
    api.setColumnPinning({ left: ['name'] })
    await flush()
    api.getColumnPinning().left.push('team')
    expect(api.getColumnPinning().left).toEqual(['name'])
  })

  it('a pinned column renders with the pinned marker', async () => {
    const { target, api } = await mountQaGrid({ columnVirtualization: false })
    api.setColumnPinning({ left: ['name'] })
    await flush()
    expect(target.querySelector('td[data-pinned="left"]')).not.toBeNull()
  })
})

describe('QA: api.setColumnOrder / getColumnOrder', () => {
  it('getColumnOrder starts as the declared order', async () => {
    const { api } = await mountQaGrid()
    expect(api.getColumnOrder()).toEqual(['name', 'team', 'salary', 'active'])
  })

  it('setColumnOrder re-orders the header and fires onColumnOrderChange', async () => {
    const onColumnOrderChange = vi.fn()
    const { api, target } = await mountQaGrid({
      enableColumnReorder: true,
      onColumnOrderChange,
    })
    api.setColumnOrder(['salary', 'name', 'team', 'active'])
    await flush()
    expect(api.getColumnOrder()).toEqual(['salary', 'name', 'team', 'active'])
    expect(headerLabels(target).slice(0, 2)).toEqual(['Salary', 'Name'])
    expect(onColumnOrderChange).toHaveBeenCalledWith(['salary', 'name', 'team', 'active'])
  })

  it('skips unknown ids and keeps unlisted columns after the listed ones', async () => {
    const { api } = await mountQaGrid()
    api.setColumnOrder(['active', 'ghost'])
    await flush()
    expect(api.getColumnOrder()).toEqual(['active', 'name', 'team', 'salary'])
  })
})
