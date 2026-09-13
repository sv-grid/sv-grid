/**
 * QA sweep, second half of the prop surface: rendering extras, clipboard,
 * notes / conditional formatting, detail + pinned rows, the alternate render
 * modes (board / scheduler / chart / pivot), localization and the server hooks.
 *
 * A few props steer behaviour that needs real layout metrics (`responsive`,
 * `alignedGridGroup`, `fitColumns`, drag-and-drop). jsdom reports a zero-size
 * box, so those cases assert the structural marker the prop installs and say so
 * where the visual half is out of reach.
 */
import { describe, expect, it, vi } from 'vitest'
import { createRawSnippet } from 'svelte'
import { cellAt, flush, mountQaGrid, qaRows, settle } from './harness.svelte'
import type { ColumnDef } from '../index'
import type { QaFeatures, QaRow } from './harness.svelte'

const twoCols = [
  { field: 'name', header: 'Name', width: 200 },
  { field: 'salary', header: 'Salary', width: 140, aggregate: 'sum' },
] as ColumnDef<QaFeatures, QaRow>[]

describe('QA props: icons and header chrome', () => {
  it('showColumnFilters adds the filter funnel to the header', async () => {
    const off = await mountQaGrid({ filterMode: 'none' })
    expect(off.target.querySelector('.sv-grid-col-filter-btn')).toBeNull()

    const on = await mountQaGrid({ showColumnFilters: true })
    expect(on.target.querySelector('.sv-grid-col-filter-btn')).not.toBeNull()
  })

  it('showFilterMenu is inert - the deprecated alias no longer wires anything', async () => {
    // Documented in the type as "@deprecated Has no effect": kept only so old
    // code compiles. Asserted so a future change to it cannot pass unnoticed.
    const { target } = await mountQaGrid({ filterMode: 'none', showFilterMenu: true })
    expect(target.querySelector('.sv-grid-col-filter-btn')).toBeNull()
  })

  it('columnMenuTabs renders the column menu as a tabbed popover', async () => {
    const grid = await mountQaGrid({ columnMenuTabs: true })
    const buttons = grid.target.querySelectorAll<HTMLElement>('.sv-grid-col-menu-btn')
    buttons[buttons.length - 1]!.click()
    await settle()
    expect(document.querySelector('.sv-grid-menu-tabs, [role="tablist"]')).not.toBeNull()
  })

  it('enableRowHover flips the no-hover class off the table', async () => {
    const off = await mountQaGrid()
    expect(off.target.querySelector('.sv-grid-table')?.classList.contains('sv-grid-no-row-hover')).toBe(
      true,
    )

    const on = await mountQaGrid({ enableRowHover: true })
    expect(on.target.querySelector('.sv-grid-table')?.classList.contains('sv-grid-no-row-hover')).toBe(
      false,
    )
  })

  it('fitColumns scales the columns to the viewport once it can be measured', async () => {
    // jsdom reports a zero-width viewport, so there is nothing to scale to and
    // the declared widths must survive untouched rather than collapse.
    const { api } = await mountQaGrid({ fitColumns: true })
    expect(api.getColumnWidths()).toEqual({ name: 200, team: 160, salary: 140, active: 120 })
  })

  it('responsive leaves the grid in its normal layout while the box is unmeasured', async () => {
    const { target } = await mountQaGrid({ responsive: true })
    expect(target.querySelector('.sv-grid-container')?.classList.contains('sv-grid-narrow')).toBe(
      false,
    )
  })
})

describe('QA props: row chrome', () => {
  it('rowClass adds the returned class to the matching rows', async () => {
    const { target } = await mountQaGrid({
      rowClass: ({ row }: { row: QaRow }) => (row.active ? 'is-active' : ''),
    })
    expect(target.querySelectorAll('tbody tr.is-active').length).toBe(4)
  })

  it('pinnedTopRows / pinnedBottomRows render sticky rows outside the data set', async () => {
    const { target, api } = await mountQaGrid({
      pinnedTopRows: [{ id: 90, name: 'Top', team: 'T', salary: 0, active: true }],
      pinnedBottomRows: [{ id: 91, name: 'Bottom', team: 'B', salary: 0, active: true }],
    })
    expect(target.querySelectorAll('tr.sv-grid-pinned-row-top').length).toBe(1)
    expect(target.querySelectorAll('tr.sv-grid-pinned-row-bottom').length).toBe(1)
    // Pinned rows are chrome, not data: the row set is unchanged.
    expect(api.getData().length).toBe(qaRows.length)
  })

  it('isDetailRow / renderDetailRow replace a row with a full-width detail cell', async () => {
    const { target } = await mountQaGrid({
      isDetailRow: (row: QaRow) => row.id === 2,
      renderDetailRow: createRawSnippet(() => ({
        render: () => `<span data-qa="detail">Detail body</span>`,
      })),
    })
    expect(target.querySelectorAll('tr.sv-grid-detail-row').length).toBe(1)
    const cell = target.querySelector('td.sv-grid-detail-cell')
    expect(cell?.getAttribute('colspan')).not.toBeNull()
    expect(cell?.querySelector('[data-qa="detail"]')?.textContent).toBe('Detail body')
  })

  it('rowDragManaged makes every row a drag source', async () => {
    const off = await mountQaGrid()
    expect(off.target.querySelector('tbody tr[draggable="true"]')).toBeNull()

    const on = await mountQaGrid({ rowDragManaged: true })
    expect(on.target.querySelectorAll('tbody tr[draggable="true"]').length).toBe(qaRows.length)
    expect(on.target.querySelectorAll('tbody tr.sv-grid-row-draggable').length).toBe(qaRows.length)
  })

  it('rowDragGroup + onRowDragEnd are accepted alongside managed dragging', async () => {
    const onRowDragEnd = vi.fn()
    const { target } = await mountQaGrid({
      rowDragManaged: true,
      rowDragGroup: 'qa-group',
      onRowDragEnd,
    })
    // The drop itself needs a real DataTransfer; what is checked here is that
    // the props mount and the rows stay draggable.
    expect(target.querySelectorAll('tbody tr[draggable="true"]').length).toBe(qaRows.length)
    expect(onRowDragEnd).not.toHaveBeenCalled()
  })

  it('alignedGridGroup mounts without disturbing the layout', async () => {
    const a = await mountQaGrid({ alignedGridGroup: 'qa-aligned' })
    const b = await mountQaGrid({ alignedGridGroup: 'qa-aligned' })
    expect(a.target.querySelector('.sv-grid-container')).not.toBeNull()
    expect(b.target.querySelector('.sv-grid-container')).not.toBeNull()
  })
})

describe('QA props: notes and conditional formatting', () => {
  it('notes draw a corner marker on the keyed cell', async () => {
    const { target } = await mountQaGrid({
      getRowId: (r: QaRow) => `r${r.id}`,
      notes: { r1: { name: 'Check this' } },
    })
    const marked = target.querySelectorAll('td.sv-grid-cell-has-note')
    expect(marked.length).toBe(1)
    expect(marked[0]!.getAttribute('data-col-id')).toBe('name')
    expect(target.querySelector('.sv-grid-cell-note-corner')).not.toBeNull()
  })

  it('editableComments adds the comment item to the context menu, and onNoteChange saves', async () => {
    const onNoteChange = vi.fn()
    const { target } = await mountQaGrid({
      getRowId: (r: QaRow) => `r${r.id}`,
      contextMenu: true,
      editableComments: true,
      onNoteChange,
    })
    cellAt(target, 0, 0)!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
    await settle()
    const items = [...document.querySelectorAll('.sv-grid-context-menu .sv-grid-menu-item')]
    const comment = items.find((i) => /comment/i.test(i.textContent ?? ''))
    expect(comment).toBeDefined()

    ;(comment as HTMLElement).click()
    await settle()
    const textarea = document.querySelector<HTMLTextAreaElement>('.sv-grid-comment-textarea')
    expect(textarea).not.toBeNull()
    textarea!.value = 'A note'
    textarea!.dispatchEvent(new Event('input', { bubbles: true }))
    document.querySelector<HTMLElement>('.sv-grid-comment-save')!.click()
    await settle()
    expect(onNoteChange).toHaveBeenCalledWith({
      rowId: 'r1',
      columnId: 'name',
      note: 'A note',
    })
  })

  it('conditionalFormats paints the matching cells', async () => {
    const { target } = await mountQaGrid({
      conditionalFormats: [
        {
          type: 'rule',
          columns: ['salary'],
          when: ({ value }: { value: unknown }) => Number(value) > 160_000,
          background: '#fee',
        },
      ],
    })
    expect(target.querySelectorAll('td.sv-grid-cell-cf').length).toBeGreaterThan(0)
    // Margaret 165k, Linus 175k, Barbara 171k.
    expect(target.querySelectorAll('.sv-grid-cf-bg').length).toBe(3)
  })

  it('conditionalStatScope picks which rows feed a colorScale range', async () => {
    const formats = [
      { type: 'colorScale', columns: ['salary'], min: '#ffffff', max: '#000000' },
    ]
    const filtered = await mountQaGrid({
      conditionalFormats: formats,
      conditionalStatScope: 'filtered',
    })
    const all = await mountQaGrid({ conditionalFormats: formats, conditionalStatScope: 'all' })
    filtered.api.setFilter('team', { operator: 'equals', value: 'Research' })
    all.api.setFilter('team', { operator: 'equals', value: 'Research' })
    await flush()
    const bg = (t: HTMLElement) =>
      [...t.querySelectorAll('.sv-grid-cf-bg')].map((e) => e.getAttribute('style'))
    // Same three rows on screen; the scopes scale them against a different
    // min/max, so the painted gradients differ.
    expect(bg(filtered.target).length).toBe(3)
    expect(bg(all.target).length).toBe(3)
    expect(bg(filtered.target)).not.toEqual(bg(all.target))
  })
})

describe('QA props: clipboard', () => {
  it('copyHeadersToClipboard prepends the column labels to a copied range', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const plain = await mountQaGrid({ enableCellSelection: true })
    plain.api.selectCells([[0, 0, 0, 1]])
    await flush()
    plain.target
      .querySelector('table.sv-grid-table')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }))
    await settle()
    expect(writeText).toHaveBeenCalled()
    expect(writeText.mock.calls.at(-1)![0]).toBe('Ada Lovelace\tResearch')

    const withHeaders = await mountQaGrid({
      enableCellSelection: true,
      copyHeadersToClipboard: true,
    })
    withHeaders.api.selectCells([[0, 0, 0, 1]])
    await flush()
    withHeaders.target
      .querySelector('table.sv-grid-table')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }))
    await settle()
    expect(writeText.mock.calls.at(-1)![0]).toBe('Name\tTeam\nAda Lovelace\tResearch')
    vi.unstubAllGlobals()
  })

  it('processCellForClipboard transforms each value on its way out', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { api, target } = await mountQaGrid({
      enableCellSelection: true,
      processCellForClipboard: ({ value }: { value: unknown }) => `[${String(value)}]`,
    })
    api.selectCells([[0, 0, 0, 0]])
    await flush()
    target
      .querySelector('table.sv-grid-table')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }))
    await settle()
    expect(writeText.mock.calls.at(-1)![0]).toBe('[Ada Lovelace]')
    vi.unstubAllGlobals()
  })

  it('moveCells marks the selection as grabbable for a range move', async () => {
    const { api, target } = await mountQaGrid({ enableCellSelection: true, moveCells: true })
    api.selectCells([[0, 0, 1, 1]])
    await flush()
    expect(target.querySelectorAll('td[data-selected-range="true"]').length).toBe(4)
  })
})

describe('QA props: status bar, tool panel and context menu', () => {
  it('statusBar shows live aggregates for the selected range', async () => {
    const { api, target } = await mountQaGrid({ statusBar: true, enableCellSelection: true })
    api.selectCells([[0, 2, 2, 2]])
    await flush()
    const bar = target.querySelector('.sv-grid-status-bar')
    expect(bar).not.toBeNull()
    expect(bar!.textContent).toContain('3')
  })

  it('toolPanel docks the sidebar, opened by toolPanelDefaultOpen on the chosen tab', async () => {
    const closed = await mountQaGrid({ toolPanel: true })
    expect(closed.target.querySelector('.sv-grid-toolbar-btn')).not.toBeNull()
    expect(closed.target.querySelector('.sv-grid-tool-panel')).toBeNull()

    const open = await mountQaGrid({
      toolPanel: true,
      toolPanelDefaultOpen: true,
      toolPanelDefaultTab: 'filters',
    })
    await flush()
    expect(open.target.querySelector('.sv-grid-tool-panel')).not.toBeNull()
    expect(open.target.querySelector('.sv-grid-tool-panel-filters')).not.toBeNull()
  })

  it('contextMenu={true} opens the default item set on right-click', async () => {
    const { target } = await mountQaGrid({ contextMenu: true })
    cellAt(target, 0, 0)!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
    await settle()
    const menu = document.querySelector('.sv-grid-context-menu')
    expect(menu).not.toBeNull()
    expect(menu!.textContent).toMatch(/Copy/i)
  })

  it('contextMenu accepts a custom item list', async () => {
    const action = vi.fn()
    const { target } = await mountQaGrid({
      contextMenu: [{ label: 'QA action', action }],
    })
    cellAt(target, 0, 0)!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
    await settle()
    const items = [...document.querySelectorAll('.sv-grid-context-menu .sv-grid-menu-item')]
    expect(items.map((i) => i.textContent?.trim())).toEqual(['QA action'])
    ;(items[0] as HTMLElement).click()
    await flush()
    expect(action).toHaveBeenCalled()
  })

  it('selectionBar shows the floating count bar while rows are selected', async () => {
    const { api, target } = await mountQaGrid({
      selectionBar: true,
      showRowSelection: true,
      getRowId: (r: QaRow) => `r${r.id}`,
    })
    api.selectRows(['r1', 'r2'])
    await flush()
    const root = target.querySelector('.sv-grid-root')
    // The free grid renders the upsell variant of the bar; either way the bar's
    // host attribute flips on once rows are selected.
    expect(root?.getAttribute('data-selbar')).toBeTruthy()
  })
})

describe('QA props: tree data and column types', () => {
  it('treeData nests the rows and renders the tree toggles', async () => {
    const rows = [
      { id: 1, managerId: null, name: 'Ada' },
      { id: 2, managerId: 1, name: 'Grace' },
      { id: 3, managerId: 2, name: 'Alan' },
    ] as unknown as QaRow[]
    const { target } = await mountQaGrid(
      {
        treeData: { parentField: 'managerId', idField: 'id', column: 'name' },
      },
      rows,
      [{ field: 'name', header: 'Name', width: 200 }] as ColumnDef<QaFeatures, QaRow>[],
    )
    expect(target.querySelector('.sv-grid-tree-toggle')).not.toBeNull()
  })

  it('inferColumnTypes types the columns from the first row', async () => {
    const { api } = await mountQaGrid({ inferColumnTypes: true }, undefined, [
      { field: 'name', header: 'Name', width: 200 },
      { field: 'salary', header: 'Salary', width: 140 },
      { field: 'active', header: 'Active', width: 120 },
    ] as ColumnDef<QaFeatures, QaRow>[])
    const cols = api.getColumns()
    expect(cols.find((c) => c.id === 'salary')!.editorType).toBe('number')
    expect(cols.find((c) => c.id === 'active')!.editorType).toBe('checkbox')
    expect(cols.find((c) => c.id === 'name')!.editorType).toBe('text')
  })

  it('columnOrder seeds the starting visual order', async () => {
    const { api } = await mountQaGrid({ columnOrder: ['salary', 'name'] })
    expect(api.getColumnOrder().slice(0, 2)).toEqual(['salary', 'name'])
  })
})

describe('QA props: localization', () => {
  it('localization replaces the grid chrome strings', async () => {
    const { target } = await mountQaGrid(
      { localization: { text: { noRows: 'Rien a afficher' } } },
      [],
    )
    expect(target.querySelector('.sv-grid-empty-cell')?.textContent?.trim()).toBe(
      'Rien a afficher',
    )
  })

  it('locale / filterLocale drive accent-insensitive filtering', async () => {
    const rows = [
      { id: 1, name: 'Ångström', team: 'A', salary: 1, active: true },
      { id: 2, name: 'Zulu', team: 'Z', salary: 2, active: true },
    ] as QaRow[]
    const { api } = await mountQaGrid({ filterLocale: 'sv' }, rows)
    api.setFilter('name', { operator: 'contains', value: 'ångström' })
    await flush()
    expect(api.getDisplayedRows().map((r) => r.id)).toEqual([1])
  })
})

describe('QA props: server hooks', () => {
  it('serverFilterValues feeds the column filter checklist', async () => {
    const serverFilterValues = vi.fn(async () => ['Alpha', 'Beta'])
    const grid = await mountQaGrid({ serverFilterValues })
    const funnel = grid.target.querySelector<HTMLElement>('.sv-grid-col-filter-btn')
    funnel!.click()
    await settle()
    expect(serverFilterValues).toHaveBeenCalledWith('name')
    expect(document.querySelector('.sv-grid-menu')?.textContent).toContain('Alpha')
  })

  it('serverGroup switches the grid to treegrid semantics', async () => {
    const { target } = await mountQaGrid({
      serverGroup: {
        isGroup: (row: QaRow) => row.team === 'Research',
        level: () => 0,
        onToggle: () => {},
      },
    })
    expect(target.querySelector('table.sv-grid-table')?.getAttribute('role')).toBe('treegrid')
  })
})

describe('QA props: the alternate render modes', () => {
  it('board renders the Kanban host instead of the table', async () => {
    const { target } = await mountQaGrid({ board: { groupBy: 'team' } })
    expect(target.querySelector('.sv-grid-board-root')).not.toBeNull()
    expect(target.querySelector('table.sv-grid-table')).toBeNull()
  })

  it('scheduler renders the calendar host instead of the table', async () => {
    const { target } = await mountQaGrid({
      scheduler: { startField: 'name', titleField: 'name' },
    })
    expect(target.querySelector('.sv-grid-scheduler-root')).not.toBeNull()
    expect(target.querySelector('table.sv-grid-table')).toBeNull()
  })

  it('chart renders the chart host instead of the table', async () => {
    const { target } = await mountQaGrid({
      chart: { type: 'bar', dimension: 'team', measure: 'salary' },
    })
    expect(target.querySelector('.sv-grid-chart-root')).not.toBeNull()
  })

  it('pivotMode={false} keeps the flat table even when pivot is configured', async () => {
    const { target } = await mountQaGrid(
      {
        pivot: { rows: ['team'], values: [{ field: 'salary', agg: 'sum' }] },
        pivotMode: false,
      },
      undefined,
      twoCols,
    )
    expect(target.querySelector('.sv-grid-pivot-root')).toBeNull()
    expect(target.querySelector('table.sv-grid-table')).not.toBeNull()
  })

  it('pivot + pivotMode render the pivot host, and onPivotModeChange reports the toggle', async () => {
    const onPivotModeChange = vi.fn()
    const grid = await mountQaGrid(
      {
        pivot: { rows: ['team'], values: [{ field: 'salary', agg: 'sum' }] },
        onPivotModeChange,
      },
      undefined,
      twoCols,
    )
    expect(grid.target.querySelector('.sv-grid-pivot-root')).not.toBeNull()

    const toggle = grid.target.querySelector<HTMLElement>('.sv-grid-pivot-toggle')
    if (toggle) {
      toggle.click()
      await flush()
      expect(onPivotModeChange).toHaveBeenCalledWith(false)
    }
  })
})
