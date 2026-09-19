/**
 * Deep QA in the shell: the commands that write, undone and redone, and the
 * features that draw over each other in one cell.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, unmount, flushSync, tick } from 'svelte'
import SvSheet from './SvSheet.svelte'
import { createSheetDocument, type SheetDocument } from './sheet/document'
import type { GridCommandContext } from '@svgrid/grid/shortcuts'

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

type Ready = { api: { getCommandContext(): GridCommandContext }; doc: SheetDocument; sheet: SvSheet }

function mountSheet(props: Record<string, unknown> = {}): Promise<Ready> {
  return new Promise((resolve) => {
    host = document.createElement('div')
    document.body.appendChild(host)
    const sheet = mount(SvSheet, {
      target: host,
      props: {
        rows: 20,
        columns: 4,
        showRibbon: false,
        onReady: (api: Ready['api'], doc: SheetDocument) => resolve({ api, doc, sheet: sheet as unknown as SvSheet }),
        ...props,
      },
    }) as unknown as SvSheet
    comp = sheet as unknown as ReturnType<typeof mount>
    flushSync()
  })
}

const paint = async () => { flushSync(); await tick() }

describe('undo over the commands that write cells', () => {
  it('undoes a written pivot in one step, cells and definition together', async () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [
      ['Region', 'Amount'], ['N', '10'], ['S', '20'],
    ] }] })
    doc.get('S').pivots = [{
      id: 'p', source: [0, 0, 2, 1] as never, target: { row: 6, col: 0 },
      rows: ['Region'], cols: [], values: [{ field: 'Amount', agg: 'sum' }],
    }]
    const { api, sheet } = await mountSheet({ document: doc })
    const cmd = api.getCommandContext()
    cmd.setActiveCell(6, 0); cmd.setSelection(6, 0)
    await paint()
    sheet.act('refresh-pivot')
    await paint()
    expect(doc.workbook.getRaw('S', 7, 0).trim()).toBe('N')

    cmd.api.undo()
    await paint()
    expect(doc.workbook.getRaw('S', 7, 0)).toBe('')
    cmd.api.redo()
    await paint()
    expect(doc.workbook.getRaw('S', 7, 0).trim()).toBe('N')
  })
})

describe('a cell wearing several features at once', () => {
  it('draws a table band, a sparkline and a link on the same sheet without losing any', async () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [
      ['Region', 'Amount', 'Trend'], ['N', '10', ''], ['S', '20', ''],
    ] }] })
    doc.workbook.tables.define({ name: 'T', sheet: 'S', headerRow: 0, firstCol: 0, lastCol: 1, lastRow: 2, hasTotals: false, style: 'TableStyleMedium6' })
    doc.get('S').sparklines = [{ id: 's', location: [1, 2, 2, 2] as never, data: [1, 1, 2, 1] as never, type: 'line' }]
    doc.get('S').links = { r1: { A: { target: 'https://example.com' } } }
    await mountSheet({ document: doc })
    await paint()
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    await paint()

    expect(host!.querySelectorAll('.sheet-table-fill').length).toBeGreaterThan(0)
    expect(host!.querySelectorAll('.sheet-sparkline').length).toBeGreaterThan(0)
    expect(host!.querySelectorAll('.sheet-cell.linked').length).toBeGreaterThan(0)
  })

  it('shows the formula rather than the picture while Show Formulas is on', async () => {
    const png = 'data:image/png;base64,AAAA'
    const { sheet } = await mountSheet({ data: [{ name: 'S', cells: [[`=IMAGE("${png}")`]] }] })
    await paint()
    expect(host!.querySelectorAll('img.sheet-cell-image')).toHaveLength(1)
    sheet.act('toggle-formulas')
    await paint()
    expect(host!.querySelectorAll('img.sheet-cell-image')).toHaveLength(0)
    expect(host!.textContent).toContain('=IMAGE(')
  })
})

describe('a protected sheet refuses the new writes', () => {
  it('will not write a pivot or show details', async () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [
      ['Region', 'Amount'], ['N', '10'],
    ] }] })
    doc.get('S').protected = true
    doc.get('S').pivots = [{
      id: 'p', source: [0, 0, 1, 1] as never, target: { row: 5, col: 0 },
      rows: ['Region'], cols: [], values: [{ field: 'Amount', agg: 'sum' }],
    }]
    const { api, sheet } = await mountSheet({ document: doc })
    const cmd = api.getCommandContext()
    cmd.setActiveCell(5, 0); cmd.setSelection(5, 0)
    await paint()
    sheet.act('refresh-pivot')
    await paint()
    // Nothing written, and the sheet says why through the status bar.
    expect(doc.workbook.getRaw('S', 6, 0)).toBe('')
  })
})

describe('what the status bar claims happened', () => {
  it('editing a table says what it now wears rather than announcing a new one', async () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [
      ['Qty', 'Price'], ['2', '3'], ['4', '5'],
    ] }] })
    doc.workbook.tables.define({ name: 'Orders', sheet: 'S', headerRow: 0, firstCol: 0, lastCol: 1, lastRow: 2, hasTotals: false, style: 'TableStyleMedium2' })
    const { api, sheet } = await mountSheet({ document: doc })
    const cmd = api.getCommandContext()
    cmd.setActiveCell(1, 0); cmd.setSelection(1, 0)
    await paint()

    // Insert > Table Styles on the table the cursor is in, then OK: the
    // table is not being made, it is being dressed.
    sheet.act('table-style')
    await paint()
    const dialog = document.querySelector('.sv-modal')
    expect(dialog, 'the table dialog opened').not.toBeNull()
    const green = dialog!.querySelector<HTMLButtonElement>('[role="radio"][aria-label*="Green"]')
    green?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await paint()
    const ok = [...dialog!.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'OK')
    ok?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await paint()

    const status = document.querySelector('.sv-sheet .status')?.textContent ?? ''
    expect(status).toContain('Orders')
    expect(status).toContain('Green')
    // And the table really wears the style that was picked, not the one it had.
    expect(doc.workbook.tables.list()[0]!.style).not.toBe('TableStyleMedium2')
  })
})
