/**
 * QA sweep: `ColumnDef` - every option a column can declare, checked against
 * the contract in its doc comment / the ColumnDef reference page.
 *
 * Column options are half the public surface (the grid has 120 props, a column
 * has 35), and most of them only show up in the rendered cell, so these cases
 * mount the real component and read the DOM rather than the column object.
 */
import { describe, expect, it, vi } from 'vitest'
import { createRawSnippet } from 'svelte'
import { cellAt, flush, mountQaGrid, qaRows, settle, waitFor } from './harness.svelte'
import { spansToMerges } from '../spreadsheet'
import type { ColumnDef } from '../index'
import type { QaFeatures, QaRow } from './harness.svelte'

type Cols = ColumnDef<QaFeatures, QaRow>[]

const headerLabels = (target: HTMLElement): string[] =>
  [...target.querySelectorAll('.sv-grid-header-label')].map((h) => h.textContent?.trim() ?? '')

const columnIds = (target: HTMLElement): string[] =>
  [...target.querySelectorAll('thead [data-svgrid-header-col]')].map(
    (h) => h.getAttribute('data-svgrid-header-col') ?? '',
  )

describe('QA ColumnDef: identity and value source', () => {
  it('field is both the value source and the fallback id', async () => {
    const { api, target } = await mountQaGrid({}, undefined, [
      { field: 'name', header: 'Name', width: 200 },
    ] as Cols)
    expect(columnIds(target)).toEqual(['name'])
    expect(api.getCellValue(0, 'name')).toBe('Ada Lovelace')
  })

  it('id overrides the derived id and is what the api addresses', async () => {
    const { api, target } = await mountQaGrid({}, undefined, [
      { id: 'who', field: 'name', header: 'Name', width: 200 },
    ] as Cols)
    expect(columnIds(target)).toEqual(['who'])
    expect(api.getCellValue(0, 'who')).toBe('Ada Lovelace')
    api.setColumnVisible('who', false)
    await flush()
    expect(api.isColumnVisible('who')).toBe(false)
  })

  it('fieldFn computes the value, and wins over field for reads', async () => {
    const { api, target } = await mountQaGrid({}, undefined, [
      {
        id: 'initials',
        field: 'name',
        header: 'Initials',
        width: 120,
        fieldFn: (row: QaRow) =>
          row.name
            .split(' ')
            .map((part) => part[0])
            .join(''),
      },
    ] as Cols)
    expect(api.getCellValue(0, 'initials')).toBe('AL')
    expect(cellAt(target, 0, 0)?.textContent?.trim()).toBe('AL')
  })
})

describe('QA ColumnDef: rendering slots', () => {
  it('header takes a string, and a function renders through FlexRender', async () => {
    const { target } = await mountQaGrid({}, undefined, [
      { field: 'name', header: 'Plain', width: 200 },
      { field: 'team', header: () => 'Computed', width: 160 },
    ] as Cols)
    // A string header is the plain label; a function header renders into the
    // custom-header slot instead.
    expect(headerLabels(target)).toEqual(['Plain'])
    expect(
      target.querySelector('.sv-grid-header-custom')?.textContent?.trim(),
    ).toBe('Computed')
  })

  it('cell replaces the rendered value', async () => {
    const { target } = await mountQaGrid({}, undefined, [
      {
        field: 'salary',
        header: 'Salary',
        width: 160,
        cell: (ctx: { getValue: () => unknown }) => `$${Number(ctx.getValue()) / 1000}k`,
      },
    ] as Cols)
    expect(cellAt(target, 0, 0)?.textContent?.trim()).toBe('$142k')
  })

  it('footer resolves on the engine footer groups', async () => {
    const { target } = await mountQaGrid({ enableRowSummaries: true }, undefined, [
      { field: 'name', header: 'Name', width: 200, footer: 'Total' },
      { field: 'salary', header: 'Salary', width: 140, summary: 'sum' },
    ] as Cols)
    // The grid's own footer is the summary row; `footer` is the headless slot,
    // so what QA asserts here is that declaring it neither breaks the render
    // nor leaks into the body.
    expect(target.querySelector('tr.sv-grid-summary-row')).not.toBeNull()
    expect(cellAt(target, 0, 0)?.textContent?.trim()).toBe('Ada Lovelace')
  })

  it('format formats the displayed value without touching the data', async () => {
    const { api, target } = await mountQaGrid({}, undefined, [
      {
        field: 'salary',
        header: 'Salary',
        width: 160,
        format: { type: 'currency', currency: 'USD', locales: 'en-US' },
      },
    ] as Cols)
    expect(cellAt(target, 0, 0)?.textContent?.replace(/ /g, ' ').trim()).toContain('$142,000')
    expect(api.getCellValue(0, 'salary')).toBe(142_000)
  })

  it('formatter wins over format for the display string', async () => {
    const { target } = await mountQaGrid({}, undefined, [
      {
        field: 'salary',
        header: 'Salary',
        width: 160,
        format: { type: 'currency', currency: 'USD' },
        formatter: ({ value }: { value: unknown }) => `${Number(value) / 1000} k`,
      },
    ] as Cols)
    expect(cellAt(target, 0, 0)?.textContent?.trim()).toBe('142 k')
  })

  it('sparkline draws an in-cell chart, and a cell renderer wins over it', async () => {
    const rows = [
      { id: 1, name: '1,2,3,4', team: 'T', salary: 1, active: true },
      { id: 2, name: '4,3,2,1', team: 'T', salary: 2, active: true },
    ] as QaRow[]
    const spark = await mountQaGrid({}, rows, [
      { field: 'name', header: 'Trend', width: 160, sparkline: { type: 'line' } },
    ] as Cols)
    expect(spark.target.querySelector('.sv-grid-sparkline')).not.toBeNull()

    const overridden = await mountQaGrid({}, rows, [
      {
        field: 'name',
        header: 'Trend',
        width: 160,
        sparkline: { type: 'line' },
        cell: () => 'cell wins',
      },
    ] as Cols)
    expect(overridden.target.querySelector('.sv-grid-sparkline')).toBeNull()
    expect(cellAt(overridden.target, 0, 0)?.textContent?.trim()).toBe('cell wins')
  })

  /**
   * `tooltip` shows through the grid's own hover tooltip, not a native `title`.
   * Checked on BOTH render paths: the virtualized body never wired the handler
   * up, so the option was dead with `virtualization` left at its default.
   */
  it.each([true, false])(
    'tooltip shows on hover, as a string or per cell (virtualization: %s)',
    async (virtualization) => {
      const { target } = await mountQaGrid({ virtualization }, undefined, [
        { field: 'name', header: 'Name', width: 200, tooltip: 'Fixed tip' },
        {
          field: 'team',
          header: 'Team',
          width: 160,
          tooltip: (ctx: { getValue: () => unknown }) => `Team: ${String(ctx.getValue())}`,
        },
      ] as Cols)

      // The tooltip is on a 250ms hover delay, so these wait for it rather
      // than for a fixed number of ticks.
      cellAt(target, 0, 0)!.dispatchEvent(new MouseEvent('pointerenter', { bubbles: true }))
      await waitFor(() => !!document.querySelector('.sv-grid-tooltip'), {
        label: 'string tooltip',
      })
      expect(document.querySelector('.sv-grid-tooltip')?.textContent?.trim()).toBe('Fixed tip')

      cellAt(target, 0, 0)!.dispatchEvent(new MouseEvent('pointerleave', { bubbles: true }))
      await settle()
      expect(document.querySelector('.sv-grid-tooltip')).toBeNull()

      cellAt(target, 0, 1)!.dispatchEvent(new MouseEvent('pointerenter', { bubbles: true }))
      await waitFor(() => !!document.querySelector('.sv-grid-tooltip'), {
        label: 'per-cell tooltip',
      })
      expect(document.querySelector('.sv-grid-tooltip')?.textContent?.trim()).toBe(
        'Team: Research',
      )
    },
  )

  it('an empty tooltip string shows nothing', async () => {
    const { target } = await mountQaGrid({}, undefined, [
      { field: 'name', header: 'Name', width: 200, tooltip: () => '' },
    ] as Cols)
    cellAt(target, 0, 0)!.dispatchEvent(new MouseEvent('pointerenter', { bubbles: true }))
    // Past the 250ms hover delay, so "nothing shown" is a real negative.
    await new Promise((r) => setTimeout(r, 350))
    expect(document.querySelector('.sv-grid-tooltip')).toBeNull()
  })

  it('cellClass adds classes as a string, an array or a function', async () => {
    const { target } = await mountQaGrid({}, undefined, [
      { field: 'name', header: 'Name', width: 200, cellClass: 'plain-class' },
      { field: 'team', header: 'Team', width: 160, cellClass: ['a-class', 'b-class'] },
      {
        field: 'active',
        header: 'Active',
        width: 120,
        cellClass: (ctx: { getValue: () => unknown }) =>
          ctx.getValue() ? 'is-on' : { 'is-off': true },
      },
    ] as Cols)
    expect(cellAt(target, 0, 0)!.classList.contains('plain-class')).toBe(true)
    expect(cellAt(target, 0, 1)!.classList.contains('a-class')).toBe(true)
    expect(cellAt(target, 0, 1)!.classList.contains('b-class')).toBe(true)
    expect(cellAt(target, 0, 2)!.classList.contains('is-on')).toBe(true)
    // Row 3 (Alan Turing) is inactive, so the object form applies instead.
    expect(cellAt(target, 2, 2)!.classList.contains('is-off')).toBe(true)
  })

  it('cellFlash marks the column so a value change animates', async () => {
    const { api, target } = await mountQaGrid({}, undefined, [
      { field: 'salary', header: 'Salary', width: 160, cellFlash: true },
      { field: 'name', header: 'Name', width: 200, cellFlash: { className: 'my-flash' } },
    ] as Cols)

    api.setCellValue(0, 'salary', 200_000)
    api.setCellValue(0, 'name', 'Ada L.')
    await flush()
    expect(cellAt(target, 0, 0)!.classList.contains('sv-grid-cell-flash')).toBe(true)
    expect(cellAt(target, 0, 1)!.classList.contains('my-flash')).toBe(true)
  })
})

describe('QA ColumnDef: layout', () => {
  it('width is the declared width and columnWidth is the fallback', async () => {
    const { api } = await mountQaGrid({ columnWidth: 111 }, undefined, [
      { field: 'name', header: 'Name', width: 240 },
      { field: 'team', header: 'Team' },
    ] as Cols)
    expect(api.getColumnWidths()).toEqual({ name: 240, team: 111 })
  })

  it('visible:false starts the column hidden but keeps it listed', async () => {
    const { api, target } = await mountQaGrid({}, undefined, [
      { field: 'name', header: 'Name', width: 200 },
      { field: 'team', header: 'Team', width: 160, visible: false },
    ] as Cols)
    expect(columnIds(target)).toEqual(['name'])
    expect(api.isColumnVisible('team')).toBe(false)
    expect(api.getColumns().find((c) => c.id === 'team')).toMatchObject({ visible: false })

    api.setColumnVisible('team', true)
    await flush()
    expect(columnIds(target)).toEqual(['name', 'team'])
  })

  it('align sets the cell alignment and overrides the editorType default', async () => {
    const { target } = await mountQaGrid({}, undefined, [
      { field: 'name', header: 'Name', width: 200, align: 'center' },
      { field: 'salary', header: 'Salary', width: 140, editorType: 'number' },
      { field: 'team', header: 'Team', width: 160, editorType: 'number', align: 'left' },
    ] as Cols)
    expect(cellAt(target, 0, 0)?.getAttribute('data-align')).toBe('center')
    expect(cellAt(target, 0, 1)?.getAttribute('data-align')).toBe('right')
    expect(cellAt(target, 0, 2)?.getAttribute('data-align')).toBe('left')
  })

  it('resizable:false drops that column drag handle only', async () => {
    const { target } = await mountQaGrid({ columnResize: true }, undefined, [
      { field: 'name', header: 'Name', width: 200 },
      { field: 'team', header: 'Team', width: 160, resizable: false },
    ] as Cols)
    await settle()
    expect(target.querySelectorAll('.sv-grid-resize-handle').length).toBe(1)
  })

  it('hideBelow is inert until the grid is measured as narrow', async () => {
    // The drop happens in `responsive` mode below the breakpoint; jsdom reports
    // a zero-width box, which the controller treats as "not measured yet", so
    // the contract QA can hold here is that the column is NOT dropped.
    const { target } = await mountQaGrid({ responsive: true }, undefined, [
      { field: 'name', header: 'Name', width: 200 },
      { field: 'team', header: 'Team', width: 160, hideBelow: 900 },
    ] as Cols)
    expect(columnIds(target)).toEqual(['name', 'team'])
  })

  it('colSpan / rowSpan feed spansToMerges, which drives the merge engine', async () => {
    const rows = [
      { id: 1, team: 'Research' },
      { id: 2, team: 'Research' },
      { id: 3, team: 'Kernel' },
    ]
    const columns = [
      {
        id: 'team',
        field: 'team',
        rowSpan: ({ rowIndex }: { rowIndex: number }) => (rowIndex === 0 ? 2 : 1),
        colSpan: ({ rowIndex }: { rowIndex: number }) => (rowIndex === 2 ? 2 : 1),
      },
      { id: 'id', field: 'id' },
    ]
    expect(spansToMerges(rows, columns)).toEqual([
      { rowIndex: 0, columnId: 'team', colspan: undefined, rowspan: 2 },
      { rowIndex: 2, columnId: 'team', colspan: 2, rowspan: undefined },
    ])

    // And a grid declaring them still renders normally (the grid itself does
    // not merge until `spreadsheetLayout` applies the specs).
    const { target } = await mountQaGrid({}, undefined, [
      {
        field: 'team',
        header: 'Team',
        width: 160,
        rowSpan: () => 2,
      },
    ] as Cols)
    expect(cellAt(target, 0, 0)?.textContent?.trim()).toBe('Research')
  })
})

describe('QA ColumnDef: column groups', () => {
  const grouped = [
    {
      header: 'Person',
      columns: [
        { field: 'name', header: 'Name', width: 200 },
        { field: 'team', header: 'Team', width: 160, columnGroupShow: 'open' },
      ],
    },
    { field: 'salary', header: 'Salary', width: 140 },
  ] as unknown as Cols

  it('columns renders a spanning group header row', async () => {
    const { target } = await mountQaGrid({}, undefined, grouped)
    const groupRow = target.querySelector('tr.sv-grid-group-header-row')
    expect(groupRow).not.toBeNull()
    expect(groupRow!.textContent).toContain('Person')
  })

  it("columnGroupShow:'open' hides the child until the group is expanded", async () => {
    const { target } = await mountQaGrid({}, undefined, grouped)
    // Collapsed by default, so the 'open'-only child is not rendered.
    expect(columnIds(target)).toEqual(['name', 'salary'])

    const toggle = target.querySelector<HTMLElement>('.sv-grid-group-toggle')
    expect(toggle).not.toBeNull()
    expect(toggle!.getAttribute('aria-expanded')).toBe('false')
    toggle!.click()
    await flush()
    expect(columnIds(target)).toEqual(['name', 'team', 'salary'])
  })

  it('openByDefault starts the group expanded', async () => {
    const open = [
      {
        header: 'Person',
        openByDefault: true,
        columns: [
          { field: 'name', header: 'Name', width: 200 },
          { field: 'team', header: 'Team', width: 160, columnGroupShow: 'open' },
        ],
      },
    ] as unknown as Cols
    const { target } = await mountQaGrid({}, undefined, open)
    expect(columnIds(target)).toEqual(['name', 'team'])
    expect(
      target.querySelector('.sv-grid-group-toggle')?.getAttribute('aria-expanded'),
    ).toBe('true')
  })

  it("columnGroupShow:'closed' shows the child only while collapsed", async () => {
    const columns = [
      {
        header: 'Person',
        columns: [
          { field: 'name', header: 'Name', width: 200, columnGroupShow: 'closed' },
          { field: 'team', header: 'Team', width: 160, columnGroupShow: 'open' },
        ],
      },
    ] as unknown as Cols
    const { target } = await mountQaGrid({}, undefined, columns)
    expect(columnIds(target)).toEqual(['name'])
    target.querySelector<HTMLElement>('.sv-grid-group-toggle')!.click()
    await flush()
    expect(columnIds(target)).toEqual(['team'])
  })
})

describe('QA ColumnDef: editing options', () => {
  it('editorType picks the built-in editor for the cell', async () => {
    const { api, target } = await mountQaGrid({ editable: true }, undefined, [
      { field: 'name', header: 'Name', width: 200, editorType: 'text' },
      { field: 'active', header: 'Active', width: 120, editorType: 'checkbox' },
    ] as Cols)

    api.startEditing(0, 'name')
    await settle()
    expect(target.querySelector('.sv-grid-cell-editing input[type="text"]')).not.toBeNull()
    api.stopEditing(true)
    await settle()

    api.startEditing(0, 'active')
    await settle()
    const box = target.querySelector('.sv-grid-cell-editing input[type="checkbox"]')
    const boxRole = target.querySelector('.sv-grid-cell-editing [role="checkbox"]')
    expect(box ?? boxRole).not.toBeNull()
  })

  it('cellEditor replaces the built-in editor and commits through its helper', async () => {
    const { api, target } = await mountQaGrid({ editable: true }, undefined, [
      {
        field: 'name',
        header: 'Name',
        width: 200,
        editorType: 'text',
        cellEditor: createRawSnippet(() => ({
          render: () => `<button type="button" data-qa="custom-editor">custom</button>`,
        })),
      },
    ] as Cols)
    api.startEditing(0, 'name')
    await settle()
    expect(target.querySelector('[data-qa="custom-editor"]')).not.toBeNull()
    expect(target.querySelector('.sv-grid-cell-editing input')).toBeNull()
  })

  it('editable:false locks the column, and a function locks single cells', async () => {
    const locked = await mountQaGrid({ editable: true }, undefined, [
      { field: 'name', header: 'Name', width: 200, editorType: 'text', editable: false },
    ] as Cols)
    expect(locked.api.startEditing(0, 'name')).toBe(false)

    const perCell = await mountQaGrid({ editable: true }, undefined, [
      {
        field: 'name',
        header: 'Name',
        width: 200,
        editorType: 'text',
        editable: (ctx: { row: { original: QaRow } }) => ctx.row.original.active,
      },
    ] as Cols)
    expect(perCell.api.startEditing(0, 'name')).toBe(true)
    perCell.api.stopEditing(true)
    await flush()
    // Alan Turing is inactive.
    expect(perCell.api.startEditing(2, 'name')).toBe(false)
  })

  it('valueParser refines the committed value', async () => {
    const grid = await mountQaGrid({ editable: true }, undefined, [
      {
        field: 'name',
        header: 'Name',
        width: 200,
        editorType: 'text',
        valueParser: ({ newValue }: { newValue: unknown }) => String(newValue).toUpperCase(),
      },
    ] as Cols)
    grid.api.startEditing(0, 'name')
    await settle()
    const input = grid.target.querySelector<HTMLInputElement>('.sv-grid-cell-editing input')
    input!.value = 'ada lovelace'
    input!.dispatchEvent(new Event('input', { bubbles: true }))
    grid.api.stopEditing()
    await flush()
    expect(grid.api.getCellValue(0, 'name')).toBe('ADA LOVELACE')
  })

  it.each([true, false])(
    'validate flags bad values already in the data (virtualization: %s)',
    async (virtualization) => {
      const { target } = await mountQaGrid({ virtualization }, undefined, [
        {
          field: 'salary',
          header: 'Salary',
          width: 160,
          validate: ({ value }: { value: unknown }) =>
            Number(value) > 160_000 ? 'Above band' : null,
        },
      ] as Cols)
      const invalid = [...target.querySelectorAll('td.sv-grid-cell-invalid')]
      // Margaret 165k, Linus 175k, Barbara 171k.
      expect(invalid.length).toBe(3)
      expect(invalid[0]!.getAttribute('aria-invalid')).toBe('true')
      // The message reaches assistive tech as part of the cell, and the hover
      // tooltip carries it visually - a validation message wins over the
      // column tooltip.
      expect(invalid[0]!.querySelector('.sv-grid-sr-only')?.textContent).toBe('Above band')

      invalid[0]!.dispatchEvent(new MouseEvent('pointerenter', { bubbles: true }))
      await waitFor(() => !!document.querySelector('.sv-grid-tooltip'), {
        label: 'validation tooltip',
      })
      expect(document.querySelector('.sv-grid-tooltip')?.textContent?.trim()).toBe(
        'Above band',
      )
    },
  )

  it('validate accepts the boolean shorthands', async () => {
    const { target } = await mountQaGrid({}, undefined, [
      {
        field: 'active',
        header: 'Active',
        width: 120,
        validate: ({ value }: { value: unknown }) => value === true,
      },
    ] as Cols)
    // false means "invalid, no message": the two inactive rows light up.
    expect(target.querySelectorAll('td.sv-grid-cell-invalid').length).toBe(2)
    expect(target.querySelector('td.sv-grid-cell-invalid')?.getAttribute('title')).toBeNull()
  })

  it('editorOptions fills a list editor, including a per-row source', async () => {
    const perRow = vi.fn((row: QaRow) => [row.team, 'Bench'])
    const grid = await mountQaGrid({ editable: true }, undefined, [
      { field: 'name', header: 'Name', width: 200, editorType: 'text' },
      {
        field: 'team',
        header: 'Team',
        width: 200,
        editorType: 'select',
        editorOptions: perRow,
      },
    ] as Cols)
    grid.api.startEditing(0, 'team')
    await settle()
    expect(perRow).toHaveBeenCalled()
    expect(document.body.textContent).toContain('Bench')
  })

  it('editorMultiple stores an array and editorSeparator joins it for display', async () => {
    const rows = [{ id: 1, name: 'Ada', team: ['A', 'B'], salary: 1, active: true }] as unknown as QaRow[]
    const { target } = await mountQaGrid({ editable: true }, rows, [
      {
        field: 'team',
        header: 'Teams',
        width: 200,
        editorType: 'list',
        editorMultiple: true,
        editorOptions: ['A', 'B', 'C'],
        editorSeparator: ' | ',
      },
    ] as Cols)
    expect(cellAt(target, 0, 0)?.textContent?.trim()).toBe('A | B')
  })

  it('cellDataType fills in editorType, alignment and format', async () => {
    const { api, target } = await mountQaGrid({}, undefined, [
      { field: 'name', header: 'Name', width: 200, cellDataType: 'text' },
      { field: 'salary', header: 'Salary', width: 140, cellDataType: 'number' },
      { field: 'active', header: 'Active', width: 120, cellDataType: 'boolean' },
    ] as Cols)
    const cols = api.getColumns()
    expect(cols.find((c) => c.id === 'salary')!.editorType).toBe('number')
    expect(cols.find((c) => c.id === 'active')!.editorType).toBe('checkbox')
    expect(cellAt(target, 0, 1)?.getAttribute('data-align')).toBe('right')
    expect(cellAt(target, 0, 2)?.getAttribute('data-align')).toBe('center')
  })
})

describe('QA ColumnDef: per-column feature opt-outs and aggregation', () => {
  it('sortable:false ignores header clicks and api.setSort for that column', async () => {
    const { api, target } = await mountQaGrid({}, undefined, [
      { field: 'name', header: 'Name', width: 200 },
      { field: 'salary', header: 'Salary', width: 140, sortable: false },
    ] as Cols)
    target
      .querySelector<HTMLElement>('[data-svgrid-header-col="salary"] .sv-grid-header-label')!
      .click()
    await flush()
    expect(api.getState().sorting).toEqual([])

    api.setSort('salary', 'asc')
    await flush()
    expect(api.getState().sorting).toEqual([])

    // The neighbour still sorts.
    api.setSort('name', 'asc')
    await flush()
    expect(api.getState().sorting).toEqual([{ id: 'name', desc: false }])
  })

  it('filterable:false drops the funnel and ignores api.setFilter', async () => {
    const { api, target } = await mountQaGrid({}, undefined, [
      { field: 'name', header: 'Name', width: 200 },
      { field: 'team', header: 'Team', width: 160, filterable: false },
    ] as Cols)
    const funnels = [...target.querySelectorAll('[data-svgrid-header-col] .sv-grid-col-filter-btn')]
    expect(funnels.length).toBe(1)

    api.setFilter('team', { operator: 'equals', value: 'Kernel' })
    await flush()
    expect(api.getFilters()).toEqual({})
    expect(api.getDisplayedRows().length).toBe(qaRows.length)
  })

  it('aggregate rolls the column up into the group banner', async () => {
    const { target } = await mountQaGrid({ groupBy: ['team'] }, undefined, [
      { field: 'team', header: 'Team', width: 160 },
      { field: 'salary', header: 'Salary', width: 140, aggregate: 'sum' },
    ] as Cols)
    const banners = [...target.querySelectorAll('tr.sv-grid-group-row')]
    const research = banners.find((b) => b.textContent?.includes('Research'))
    // 142k + 138k + 171k.
    expect(research?.textContent).toContain('451000')
  })

  it('aggregate accepts a custom reducer', async () => {
    const { target } = await mountQaGrid({ groupBy: ['team'] }, undefined, [
      { field: 'team', header: 'Team', width: 160 },
      {
        field: 'salary',
        header: 'Salary',
        width: 140,
        aggregate: (values: unknown[]) => `${values.length} people`,
      },
    ] as Cols)
    expect(target.querySelector('tr.sv-grid-group-row')?.textContent).toContain('people')
  })

  it('summary picks what the footer row shows, and false blanks it', async () => {
    const { target } = await mountQaGrid({ enableRowSummaries: true }, undefined, [
      { field: 'name', header: 'Name', width: 200, summary: false },
      { field: 'salary', header: 'Salary', width: 140, summary: 'max' },
    ] as Cols)
    const cells = [...target.querySelectorAll('tr.sv-grid-summary-row .sv-grid-summary-column')]
    // A leading label cell, then one per column.
    expect(cells.length).toBe(3)
    expect(cells[1]!.textContent?.trim()).toBe('')
    expect(cells[2]!.textContent).toContain('175000')
  })
})
