/**
 * DOM test: a bound tab.
 *
 * The point of the whole design is the last test here: a formula on a cell
 * tab reads a bound tab as if it were an ordinary sheet, because the
 * records are projected into the workbook's cells. If that breaks, a bound
 * tab is just an embedded widget and the feature is worth much less.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, unmount, flushSync, tick } from 'svelte'
import SvSheet from './SvSheet.svelte'
import { projectGridSheet } from './sheet/sheet-kinds'

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

type Api = { getCommandContext: () => { setCellValue: (r: number, c: number, v: string) => void } }
type SheetInstance = {
  getState: () => {
    workbook: { sheets: Array<{ name: string; cells: string[][] }> }
    sheets: Record<string, { kind?: string; grid?: { rows: Array<Record<string, unknown>> } }>
  }
}

let host: HTMLElement | null = null
let comp: ReturnType<typeof mount> | null = null
afterEach(() => {
  if (comp) { unmount(comp); comp = null }
  if (host) { host.remove(); host = null }
})

const ORDERS = () => ({
  fields: [
    { field: 'item', label: 'Item' },
    { field: 'qty', label: 'Qty', type: 'number' as const },
    { field: 'price', label: 'Price', type: 'number' as const },
  ],
  rows: [
    { item: 'Widget', qty: 2, price: 9.5 },
    { item: 'Gadget', qty: 3, price: 4 },
  ],
  editable: true,
})

type Doc = { workbook: { setRaw: (s: string, r: number, c: number, t: string) => void; getValue: (s: string, r: number, c: number) => unknown } }

function mountSheet(props: Record<string, unknown> = {}): Promise<{ el: HTMLElement; api: Api; sheet: SheetInstance; doc: Doc }> {
  return new Promise((resolve) => {
    host = document.createElement('div')
    document.body.appendChild(host)
    const sheet = mount(SvSheet, {
      target: host,
      props: {
        data: [{ name: 'Orders', cells: [] }, { name: 'Summary', cells: [] }],
        gridSheets: { Orders: ORDERS() },
        rows: 8,
        columns: 4,
        onReady: (api: Api, doc: Doc) => resolve({ el: host!, api, sheet: sheet as unknown as SheetInstance, doc }),
        ...props,
      },
    })
    comp = sheet
    flushSync()
  })
}

const cellsOf = (sheet: SheetInstance, name: string) =>
  sheet.getState().workbook.sheets.find((s) => s.name === name)!.cells

describe('SvSheet bound tabs (DOM)', () => {
  it('renders the records as a grid with their own headers', async () => {
    const { el } = await mountSheet()
    await tick()
    // The bound tab shows the field labels, not A / B / C.
    expect(el.textContent).toContain('Item')
    expect(el.textContent).toContain('Qty')
    expect(el.textContent).toContain('Widget')
  })

  it('marks the tab as bound in the saved document', async () => {
    const { sheet } = await mountSheet()
    await tick()
    expect(sheet.getState().sheets.Orders!.kind).toBe('grid')
    expect(sheet.getState().sheets.Orders!.grid!.rows).toHaveLength(2)
    // The other tab is an ordinary cell sheet.
    expect(sheet.getState().sheets.Summary!.kind).toBe('cells')
  })

  it('projects the records into the workbook’s cells', async () => {
    const { sheet } = await mountSheet()
    await tick()
    const cells = cellsOf(sheet, 'Orders')
    expect(cells[0]).toEqual(['Item', 'Qty', 'Price'])
    expect(cells[1]).toEqual(['Widget', '2', '9.5'])
    expect(cells[2]).toEqual(['Gadget', '3', '4'])
  })

  it('lets a formula on a cell tab read the bound one', async () => {
    // This is the point of the design. Summary is an ordinary cell sheet
    // and Orders is bound; the engine is told nothing about the
    // difference and reads the projection like any other sheet.
    const { doc } = await mountSheet()
    await tick()
    const wb = doc.workbook
    wb.setRaw('Summary', 0, 0, '=SUM(Orders!B2:B3)')
    expect(wb.getValue('Summary', 0, 0)).toBe(5)
    wb.setRaw('Summary', 1, 0, '=SUMPRODUCT(Orders!B2:B3, Orders!C2:C3)')
    expect(wb.getValue('Summary', 1, 0)).toBe(2 * 9.5 + 3 * 4)
    // And a lookup across, which needs the header row to be there.
    wb.setRaw('Summary', 2, 0, '=VLOOKUP("Gadget", Orders!A2:C3, 2, FALSE)')
    expect(wb.getValue('Summary', 2, 0)).toBe(3)
  })

  it('a record that changes moves the formula that reads it', async () => {
    const spec = ORDERS()
    const { doc } = await mountSheet({ gridSheets: { Orders: spec } })
    await tick()
    const wb = doc.workbook
    wb.setRaw('Summary', 0, 0, '=SUM(Orders!B2:B3)')
    expect(wb.getValue('Summary', 0, 0)).toBe(5)

    // A record changes and the tab is projected again, which is what the
    // shell does after an edit in the grid.
    spec.rows[0]!.qty = 10
    for (const [r, line] of projectGridSheet(spec).entries()) {
      for (const [c, text] of line.entries()) wb.setRaw('Orders', r, c, text)
    }
    expect(wb.getValue('Summary', 0, 0)).toBe(13)
  })
})
