/**
 * DOM test: the shell saves and restores its document and reports changes.
 *
 * `getState()` carries what the user did (a cell, a format), `setState()`
 * puts a saved document back into the same workbook object, a document
 * the consumer supplies is the one written to, and `onChange` hears every
 * reason once per tick.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, unmount, flushSync, tick } from 'svelte'
import SvSheet from './SvSheet.svelte'
import { createSheetDocument, type SheetDocument, type SheetChangeReason } from './sheet/document'
import type { GridCommandContext } from '@svgrid/grid/shortcuts'

// jsdom lacks the layout observers the grid touches on mount, and the
// enterprise dom project has no shared setup file.
for (const name of ['ResizeObserver', 'IntersectionObserver'] as const) {
  if (typeof (globalThis as Record<string, unknown>)[name] === 'undefined') {
    ;(globalThis as Record<string, unknown>)[name] = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return [] }
    }
  }
}
if (typeof HTMLElement.prototype.scrollIntoView !== 'function') HTMLElement.prototype.scrollIntoView = () => {}

let host: HTMLElement | null = null
let comp: ReturnType<typeof mount> | null = null
afterEach(() => {
  if (comp) { unmount(comp); comp = null }
  if (host) { host.remove(); host = null }
})

type Ready = {
  api: {
    getCommandContext(): GridCommandContext; clearHistory(): void
    setColumnWidth(id: string, px: number): void; setRowHeight(i: number, px: number | null): void; setRowCollapsed(i: number, on: boolean): void
  }
  doc: SheetDocument
}

function mountSheet(props: Record<string, unknown> = {}): Promise<Ready & { sheet: SvSheet }> {
  return new Promise((resolve) => {
    host = document.createElement('div')
    document.body.appendChild(host)
    const sheet = mount(SvSheet, {
      target: host,
      props: {
        data: [{ name: 'Sheet1', cells: [['1', '2'], ['=A1+B1']] }],
        rows: 5,
        columns: 3,
        showRibbon: false,
        onReady: (api: Ready['api'], doc: SheetDocument) => resolve({ api, doc, sheet }),
        ...props,
      },
    }) as unknown as SvSheet
    comp = sheet as unknown as ReturnType<typeof mount>
    flushSync()
  })
}

describe('SvSheet document state', () => {
  it('getState carries a typed cell and a format, and setState puts them back', async () => {
    const { api, sheet } = await mountSheet()
    const cmd = api.getCommandContext()
    cmd.setCellValue(1, 1, 'hello')
    flushSync()
    await tick()
    const state = sheet.getState()
    expect(state.version).toBe(1)
    expect(state.workbook.sheets[0]!.cells[1]![1]).toBe('hello')
    expect(state.workbook.sheets[0]!.cells[1]![0]).toBe('=A1+B1')
    expect(Object.keys(state.sheets)).toEqual(['Sheet1'])

    // Change it, restore the save.
    cmd.setCellValue(1, 1, 'changed')
    flushSync()
    sheet.setState(JSON.parse(JSON.stringify(state)))
    flushSync()
    await tick()
    expect(sheet.getState().workbook.sheets[0]!.cells[1]![1]).toBe('hello')
  })

  it('writes into the document the consumer supplied, and onReady hands it back', async () => {
    const doc = createSheetDocument({ sheets: [{ name: 'Data', cells: [['x']] }] })
    const { api, doc: given } = await mountSheet({ data: undefined, document: doc })
    expect(given).toBe(doc)
    api.getCommandContext().setCellValue(0, 1, 'y')
    flushSync()
    expect(doc.workbook.getRaw('Data', 0, 1)).toBe('y')
    expect(doc.getState().workbook.sheets[0]!.name).toBe('Data')
  })

  it('a document built from a saved state shows its hidden rows, widths and filter from the first paint', async () => {
    const seed = createSheetDocument({ sheets: [{ name: 'Log', cells: [['Status'], ['open'], ['done'], ['open']] }] })
    const s = seed.get('Log')
    s.hidden = { rows: new Set([3]), cols: new Set() }
    s.widths = { A: 210 }
    s.freeze = { rows: 1, cols: 0 }
    s.autoFilter = { range: [0, 0, 3, 0], filters: { 0: { kind: 'values', excluded: ['done'] } } }
    const doc = createSheetDocument({ state: seed.getState() })
    const { api } = await mountSheet({ data: undefined, document: doc, rows: 6, columns: 2 })
    flushSync()
    const grid = api as unknown as { isRowCollapsed(i: number): boolean; getColumnWidths(): Record<string, number>; getFrozenRows?: () => number }
    expect(grid.isRowCollapsed(3)).toBe(true)
    expect(grid.isRowCollapsed(2)).toBe(true)
    expect(grid.isRowCollapsed(1)).toBe(false)
    expect(grid.getColumnWidths().A).toBe(210)
    expect(doc.get('Log').filterHidden.has(2)).toBe(true)
  })

  it('reports changes once per tick with their reasons', async () => {
    const seen: SheetChangeReason[][] = []
    const { api } = await mountSheet({ onChange: (reasons: SheetChangeReason[]) => seen.push([...reasons]) })
    const cmd = api.getCommandContext()
    cmd.setCellValue(0, 0, '5')
    cmd.setCellValue(0, 1, '6')
    flushSync()
    expect(seen).toEqual([])
    await Promise.resolve()
    expect(seen.length).toBe(1)
    expect(seen[0]!.map((r) => r.kind)).toEqual(['cells'])
  })

  it('every part of a sheet rides through getState and setState: formats, sizes, hidden lines, freeze, comments, protection, validation, conditional formats', async () => {
    const { api, doc, sheet } = await mountSheet()
    const s = doc.get('Sheet1')
    const lookup = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }
    s.formats.set([[0, 0, 0, 0]], { bold: true, locked: false }, lookup)
    // Sizes and hidden lines live on the grid while a sheet shows; getState
    // reads them back from there, so they are set through the api.
    api.setColumnWidth('B', 180)
    api.setRowHeight(1, 44)
    // Row 3 gets a height of its own and is then hidden: the hiding is in
    // the hidden set, the height stays what it was, never the 0 a hidden
    // row reports.
    api.setRowHeight(3, 52)
    flushSync()
    // A drag or the Row Height dialog stash the height as they go; the api
    // call here does not, so a save stands in for that before the hide.
    sheet.getState()
    api.setRowCollapsed(3, true)
    flushSync()
    s.freeze = { rows: 1, cols: 0 }
    s.notes = { r1: { B: 'a note' } }
    s.protected = true
    s.validation = [{ id: 'v1', rects: [[0, 1, 4, 1]], allow: 'list', value1: 'a,b', ignoreBlank: true, inCellDropdown: true, alert: { style: 'stop', title: 'Pick' } }]
    s.conditionalFormats = [{ id: 'c1', rects: [[0, 0, 4, 0]], kind: 'cellIs', operator: 'greater', value1: '0', style: { fill: '#FFC7CE' }, stopIfTrue: true }]
    const state = JSON.parse(JSON.stringify(sheet.getState()))
    const entry = state.sheets.Sheet1
    expect(Object.values(entry.formats)).toEqual([{ bold: true, locked: false }])
    expect(entry.columnWidths.B).toBe(180)
    expect(entry.rowHeights).toEqual([[1, 44], [3, 52]])
    expect(entry.hidden).toEqual({ rows: [3], cols: [] })
    expect(entry.freeze).toEqual({ rows: 1, cols: 0 })
    expect(entry.comments).toEqual({ r1: { B: 'a note' } })
    expect(entry.protected).toBe(true)
    expect(entry.validation).toEqual(s.validation)
    expect(entry.conditionalFormats).toEqual(s.conditionalFormats)

    // Wipe everything, then restore: the same document object holds it all again.
    s.formats.clear([[0, 0, 4, 2]], lookup)
    s.widths = {}
    s.heights = new Map()
    s.hidden = { rows: new Set(), cols: new Set() }
    s.freeze = { rows: 0, cols: 0 }
    s.notes = {}
    s.protected = false
    s.validation = []
    s.conditionalFormats = []
    sheet.setState(state)
    flushSync()
    await tick()
    const back = doc.get('Sheet1')
    expect(back).toBe(s)
    expect(back.formats.get('r0', 'A')).toEqual({ bold: true, locked: false })
    expect(back.widths.B).toBe(180)
    expect([...back.heights]).toEqual([[1, 44], [3, 52]])
    expect([...back.hidden.rows]).toEqual([3])
    expect(back.freeze).toEqual({ rows: 1, cols: 0 })
    expect(back.notes).toEqual({ r1: { B: 'a note' } })
    expect(back.protected).toBe(true)
    expect(back.validation).toEqual(entry.validation)
    expect(back.conditionalFormats).toEqual(entry.conditionalFormats)
    // And the second getState says the same thing: the round trip is stable.
    expect(JSON.parse(JSON.stringify(sheet.getState())).sheets.Sheet1).toEqual(entry)
  })

  it('a restore clears the grid history', async () => {
    const { api, sheet } = await mountSheet()
    const cmd = api.getCommandContext()
    const saved = sheet.getState()
    cmd.setCellValue(0, 0, '9')
    flushSync()
    const clear = vi.spyOn(api, 'clearHistory')
    sheet.setState(saved)
    flushSync()
    expect(clear).toHaveBeenCalled()
  })
})


describe('SvSheet files', () => {
  it('saves the document as xlsx, opens it back, exports the active sheet as CSV, and starts over', async () => {
    const { sheet, doc } = await mountSheet({ data: [{ name: 'Budget', cells: [['Line', 'Jan'], ['Rent', '2400'], ['Total', '=B2*2']] }] })
    doc.get('Budget').formats.set([[0, 0, 0, 1]], { bold: true }, { rowIdAt: (i) => `r${i}`, columnIdAt: (i) => String.fromCharCode(65 + i) })
    expect(sheet.toCsv()).toBe('Line,Jan\r\nRent,2400\r\nTotal,4800')
    const blob = await sheet.toXlsx()
    expect(blob.size).toBeGreaterThan(0)

    sheet.newWorkbook()
    flushSync()
    expect(doc.workbook.sheets).toEqual(['Sheet1'])
    expect(doc.workbook.getRaw('Sheet1', 1, 1)).toBe('')

    await sheet.open(blob)
    flushSync()
    expect(doc.workbook.sheets).toEqual(['Budget'])
    expect(doc.workbook.getRaw('Budget', 2, 1)).toBe('=B2*2')
    expect(doc.workbook.getValue('Budget', 2, 1)).toBe(4800)
    expect(doc.get('Budget').formats.get('r0', 'B')).toEqual({ bold: true })
  })
})

describe('SvSheet formula auditing', () => {
  it('traces precedents a level at a time, dependents too, and Remove Arrows clears them', async () => {
    const { sheet, api } = await mountSheet({ data: [{ name: 'Sheet1', cells: [['1', '2', '=A1+B1'], ['=C1*2', '', '=A2+1']] }] })
    const cmd = api.getCommandContext()
    const paint = async () => { flushSync(); await tick(); await new Promise((r) => requestAnimationFrame(() => r(null))); flushSync() }
    const arrows = () => host!.querySelectorAll('.sheet-trace-arrow').length
    // A2 reads C1, which reads A1 and B1: one arrow, then two more.
    cmd.setActiveCell(1, 0); cmd.setSelection(1, 0)
    await paint()
    sheet.act('trace-precedents')
    await paint()
    expect(arrows()).toBe(1)
    sheet.act('trace-precedents')
    await paint()
    expect(arrows()).toBe(3)
    sheet.act('remove-arrows')
    await paint()
    expect(arrows()).toBe(0)
    // A1 is read by C1; C1 by A2; A2 by C2.
    cmd.setActiveCell(0, 0); cmd.setSelection(0, 0)
    await paint()
    sheet.act('trace-dependents')
    await paint()
    expect(arrows()).toBe(1)
    sheet.act('trace-dependents')
    await paint()
    expect(arrows()).toBe(2)
    sheet.act('trace-dependents')
    await paint()
    expect(arrows()).toBe(3)
  })
})

describe('SvSheet data validation chrome', () => {
  it('shows a rule\'s input message under the selected cell, and circles the cells that break rules', async () => {
    const doc = createSheetDocument({ sheets: [{ name: 'Sheet1', cells: [['7', 'x'], ['abc', '']] }] })
    const s = doc.get('Sheet1')
    s.validation = [{
      id: 'v1', rects: [[0, 0, 1, 0]], allow: 'whole', operator: 'between', value1: '1', value2: '10',
      ignoreBlank: true, inCellDropdown: false, alert: { style: 'stop' }, input: { title: 'Score', message: '1 to 10' },
    }]
    const { sheet } = await mountSheet({ document: doc, data: undefined })
    await tick()
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    flushSync()
    const box = host!.querySelector('.sheet-input-message')
    expect(box?.querySelector('.title')?.textContent).toBe('Score')
    expect(box?.querySelector('.text')?.textContent).toBe('1 to 10')
    // Nothing circled until asked; then A2 ("abc" under a whole-number rule) is.
    expect(host!.querySelectorAll('.sheet-invalid-circle')).toHaveLength(0)
    sheet.act('circle-invalid')
    flushSync()
    await tick()
    const circled = [...host!.querySelectorAll('td .sheet-invalid-circle')].map((el) => el.closest('td')!.getAttribute('data-svgrid-row') + ',' + el.closest('td')!.getAttribute('data-svgrid-col'))
    expect(circled).toEqual(['1,0'])
    sheet.act('clear-circles')
    flushSync()
    await tick()
    expect(host!.querySelectorAll('.sheet-invalid-circle')).toHaveLength(0)
  })
})

describe('SvSheet marching ants', () => {
  const outline = () => [...document.querySelectorAll('.sheet-ants')].map((el) => {
    const td = el.closest('td')!
    return `${td.getAttribute('data-svgrid-row')}:${td.getAttribute('data-svgrid-col')}=${[...el.classList].filter((c) => c !== 'sheet-ants' && !c.startsWith('svelte-')).sort().join('+')}`
  }).sort()

  it('a copy outlines the block on the cells at its edges, a write clears it, a paste keeps it', async () => {
    const { api } = await mountSheet({ rows: 4, columns: 3 })
    const cmd = api.getCommandContext()
    expect(outline()).toEqual([])
    cmd.setSelection(0, 0)
    cmd.extendSelection(1, 1)
    flushSync()
    // jsdom has no clipboard; the walk over the cells is what sets the ants.
    cmd.copy()
    flushSync()
    expect(outline()).toEqual(['0:0=left+top', '0:1=right+top', '1:0=bottom+left', '1:1=bottom+right'])
    cmd.setActiveCell(3, 2)
    flushSync()
    expect(outline().length).toBe(4)
    cmd.setCellValue(3, 2, 'typed')
    flushSync()
    expect(outline()).toEqual([])
  })

  it('the ants belong to the sheet they were copied on', async () => {
    const { api, doc, sheet } = await mountSheet({
      data: [{ name: 'Sheet1', cells: [['1', '2']] }, { name: 'Sheet2', cells: [['x']] }],
      rows: 4, columns: 3,
    })
    const cmd = api.getCommandContext()
    cmd.setSelection(0, 0)
    flushSync()
    cmd.copy()
    flushSync()
    expect(outline()).toEqual(['0:0=bottom+left+right+top'])
    doc.workbook.setActive('Sheet2')
    sheet.refresh()
    flushSync()
    expect(outline()).toEqual([])
    doc.workbook.setActive('Sheet1')
    sheet.refresh()
    flushSync()
    expect(outline()).toEqual(['0:0=bottom+left+right+top'])
  })
  it('Enter while the ants are up pastes the block once and drops them; Ctrl+V keeps them', async () => {
    const { api, doc } = await mountSheet({ rows: 5, columns: 3 })
    const cmd = api.getCommandContext()
    cmd.setSelection(0, 0)
    cmd.extendSelection(0, 1)
    flushSync()
    cmd.copy()
    flushSync()
    expect(outline().length).toBe(2)
    cmd.setSelection(3, 0)
    flushSync()
    const table = document.querySelector('.sv-sheet table.sv-grid-table') as HTMLElement
    table.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    flushSync()
    expect(doc.workbook.getRaw('Sheet1', 3, 0)).toBe('1')
    expect(doc.workbook.getRaw('Sheet1', 3, 1)).toBe('2')
    expect(outline()).toEqual([])
    // Without ants, Enter is the grid's own key again: nothing pasted.
    cmd.setSelection(4, 0)
    flushSync()
    table.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    flushSync()
    expect(doc.workbook.getRaw('Sheet1', 4, 0)).toBe('')
  })
  it('Escape puts the ants away', async () => {
    const { api } = await mountSheet({ rows: 4, columns: 3 })
    const cmd = api.getCommandContext()
    cmd.setSelection(0, 0)
    flushSync()
    cmd.copy()
    flushSync()
    expect(outline()).toEqual(['0:0=bottom+left+right+top'])
    const table = document.querySelector('.sv-sheet table.sv-grid-table') as HTMLElement
    table.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    flushSync()
    expect(outline()).toEqual([])
  })

  it('an allow list opens what it names and an edit range takes an edit on a protected sheet; both ride the state and the dialogs open', async () => {
    const { api, doc, sheet } = await mountSheet({ rows: 6, columns: 4 })
    const s = doc.get('Sheet1')
    s.protected = true
    s.protection = { allow: { formatRows: true }, ranges: [{ id: 'r1', title: 'Inputs', rects: [[1, 1, 2, 1]] }] }
    sheet.refresh()
    flushSync()
    const cmd = api.getCommandContext()
    expect(cmd.canEdit!(1, 1)).toBe(true)
    expect(cmd.canEdit!(2, 1)).toBe(true)
    expect(cmd.canEdit!(0, 0)).toBe(false)
    expect(cmd.canEdit!(3, 1)).toBe(false)

    // The state carries the list and the ranges, and an insert moves a range.
    const state = JSON.parse(JSON.stringify(sheet.getState()))
    expect(state.sheets.Sheet1.protection).toEqual({ allow: { formatRows: true }, ranges: [{ id: 'r1', title: 'Inputs', rects: [[1, 1, 2, 1]] }] })
    doc.shift('Sheet1', { kind: 'insertRows', at: 0, count: 2 })
    expect(s.protection.ranges[0]!.rects).toEqual([[3, 1, 4, 1]])
    s.protection = { allow: {}, ranges: [] }
    sheet.setState(state)
    flushSync()
    await tick()
    expect(doc.get('Sheet1').protection).toEqual(state.sheets.Sheet1.protection)

    // Protect Sheet opens its dialog rather than protecting outright; Allow Edit Ranges opens its own.
    s.protected = false
    sheet.refresh()
    sheet.act('protect-sheet')
    flushSync()
    expect(document.querySelector('.sv-modal')?.textContent).toContain('Allow all users of this worksheet to:')
    expect(s.protected).toBe(false)
    ;[...document.querySelectorAll('.sv-modal button')].find((b) => b.textContent === 'OK')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    flushSync()
    expect(s.protected).toBe(true)
    // The dialog opened on the sheet's own list, so OK kept it.
    expect(s.protection.allow).toEqual({ formatRows: true })
    sheet.act('allow-edit-ranges')
    flushSync()
    expect(document.querySelector('.sv-modal')?.textContent).toContain('Ranges unlocked when the sheet is protected:')
  })

  it('Page Layout: the ribbon actions change the setup, Set Print Area takes the selection, and printHtml reads it all', async () => {
    const { api, doc, sheet } = await mountSheet({ rows: 6, columns: 4 })
    const s = doc.get('Sheet1')
    sheet.act('page-landscape')
    sheet.act('paper-letter')
    sheet.act('margins-narrow')
    sheet.act('print-gridlines')
    flushSync()
    expect(s.pageSetup).toMatchObject({ orientation: 'landscape', paper: 'Letter', gridlines: true, headings: false })
    expect(s.pageSetup.margins.left).toBe(0.25)
    const cmd = api.getCommandContext()
    cmd.setActiveCell(0, 0)
    cmd.setSelection(0, 0)
    cmd.extendSelection(1, 1)
    flushSync()
    sheet.act('print-area-set')
    flushSync()
    expect(s.pageSetup.printArea).toEqual([[0, 0, 1, 1]])
    expect(document.querySelector('.sv-sheet .status .mode')?.textContent).toBe('Print area set to A1:B2.')
    const html = sheet.printHtml()
    expect(html).toContain('@page { size: letter landscape; margin: 0.75in 0.25in 0.75in 0.25in; }')
    expect(html).toContain('td, th { border: 1px solid #d0d0d0; }')
    expect(html).toContain('<td style="text-align:right">1</td><td style="text-align:right">2</td>')
    expect(html).toContain('<td style="text-align:right">3</td>')
    expect(html).not.toContain('<col style="width:96px"><col style="width:96px"><col style="width:96px">')
    // Undo puts the area back, the state carries the setup, and the dialog opens on Print Titles.
    cmd.api.undo()
    flushSync()
    expect(s.pageSetup.printArea).toBeNull()
    expect(JSON.parse(JSON.stringify(sheet.getState())).sheets.Sheet1.pageSetup).toMatchObject({ orientation: 'landscape', paper: 'Letter', gridlines: true })
    sheet.act('print-titles')
    flushSync()
    expect(document.querySelector('.sv-modal')?.textContent).toContain('Rows to repeat at top:')
  })

  it('a dynamic array spills into the cells under it, which show its values and wear the outline when selected', async () => {
    const { api } = await mountSheet({ data: [{ name: 'Sheet1', cells: [['=SEQUENCE(3, 1, 5)'], [], [], ['x']] }], rows: 6, columns: 3 })
    const cellText = (r: number, c: number) => document.querySelector(`.sv-sheet td[data-svgrid-row="${r}"][data-svgrid-col="${c}"] .sheet-cell`)?.textContent
    expect(cellText(0, 0)).toBe('5')
    expect(cellText(2, 0)).toBe('7')
    const cmd = api.getCommandContext()
    cmd.setActiveCell(1, 0)
    cmd.setSelection(1, 0)
    flushSync()
    const edges = [...document.querySelectorAll('.sv-sheet .sheet-spill-edge')].map((e) => [...e.classList].filter((c) => c !== 'sheet-spill-edge' && !c.startsWith('svelte-')).join(' '))
    expect(edges).toEqual(['top left right', 'left right', 'bottom left right'])
    cmd.setCellValue(3, 0, '')
    cmd.setCellValue(1, 0, 'blocker')
    flushSync()
    expect(cellText(0, 0)).toBe('#SPILL!')
    expect(cellText(2, 0)).toBe('')
    cmd.setCellValue(1, 0, '')
    flushSync()
    expect(cellText(2, 0)).toBe('7')
  })

  it('Insert > Chart charts the selection, the object rides the state and a structural edit, and Delete removes it', async () => {
    const { api, doc, sheet } = await mountSheet({
      data: [{ name: 'S', cells: [['Month', 'Online'], ['Jan', '120'], ['Feb', '150'], ['Mar', '170']] }],
      rows: 10, columns: 4,
    })
    const cmd = api.getCommandContext()
    cmd.setActiveCell(0, 0)
    cmd.setSelection(0, 0)
    cmd.extendSelection(3, 1)
    flushSync()
    sheet.act('insert-chart')
    flushSync()
    await tick()
    const s = doc.get('S')
    expect(s.objects).toHaveLength(1)
    const chart = s.objects[0]!
    expect(chart).toMatchObject({ kind: 'chart', type: 'bar', headers: true, series: 'columns', range: [0, 0, 3, 1] })
    expect(chart.anchor).toMatchObject({ row: 4, col: 0 })
    // It carries into the saved state, and comes back from it.
    const state = JSON.parse(JSON.stringify(sheet.getState()))
    expect(state.sheets.S.objects[0].id).toBe(chart.id)
    // An insert above moves the anchor and the range with the cells.
    doc.shift('S', { kind: 'insertRows', at: 0, count: 2 })
    expect(s.objects[0]!.anchor.row).toBe(6)
    expect((s.objects[0] as unknown as { range: number[] }).range).toEqual([2, 0, 5, 1])
    sheet.setState(state)
    flushSync()
    await tick()
    expect(doc.get('S').objects[0]!.anchor.row).toBe(4)

    // Chart Setup opens on the selected chart, and Delete takes it away.
    sheet.act('chart-setup')
    flushSync()
    expect(document.querySelector('.sv-modal')?.textContent).toContain('Series in:')
    ;[...document.querySelectorAll('.sv-modal button')].find((b) => b.textContent === 'Cancel')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    flushSync()
    sheet.act('delete-object')
    flushSync()
    await tick()
    expect(doc.get('S').objects).toEqual([])
  })

  it('Insert > Sparklines draws one per row, the kind buttons change the group, and Clear takes it away', async () => {
    const { api, doc, sheet } = await mountSheet({
      data: [{ name: 'S', cells: [['North', '10', '20', '30'], ['South', '5', '-15', '25']] }],
      rows: 10, columns: 6,
    })
    const cmd = api.getCommandContext()
    cmd.setActiveCell(0, 1)
    cmd.setSelection(0, 1)
    cmd.extendSelection(1, 3)
    flushSync()
    // The dialog opens on the block, with the location the column past it.
    sheet.act('sparkline-line')
    flushSync()
    const dialog = document.querySelector('.sv-modal')!
    expect(dialog.textContent).toContain('Create Sparklines')
    const fields = [...dialog.querySelectorAll('input[type="text"]')] as HTMLInputElement[]
    expect(fields.map((f) => f.value)).toEqual(['B1:D2', 'E1:E2'])
    // Drawn in column A instead, which is inside the window jsdom renders.
    fields[1]!.value = 'A1:A2'
    fields[1]!.dispatchEvent(new Event('input', { bubbles: true }))
    flushSync()
    ;[...dialog.querySelectorAll('button')].find((b) => b.textContent === 'OK')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    flushSync()
    await tick()

    const s = doc.get('S')
    expect(s.sparklines).toHaveLength(1)
    expect(s.sparklines[0]).toMatchObject({ type: 'line', markers: true, data: [0, 1, 1, 3], location: [0, 0, 1, 0] })
    // One sparkline per row of the data, drawn in the cells of the location.
    expect(document.querySelectorAll('.sheet-sparkline svg').length).toBe(2)

    // It rides the state, and a structural edit moves both rectangles.
    const state = JSON.parse(JSON.stringify(sheet.getState()))
    expect(state.sheets.S.sparklines[0].location).toEqual([0, 0, 1, 0])
    doc.shift('S', { kind: 'insertRows', at: 0, count: 1 })
    expect(s.sparklines[0]!.location).toEqual([1, 0, 2, 0])
    sheet.setState(state)
    flushSync()
    await tick()
    expect(doc.get('S').sparklines[0]!.location).toEqual([0, 0, 1, 0])

    // With a group under the cell, a kind button changes that group instead
    // of opening the dialog, the way Excel's Sparkline tab does.
    cmd.setActiveCell(0, 0)
    cmd.setSelection(0, 0)
    flushSync()
    sheet.act('sparkline-column')
    flushSync()
    await tick()
    expect(document.querySelector('.sv-modal')).toBeNull()
    expect(doc.get('S').sparklines[0]!.type).toBe('column')

    sheet.act('clear-sparklines')
    flushSync()
    await tick()
    expect(doc.get('S').sparklines).toEqual([])
  })

  it('Insert > PivotTable writes the summary as cells, keeps the definition and refreshes it', async () => {
    const { api, doc, sheet } = await mountSheet({
      data: [{
        name: 'S',
        cells: [
          ['Region', 'Amount'],
          ['North', '100'],
          ['South', '80'],
          ['North', '150'],
        ],
      }],
      rows: 12, columns: 6,
    })
    const cmd = api.getCommandContext()
    cmd.setActiveCell(0, 0)
    cmd.setSelection(0, 0)
    cmd.extendSelection(3, 1)
    flushSync()
    sheet.act('insert-pivot')
    flushSync()
    const dialog = document.querySelector('.sv-modal')!
    expect(dialog.textContent).toContain('PivotTable')
    // Region down the rows, Amount summed: what the dialog opens on.
    const fields = [...dialog.querySelectorAll('input[type="text"]')] as HTMLInputElement[]
    expect(fields.map((f) => f.value)).toEqual(['A1:B4', 'D1'])
    fields[1]!.value = 'C1'
    fields[1]!.dispatchEvent(new Event('input', { bubbles: true }))
    flushSync()
    ;[...dialog.querySelectorAll('button')].find((b) => b.textContent === 'OK')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    flushSync()
    await tick()

    const block = (r: number, c: number) => String(api.getCommandContext().getCellValue(r, c) ?? '')
    expect([block(0, 2), block(0, 3)]).toEqual(['Region', 'Amount (sum)'])
    expect([block(1, 2), block(1, 3)]).toEqual(['North', '250'])
    expect([block(2, 2), block(2, 3)]).toEqual(['South', '80'])
    expect([block(3, 2), block(3, 3)]).toEqual(['Grand total', '330'])

    const s = doc.get('S')
    expect(s.pivots).toHaveLength(1)
    expect(s.pivots[0]).toMatchObject({ rows: ['Region'], cols: [], written: [0, 2, 3, 3] })
    // The definition rides the state.
    const state = JSON.parse(JSON.stringify(sheet.getState()))
    expect(state.sheets.S.pivots[0].source).toEqual([0, 0, 3, 1])

    // A changed source, then Refresh from a cell inside the written block.
    cmd.setCellValue(1, 1, '400')
    flushSync()
    cmd.setActiveCell(1, 2)
    cmd.setSelection(1, 2)
    flushSync()
    sheet.act('refresh-pivot')
    flushSync()
    await tick()
    expect([block(1, 2), block(1, 3)]).toEqual(['North', '550'])
    expect(block(3, 3)).toBe('630')
  })

  it('Insert > Link puts a link on the cell, the cell keeps its text, and Remove takes it off', async () => {
    const { api, doc, sheet } = await mountSheet({
      data: [{ name: 'S', cells: [['Our site', 'x'], ['Detail', 'y']] }],
      rows: 8, columns: 4,
    })
    const cmd = api.getCommandContext()
    cmd.setActiveCell(0, 0)
    cmd.setSelection(0, 0)
    flushSync()
    sheet.act('insert-link')
    flushSync()
    const dialog = document.querySelector('.sv-modal')!
    expect(dialog.textContent).toContain('Address:')
    const fields = [...dialog.querySelectorAll('input[type="text"]')] as HTMLInputElement[]
    // The address, the text as it stands, and the tip.
    expect(fields[1]!.value).toBe('Our site')
    const type = (input: HTMLInputElement, text: string) => {
      input.value = text
      input.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()
    }
    type(fields[0]!, 'https://svgrid.com')
    type(fields[2]!, 'The site')
    ;[...dialog.querySelectorAll('button')].find((b) => b.textContent === 'OK')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    flushSync()
    await tick()

    expect(doc.get('S').links).toEqual({ r0: { A: { target: 'https://svgrid.com', tip: 'The site' } } })
    // The cell still says what it said: the link is beside the text.
    expect(cmd.getCellValue(0, 0)).toBe('Our site')
    // And it rides the state.
    const state = JSON.parse(JSON.stringify(sheet.getState()))
    expect(state.sheets.S.links.r0.A.target).toBe('https://svgrid.com')

    // An insert above moves it with its cell.
    doc.shift('S', { kind: 'insertRows', at: 0, count: 2 })
    expect(Object.keys(doc.get('S').links)).toEqual(['r2'])
    sheet.setState(state)
    flushSync()
    await tick()
    expect(Object.keys(doc.get('S').links)).toEqual(['r0'])

    sheet.act('remove-link')
    flushSync()
    await tick()
    expect(doc.get('S').links).toEqual({})
  })

  it('Insert > Table names the columns, a structured reference reads them, and typing under it grows the table', async () => {
    const { api, doc, sheet } = await mountSheet({
      data: [{
        name: 'S',
        cells: [
          ['Product', 'Qty', 'Price', 'Total'],
          ['A', '2', '10', '=[@Qty]*[@Price]'],
          ['B', '3', '20', '=[@Qty]*[@Price]'],
          ['', '', '', ''],
        ],
      }],
      rows: 10, columns: 6,
    })
    const cmd = api.getCommandContext()
    cmd.setActiveCell(0, 0)
    cmd.setSelection(0, 0)
    cmd.extendSelection(2, 3)
    flushSync()
    sheet.act('insert-table')
    flushSync()
    const dialog = document.querySelector('.sv-modal')!
    expect(dialog.textContent).toContain('Create Table')
    const fields = [...dialog.querySelectorAll('input[type="text"]')] as HTMLInputElement[]
    expect(fields.map((f) => f.value)).toEqual(['A1:D3', 'Table1'])
    ;[...dialog.querySelectorAll('button')].find((b) => b.textContent === 'OK')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    flushSync()
    await tick()

    const wb = doc.workbook
    expect(wb.tables.list()).toEqual([
      // The default style rides along: a new table wears Excel's default.
      { name: 'Table1', sheet: 'S', headerRow: 0, firstCol: 0, lastCol: 3, lastRow: 2, hasTotals: false, style: 'TableStyleMedium2' },
    ])
    // The per-row formula reads its own row through [@Qty], and a whole
    // column through the table's name.
    expect(wb.getValue('S', 1, 3)).toBe(20)
    expect(wb.evaluateText('S', '=SUM(Table1[Total])')).toBe(80)
    // The arrows came with it, as Excel's table does.
    expect(doc.get('S').autoFilter?.range).toEqual([0, 0, 2, 3])
    // And the definition rides the state.
    const state = JSON.parse(JSON.stringify(sheet.getState()))
    expect(state.workbook.tables[0].name).toBe('Table1')

    // Auto-expand: a row typed under the last one joins the table.
    cmd.setActiveCell(3, 0)
    cmd.setSelection(3, 0)
    flushSync()
    cmd.setCellValue(3, 0, 'C')
    flushSync()
    await tick()
    expect(wb.tables.get('Table1')?.lastRow).toBe(3)

    // Convert to Range leaves the cells and takes the table.
    cmd.setActiveCell(1, 1)
    cmd.setSelection(1, 1)
    flushSync()
    sheet.act('remove-table')
    flushSync()
    await tick()
    expect(wb.tables.list()).toEqual([])
    expect(wb.getRaw('S', 1, 3)).toBe('=[@Qty]*[@Price]')
  })
})

describe('SvSheet calculation options', () => {
  it('turns a circular reference into its fixed point, and back', async () => {
    // A bonus that is a tenth of the profit it comes out of: circular on
    // purpose, and 100000 / 11 once it settles.
    const { sheet, doc } = await mountSheet({ data: [{ name: 'Sheet1', cells: [['100000'], ['=0.1*(A1-A2)']] }] })
    const paint = async () => { flushSync(); await tick() }
    expect(doc.workbook.getValue('Sheet1', 1, 0)).toEqual({ error: '#CYCLE!' })

    sheet.act('calc-options')
    await paint()
    const check = document.querySelector<HTMLInputElement>('.sv-sheet-dialog input[type="checkbox"]')
    expect(check).not.toBeNull()
    check!.checked = true
    check!.dispatchEvent(new Event('change', { bubbles: true }))
    await paint()
    const ok = [...document.querySelectorAll<HTMLButtonElement>('.sv-sheet-dialog-buttons button')].find((b) => b.textContent?.trim() === 'OK')
    ok!.click()
    await paint()

    expect(doc.workbook.iteration.enabled).toBe(true)
    expect(doc.workbook.getValue('Sheet1', 1, 0)).toBeCloseTo(100000 / 11, 2)
    // And the state carries it, so a save keeps the model working.
    expect(doc.getState().workbook.iteration).toEqual({ enabled: true, maxIterations: 100, maxChange: 0.001 })
  })
})

describe('SvSheet presence', () => {
  it('draws a box and a tag for each peer on this sheet, and reports where this user is', async () => {
    const moves: Array<{ sheet: string; rect: number[]; active: { row: number; col: number } }> = []
    const { api, sheet } = await mountSheet({
      presence: [
        { id: 'ada', name: 'Ada', sheet: 'Sheet1', rect: [0, 0, 1, 1], active: { row: 0, col: 0 } },
        { id: 'brin', name: 'Brin Fourier-Smith', sheet: 'Sheet1', rect: [1, 1, 1, 1], colour: '#ff0000' },
        // Someone on another sheet is not drawn here.
        { id: 'cyd', name: 'Cyd', sheet: 'Sheet2', rect: [0, 0, 0, 0] },
        // And someone who has been quiet too long is gone.
        { id: 'dov', name: 'Dov', sheet: 'Sheet1', rect: [0, 0, 0, 0], at: Date.now() - 60_000 },
      ],
      onPresence: (me: { sheet: string; rect: number[]; active: { row: number; col: number } }) => { moves.push(me) },
    })
    const paint = async () => { flushSync(); await tick(); await new Promise((r) => requestAnimationFrame(() => r(null))); flushSync() }
    await paint()

    const tags = [...host!.querySelectorAll('.sheet-presence-tag')].map((el) => el.textContent)
    expect(tags).toEqual(['Ada', 'BF'])
    expect(host!.querySelectorAll('.sheet-presence')).toHaveLength(2)

    // Moving the cursor reports this user's own presence.
    const cmd = api.getCommandContext()
    cmd.setActiveCell(2, 1)
    cmd.setSelection(2, 1)
    await paint()
    expect(moves.at(-1)).toEqual({ sheet: 'Sheet1', rect: [2, 1, 2, 1], active: { row: 2, col: 1 } })
    expect(sheet).toBeTruthy()
  })
})

describe('SvSheet printing what floats over the cells', () => {
  it('draws the sparklines and hangs the pictures on the printed page', async () => {
    const doc = createSheetDocument({
      sheets: [{ name: 'Sheet1', cells: [['Region', '3', '5', '4'], ['North', '1', '9', '2']] }],
    })
    doc.get('Sheet1').sparklines = [{
      id: 's1',
      location: [0, 0, 1, 0] as never,
      data: [0, 1, 1, 3] as never,
      type: 'line',
      color: '#2563eb',
      markers: true,
    }]
    doc.get('Sheet1').objects = [{
      id: 'i1',
      kind: 'image',
      anchor: { row: 1, col: 1, dx: 6, dy: 3, width: 120, height: 80 },
      src: 'data:image/png;base64,AAAA',
      alt: 'A "logo" & mark',
    }]
    const { sheet } = await mountSheet({ document: doc })
    flushSync()
    await tick()
    const html = sheet.printHtml()

    // The sparkline is drawn into the cell it belongs to, behind the text.
    expect(html).toContain('<span class="sp"><svg')
    expect(html).toContain('stroke="#2563eb"')
    expect(html).toContain('td .sp { position: absolute;')
    // The picture hangs from its anchor cell at its own offset and size.
    expect(html).toContain('<span class="ob" style="inset-inline-start:6px;top:3px;width:120px;height:80px">')
    expect(html).toContain('<img src="data:image/png;base64,AAAA"')
    // And its alt text is escaped rather than closing the attribute.
    expect(html).toContain('alt="A &quot;logo&quot; &amp; mark"')
  })
})
