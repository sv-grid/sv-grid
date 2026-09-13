/**
 * QA sweep: the `<SvGrid>` props documented on the component reference page -
 * data state, layout, virtualization, the filter / selection / editing
 * surfaces, sort, pagination and grouping, plus the capability shortcuts.
 *
 * Each case asserts the prop's documented effect on the rendered grid.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  bodyText,
  cellAt,
  flush,
  mountQaGrid,
  qaColumns,
  qaRows,
  settle,
} from './harness.svelte'
import type { ColumnDef } from '../index'
import type { QaFeatures, QaRow } from './harness.svelte'

const rowEls = (target: HTMLElement) =>
  target.querySelectorAll('tbody tr.sv-grid-row:not(.sv-grid-row-spacer)')

describe('QA props: data state', () => {
  it('data renders one row per entry and re-renders when the reference changes', async () => {
    const grid = await mountQaGrid()
    expect(bodyText(grid.target).length).toBe(qaRows.length)

    grid.setProps({ data: qaRows.slice(0, 2) })
    await flush()
    expect(bodyText(grid.target).length).toBe(2)
  })

  it('columns drive the header labels and re-render on change', async () => {
    const grid = await mountQaGrid()
    expect(
      [...grid.target.querySelectorAll('.sv-grid-header-label')].map((h) => h.textContent?.trim()),
    ).toEqual(['Name', 'Team', 'Salary', 'Active'])

    grid.setProps({ columns: [{ field: 'name', header: 'Only Name', width: 200 }] })
    await flush()
    expect(
      [...grid.target.querySelectorAll('.sv-grid-header-label')].map((h) => h.textContent?.trim()),
    ).toEqual(['Only Name'])
  })

  it('loading replaces the body, and loadingOverlay keeps the rows visible', async () => {
    const replaced = await mountQaGrid({ loading: true })
    expect(replaced.target.querySelector('.sv-grid-state-loading')).not.toBeNull()

    const overlay = await mountQaGrid({ loadingOverlay: true })
    overlay.setProps({ loading: true })
    await flush()
    expect(overlay.target.querySelector('.sv-grid-loading-overlay')).not.toBeNull()
    expect(bodyText(overlay.target).length).toBe(qaRows.length)
  })

  it('loadingSkeletonRows sets how many placeholder rows the overlay paints', async () => {
    const grid = await mountQaGrid({ loading: true, loadingOverlay: true, loadingSkeletonRows: 3 }, [])
    await flush()
    expect(grid.target.querySelectorAll('.sv-grid-skeleton-row').length).toBe(3)
  })

  it('error renders an alert in place of the rows and wins over loading', async () => {
    const { target } = await mountQaGrid({ error: 'Boom', loading: true })
    const banner = target.querySelector('.sv-grid-state-error')
    expect(banner?.textContent?.trim()).toBe('Boom')
    expect(target.querySelector('.sv-grid-state-loading')).toBeNull()
  })

  it('emptyMessage replaces the empty-state copy', async () => {
    const { target } = await mountQaGrid({ emptyMessage: 'Nothing here' }, [])
    expect(target.querySelector('.sv-grid-empty-cell')?.textContent?.trim()).toBe('Nothing here')
  })
})

describe('QA props: layout', () => {
  it('containerHeight takes a number as pixels and a string as CSS', async () => {
    const px = await mountQaGrid({ containerHeight: 300 })
    expect(px.target.querySelector<HTMLElement>('.sv-grid-shell')?.style.height).toBe('300px')

    const css = await mountQaGrid({ containerHeight: '50vh' })
    expect(css.target.querySelector<HTMLElement>('.sv-grid-shell')?.style.height).toBe('50vh')
  })

  it('rowHeight sets the row height, and a function gives per-row heights', async () => {
    const fixed = await mountQaGrid({ rowHeight: 44 })
    expect(rowEls(fixed.target)[0]!.getAttribute('style')).toContain('44px')

    const perRow = await mountQaGrid({ rowHeight: (i: number) => 20 + i * 10 })
    const rows = rowEls(perRow.target)
    expect(rows[0]!.getAttribute('style')).toContain('20px')
    expect(rows[1]!.getAttribute('style')).toContain('30px')
  })

  it('columnWidth is the fallback for columns with no declared width', async () => {
    const { api } = await mountQaGrid({ columnWidth: 99 }, undefined, [
      { field: 'name', header: 'Name' },
      { field: 'team', header: 'Team', width: 150 },
    ] as ColumnDef<QaFeatures, QaRow>[])
    expect(api.getColumnWidths()).toEqual({ name: 99, team: 150 })
  })

  it('showRowNumbers adds a 1-based leading column, sized by rowNumberWidth', async () => {
    const { target } = await mountQaGrid({ showRowNumbers: true, rowNumberWidth: 72 })
    const cells = target.querySelectorAll('tbody .sv-grid-row-number-cell')
    expect(cells.length).toBe(qaRows.length)
    expect(cells[0]!.textContent?.trim()).toBe('1')
    expect(cells[5]!.textContent?.trim()).toBe('6')
    expect(cells[0]!.getAttribute('style')).toContain('72px')
  })

  it('zebraRows stripes every other data row', async () => {
    const plain = await mountQaGrid()
    expect(plain.target.querySelectorAll('tbody tr.sv-grid-row-alt').length).toBe(0)

    const zebra = await mountQaGrid({ zebraRows: true })
    expect(zebra.target.querySelectorAll('tbody tr.sv-grid-row-alt').length).toBe(3)
  })

  it('headerHeight sizes the header row', async () => {
    const { target } = await mountQaGrid({ headerHeight: 48 })
    expect(target.querySelector<HTMLElement>('thead tr')?.style.height).toBe('48px')
  })

  it('rowResize turns showRowNumbers on, and an explicit false wins', async () => {
    const on = await mountQaGrid({ rowResize: true })
    await flush()
    expect(on.target.querySelectorAll('tbody .sv-grid-row-number-cell').length).toBe(
      qaRows.length,
    )

    const off = await mountQaGrid({ rowResize: true, showRowNumbers: false })
    await flush()
    expect(off.target.querySelectorAll('tbody .sv-grid-row-number-cell').length).toBe(0)
  })

  it('autoRowHeight marks the rows as content-sized', async () => {
    const { target } = await mountQaGrid({ autoRowHeight: true })
    expect(target.querySelectorAll('tbody tr.sv-grid-row-auto-height').length).toBe(
      qaRows.length,
    )
  })

  it('initialColumnPinning seeds the pinned edges at mount', async () => {
    const { api, target } = await mountQaGrid({
      initialColumnPinning: { left: ['name'], right: ['active'] },
    })
    expect(api.getColumnPinning()).toEqual({ left: ['name'], right: ['active'] })
    expect(target.querySelector('td[data-pinned="left"]')).not.toBeNull()
    expect(target.querySelector('td[data-pinned="right"]')).not.toBeNull()
  })

  it('columnResize adds the resize handles; off by default there are none', async () => {
    const off = await mountQaGrid()
    await settle()
    expect(off.target.querySelector('.sv-grid-resize-handle')).toBeNull()

    const on = await mountQaGrid({ columnResize: true })
    await settle()
    expect(on.target.querySelectorAll('.sv-grid-resize-handle').length).toBe(qaColumns.length)
  })
})

describe('QA props: virtualization', () => {
  it('virtualization={false} renders every row', async () => {
    const rows: QaRow[] = Array.from({ length: 60 }, (_, i) => ({
      id: i + 1,
      name: `P${i}`,
      team: 'T',
      salary: i,
      active: true,
    }))
    const { target } = await mountQaGrid({ virtualization: false, containerHeight: 200 }, rows)
    expect(bodyText(target).length).toBe(60)
  })

  it('virtualization={true} renders a window plus overscan, with spacer rows', async () => {
    const rows: QaRow[] = Array.from({ length: 500 }, (_, i) => ({
      id: i + 1,
      name: `P${i}`,
      team: 'T',
      salary: i,
      active: true,
    }))
    const { target } = await mountQaGrid(
      { virtualization: true, rowHeight: 30, containerHeight: 300, overscan: 2 },
      rows,
    )
    const rendered = bodyText(target).length
    expect(rendered).toBeGreaterThan(0)
    expect(rendered).toBeLessThan(rows.length)
    expect(target.querySelector('tr.sv-grid-row-spacer')).not.toBeNull()
  })

  it('overscan widens the rendered window', async () => {
    const rows: QaRow[] = Array.from({ length: 500 }, (_, i) => ({
      id: i + 1,
      name: `P${i}`,
      team: 'T',
      salary: i,
      active: true,
    }))
    const small = await mountQaGrid(
      { virtualization: true, rowHeight: 30, containerHeight: 300, overscan: 1 },
      rows,
    )
    const large = await mountQaGrid(
      { virtualization: true, rowHeight: 30, containerHeight: 300, overscan: 20 },
      rows,
    )
    expect(bodyText(large.target).length).toBeGreaterThan(bodyText(small.target).length)
  })

  it('columnVirtualization={false} renders every column; true windows them', async () => {
    const manyCols = Array.from({ length: 30 }, (_, i) => ({
      field: i === 0 ? 'name' : `c${i}`,
      header: `H${i}`,
      width: 120,
    })) as ColumnDef<QaFeatures, QaRow>[]

    const off = await mountQaGrid({ columnVirtualization: false }, undefined, manyCols)
    expect(off.target.querySelectorAll('thead [data-svgrid-header-col]').length).toBe(30)

    const on = await mountQaGrid({ columnVirtualization: true, columnOverscan: 1 }, undefined, manyCols)
    expect(on.target.querySelectorAll('thead [data-svgrid-header-col]').length).toBeLessThan(30)
  })

  it('columnOverscan widens the rendered column window', async () => {
    const manyCols = Array.from({ length: 30 }, (_, i) => ({
      field: i === 0 ? 'name' : `c${i}`,
      header: `H${i}`,
      width: 120,
    })) as ColumnDef<QaFeatures, QaRow>[]
    const narrow = await mountQaGrid({ columnVirtualization: true, columnOverscan: 1 }, undefined, manyCols)
    const wide = await mountQaGrid({ columnVirtualization: true, columnOverscan: 10 }, undefined, manyCols)
    expect(wide.target.querySelectorAll('thead [data-svgrid-header-col]').length).toBeGreaterThan(
      narrow.target.querySelectorAll('thead [data-svgrid-header-col]').length,
    )
  })
})

describe('QA props: filter surfaces', () => {
  it("filterMode='global' shows only the search box", async () => {
    const { target } = await mountQaGrid({ filterMode: 'global' })
    expect(target.querySelector('.sv-grid-global-filter')).not.toBeNull()
    expect(target.querySelector('.sv-grid-filter-row-control')).toBeNull()
  })

  it("filterMode='row' shows the filter row", async () => {
    const { target } = await mountQaGrid({ filterMode: 'row' })
    expect(target.querySelector('.sv-grid-filter-row-control')).not.toBeNull()
  })

  it("filterMode='none' shows no filter surface at all", async () => {
    const { target } = await mountQaGrid({ filterMode: 'none' })
    expect(target.querySelector('.sv-grid-global-filter')).toBeNull()
    expect(target.querySelector('.sv-grid-filter-row-control')).toBeNull()
  })

  it('showGlobalFilter / showFilterRow override filterMode per surface', async () => {
    const { target } = await mountQaGrid({
      filterMode: 'none',
      showGlobalFilter: true,
      showFilterRow: true,
    })
    expect(target.querySelector('.sv-grid-global-filter')).not.toBeNull()
    expect(target.querySelector('.sv-grid-filter-row-control')).not.toBeNull()
  })

  it('the global filter box narrows the rows as the user types', async () => {
    const { api, target } = await mountQaGrid({ showGlobalFilter: true })
    const input = target.querySelector<HTMLInputElement>('.sv-grid-global-filter input')
    expect(input).not.toBeNull()
    input!.value = 'Kernel'
    input!.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()
    expect(api.getDisplayedRows().map((r) => r.name)).toEqual(['Linus Torvalds'])
  })

  it('externalFilter records the filter state but does not drop rows', async () => {
    const onFiltersChange = vi.fn()
    const { api } = await mountQaGrid({ externalFilter: true, onFiltersChange })
    api.setFilter('team', { operator: 'equals', value: 'Kernel' })
    await flush()
    expect(api.getFilters().team).toEqual({ operator: 'equals', value: 'Kernel' })
    expect(api.getDisplayedRows().length).toBe(qaRows.length)
    expect(onFiltersChange).toHaveBeenCalled()
  })
})

describe('QA props: selection surfaces', () => {
  it("selectionMode='row' shows the checkbox column and no range selection", async () => {
    const { target } = await mountQaGrid({ selectionMode: 'row' })
    expect(target.querySelector('tbody button.sv-grid-checkbox')).not.toBeNull()
  })

  it("selectionMode='none' shows no checkbox column", async () => {
    const { target } = await mountQaGrid({ selectionMode: 'none' })
    expect(target.querySelector('tbody button.sv-grid-checkbox')).toBeNull()
  })

  it('showRowSelection overrides selectionMode for the checkbox column', async () => {
    const { target } = await mountQaGrid({ selectionMode: 'none', showRowSelection: true })
    expect(target.querySelector('tbody button.sv-grid-checkbox')).not.toBeNull()
  })

  it('enableCellSelection makes a drag select a range', async () => {
    const { api, target } = await mountQaGrid({ enableCellSelection: true })
    cellAt(target, 0, 0)!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    cellAt(target, 1, 1)!.dispatchEvent(new MouseEvent('pointerenter', { bubbles: true }))
    await flush()
    expect(api.getSelected()).toEqual([[0, 0, 1, 1]])
  })

  it('the header select-all checkbox selects every row', async () => {
    const { api, target } = await mountQaGrid({ showRowSelection: true })
    const headerBox = target.querySelector<HTMLElement>('thead button.sv-grid-checkbox')
    expect(headerBox).not.toBeNull()
    headerBox!.click()
    await flush()
    expect(api.getSelectedRows().length).toBe(qaRows.length)
  })
})

describe('QA props: editing', () => {
  it('enableInlineEditing lets a double-click open an editor', async () => {
    const { target } = await mountQaGrid({ enableInlineEditing: true })
    cellAt(target, 0, 0)!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    await flush()
    expect(target.querySelector('.sv-grid-cell-editing input')).not.toBeNull()
  })

  it('a read-only grid ignores a double-click', async () => {
    const { target } = await mountQaGrid()
    cellAt(target, 0, 0)!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    await flush()
    expect(target.querySelector('.sv-grid-cell-editing')).toBeNull()
  })

  it('fullRowEditing puts the whole row into edit mode', async () => {
    const { api, target } = await mountQaGrid({ enableInlineEditing: true, fullRowEditing: true })
    api.startEditing(0, 'name')
    await flush()
    const editingCells = target.querySelectorAll('tr:first-child td.sv-grid-cell-editing')
    expect(editingCells.length).toBeGreaterThan(1)
  })

  it('enableRowSummaries appends a footer aggregate row; summary is its alias', async () => {
    const off = await mountQaGrid()
    expect(off.target.querySelector('tr.sv-grid-summary-row')).toBeNull()

    const on = await mountQaGrid({ enableRowSummaries: true })
    expect(on.target.querySelector('tr.sv-grid-summary-row')).not.toBeNull()

    const alias = await mountQaGrid({ summary: true })
    expect(alias.target.querySelector('tr.sv-grid-summary-row')).not.toBeNull()
  })
})

describe('QA props: sort', () => {
  it('initialSorting seeds the sort order at mount', async () => {
    const { api } = await mountQaGrid({ initialSorting: [{ id: 'salary', desc: true }] })
    expect(api.getState().sorting).toEqual([{ id: 'salary', desc: true }])
    expect(api.getDisplayedRows()[0]!.salary).toBe(175_000)
  })

  it('externalSort records the sort state without re-ordering rows', async () => {
    const onSortingChange = vi.fn()
    const { api } = await mountQaGrid({ externalSort: true, onSortingChange })
    api.setSort('salary', 'desc')
    await flush()
    expect(api.getState().sorting).toEqual([{ id: 'salary', desc: true }])
    expect(api.getDisplayedRows().map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('a header click cycles asc, desc, none', async () => {
    const { api, target } = await mountQaGrid()
    const label = target.querySelector<HTMLElement>(
      '[data-svgrid-header-col="salary"] .sv-grid-header-label',
    )
    label!.click()
    await flush()
    expect(api.getState().sorting).toEqual([{ id: 'salary', desc: false }])
    label!.click()
    await flush()
    expect(api.getState().sorting).toEqual([{ id: 'salary', desc: true }])
    label!.click()
    await flush()
    expect(api.getState().sorting).toEqual([])
  })
})

describe('QA props: pagination', () => {
  const rows: QaRow[] = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    name: `P${i + 1}`,
    team: 'T',
    salary: i,
    active: true,
  }))

  it('showPagination renders the footer pager and slices the rows', async () => {
    const { target, api } = await mountQaGrid({ showPagination: true, pageSize: 10 }, rows)
    expect(target.querySelector('.sv-grid-pagination')).not.toBeNull()
    expect(api.getDisplayedRows().length).toBe(10)
  })

  it('pageSize sets the initial page size', async () => {
    const { api } = await mountQaGrid({ showPagination: true, pageSize: 5 }, rows)
    expect(api.getPageInfo()).toMatchObject({ pageSize: 5, pageCount: 5 })
  })

  it('pageable is the shortcut alias for showPagination', async () => {
    const { target } = await mountQaGrid({ pageable: true }, rows)
    expect(target.querySelector('.sv-grid-pagination')).not.toBeNull()
  })

  it("paginationPosition='top' moves the pager out of the bottom footer", async () => {
    // The top pager only mounts once the shell has been measured, which jsdom
    // never does (it reports a zero-size box), so this checks the bottom half
    // of the contract: 'top' leaves no pager in the footer.
    const bottom = await mountQaGrid({ showPagination: true }, rows)
    expect(bottom.target.querySelectorAll('.sv-grid-pagination-nav').length).toBe(1)

    const top = await mountQaGrid({ showPagination: true, paginationPosition: 'top' }, rows)
    expect(top.target.querySelectorAll('.sv-grid-pagination-nav').length).toBe(0)
  })

  it('pageSizeOptions fills the footer size selector', async () => {
    const { target } = await mountQaGrid(
      { showPagination: true, pageSizeOptions: [5, 15] },
      rows,
    )
    expect(target.querySelector('.sv-grid-pagination-pagesize')).not.toBeNull()
  })

  it('externalPagination reads rowCount / pageIndex instead of slicing', async () => {
    const page = rows.slice(10, 20)
    const { api, target } = await mountQaGrid(
      {
        showPagination: true,
        externalPagination: true,
        pageSize: 10,
        pageIndex: 1,
        rowCount: 25,
      },
      page,
    )
    // The rows handed in ARE the page: nothing is sliced off.
    expect(api.getDisplayedRows().length).toBe(10)
    expect(target.querySelector('.sv-grid-pagination-range')?.textContent).toContain('25')
  })
})

describe('QA props: grouping', () => {
  it('groupBy groups at mount and re-applies when the prop changes', async () => {
    const grid = await mountQaGrid({ groupBy: ['team'] })
    expect(grid.target.querySelectorAll('tr.sv-grid-group-row').length).toBe(4)

    grid.setProps({ groupBy: [] })
    await flush()
    expect(grid.target.querySelectorAll('tr.sv-grid-group-row').length).toBe(0)
  })

  it('expanded seeds which groups are open and re-applies on change', async () => {
    const grid = await mountQaGrid({
      groupBy: ['team'],
      expanded: { group_team_Research: true },
    })
    expect(grid.api.getDisplayedRows().length).toBe(3)

    grid.setProps({ expanded: {} })
    await flush()
    expect(grid.api.getDisplayedRows().length).toBe(0)
  })

  it('showGroupingControls / groupable add the column-menu group item', async () => {
    const menuText = async (props: Record<string, unknown>) => {
      const grid = await mountQaGrid(props)
      const buttons = grid.target.querySelectorAll<HTMLElement>('.sv-grid-col-menu-btn')
      // The last button on a header cell is the column menu; the first is the
      // filter funnel.
      buttons[buttons.length - 1]!.click()
      await settle()
      const menus = [...document.querySelectorAll('.sv-grid-menu')]
      return menus.at(-1)?.textContent?.replace(/\s+/g, ' ') ?? ''
    }

    expect(await menuText({})).not.toContain('Group by this column')
    expect(await menuText({ showGroupingControls: true })).toContain('Group by this column')
    expect(await menuText({ groupable: true })).toContain('Group by this column')
  })

  it('groupFooters adds a subtotal row per group', async () => {
    const { target } = await mountQaGrid({
      groupBy: ['team'],
      expanded: { group_team_Research: true },
      groupFooters: true,
    })
    expect(target.querySelectorAll('tr.sv-grid-group-footer-row').length).toBeGreaterThan(0)
  })

  it('grandTotalRow appends one total row for the whole filtered set', async () => {
    // The row carries each column's `aggregate`, so a grid with no aggregate
    // column has nothing to total and renders none.
    const aggCols = [
      { field: 'name', header: 'Name', width: 200 },
      { field: 'salary', header: 'Salary', width: 140, aggregate: 'sum' },
    ] as ColumnDef<QaFeatures, QaRow>[]

    const off = await mountQaGrid({}, undefined, aggCols)
    expect(off.target.querySelectorAll('tr.sv-grid-grand-total-row').length).toBe(0)

    const on = await mountQaGrid({ grandTotalRow: true }, undefined, aggCols)
    const total = on.target.querySelector('tr.sv-grid-grand-total-row')
    expect(total).not.toBeNull()
    // 142 + 158 + 138 + 165 + 175 + 171 thousand.
    expect(total!.textContent).toContain('949000')
    expect([...on.target.querySelectorAll('tbody tr')].at(-1)).toBe(total)
  })

  it("groupDisplayMode='singleColumn' renders the auto-group column", async () => {
    const { target } = await mountQaGrid({
      groupBy: ['team'],
      groupDisplayMode: 'singleColumn',
      autoGroupColumnHeader: 'Bucket',
      autoGroupColumnWidth: 180,
    })
    const headers = [...target.querySelectorAll('.sv-grid-header-label')].map((h) =>
      h.textContent?.trim(),
    )
    expect(headers).toContain('Bucket')
  })
})

describe('QA props: capability shortcuts', () => {
  it('a bare grid sorts, filters and edits nothing', async () => {
    // No `features` prop at all: the shortcuts below are what inject them, so
    // without one the grid is a plain read-only table.
    const bare = await mountQaGrid({ features: undefined }, undefined, qaColumns)
    bare.api.setSort('salary', 'asc')
    bare.api.setFilter('team', { operator: 'equals', value: 'Kernel' })
    await flush()
    expect(bare.api.getDisplayedRows().map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6])
    expect(bare.api.startEditing(0, 'name')).toBe(false)
  })

  it('sortable injects the sorting feature', async () => {
    const { api } = await mountQaGrid({ features: undefined, sortable: true })
    api.setSort('salary', 'asc')
    await flush()
    expect(api.getDisplayedRows()[0]!.salary).toBe(138_000)
  })

  it('filterable injects the filtering feature', async () => {
    const { api } = await mountQaGrid({ features: undefined, filterable: true })
    api.setFilter('team', { operator: 'equals', value: 'Kernel' })
    await flush()
    expect(api.getDisplayedRows().map((r) => r.name)).toEqual(['Linus Torvalds'])
  })

  it('editable is the alias for enableInlineEditing', async () => {
    const { api } = await mountQaGrid({ editable: true })
    expect(api.startEditing(0, 'name')).toBe(true)
  })

  it('selectable is the alias for enableCellSelection', async () => {
    const { api, target } = await mountQaGrid({ selectable: true })
    cellAt(target, 0, 0)!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    cellAt(target, 1, 0)!.dispatchEvent(new MouseEvent('pointerenter', { bubbles: true }))
    await flush()
    expect(api.getSelected()).toEqual([[0, 0, 1, 0]])
  })
})
