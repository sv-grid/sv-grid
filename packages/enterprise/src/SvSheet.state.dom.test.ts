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
})