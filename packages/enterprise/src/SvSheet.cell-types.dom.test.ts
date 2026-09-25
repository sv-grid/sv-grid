/**
 * DOM test: a cell drawn as a control writes its own cell and nothing
 * else, which is what keeps the formula engine, undo and the file working
 * over a checkbox column.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, unmount, flushSync, tick } from 'svelte'
import SvSheet from './SvSheet.svelte'

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

type Api = {
  getCommandContext: () => { setCellValue: (r: number, c: number, v: string) => void }
  selectCells: (rects: ReadonlyArray<readonly [number, number, number, number]>) => void
}
type SheetInstance = {
  getState: () => { workbook: { sheets: Array<{ cells: string[][] }> }; sheets: Record<string, { cellTypes?: Array<{ kind: string }> }> }
  act: (action: string) => void
}

let host: HTMLElement | null = null
let comp: ReturnType<typeof mount> | null = null
afterEach(() => {
  if (comp) { unmount(comp); comp = null }
  if (host) { host.remove(); host = null }
})

function mountSheet(props: Record<string, unknown> = {}): Promise<{ el: HTMLElement; api: Api; sheet: SheetInstance }> {
  return new Promise((resolve) => {
    host = document.createElement('div')
    document.body.appendChild(host)
    const sheet = mount(SvSheet, {
      target: host,
      props: {
        // A2 counts the ticks, so the engine has to see them as booleans.
        data: [{ name: 'Sheet1', cells: [['FALSE'], ['FALSE'], ['=COUNTIF(A1:A2, TRUE)']] }],
        rows: 6,
        columns: 3,
        onReady: (api: Api) => resolve({ el: host!, api, sheet: sheet as unknown as SheetInstance }),
        ...props,
      },
    })
    comp = sheet
    flushSync()
  })
}

async function act(sheet: SheetInstance, id: string) {
  sheet.act(id)
  flushSync()
  await tick()
}

const boxes = (el: HTMLElement) => el.querySelectorAll<HTMLInputElement>('.sheet-cell-control.checkbox input')
const cells = (sheet: SheetInstance) => sheet.getState().workbook.sheets[0]!.cells

describe('SvSheet cell types (DOM)', () => {
  it('draws no control until one is asked for', async () => {
    const { el } = await mountSheet()
    expect(el.querySelector('.sheet-cell-control')).toBeNull()
  })

  it('draws the selected cells as checkboxes', async () => {
    const { el, api, sheet } = await mountSheet()
    api.selectCells([[0, 0, 1, 0]])
    flushSync()
    await act(sheet, 'insert-checkbox')
    expect(boxes(el)).toHaveLength(2)
    expect(sheet.getState().sheets.Sheet1!.cellTypes).toHaveLength(1)
    // Both cells read FALSE, so neither is ticked.
    expect([...boxes(el)].map((b) => b.checked)).toEqual([false, false])
  })

  it('ticking writes TRUE into the cell, and the engine sees it', async () => {
    const { el, api, sheet } = await mountSheet()
    api.selectCells([[0, 0, 1, 0]])
    flushSync()
    await act(sheet, 'insert-checkbox')

    boxes(el)[0]!.click()
    flushSync()
    await tick()
    // The cell is what changed; the checkbox is only showing it.
    expect(cells(sheet)[0]![0]).toBe('TRUE')
    expect([...boxes(el)].map((b) => b.checked)).toEqual([true, false])
  })

  it('a formula over the column counts the ticks', async () => {
    const { el, api, sheet } = await mountSheet()
    api.selectCells([[0, 0, 1, 0]])
    flushSync()
    await act(sheet, 'insert-checkbox')
    boxes(el)[0]!.click()
    flushSync()
    await tick()
    boxes(el)[1]!.click()
    flushSync()
    await tick()
    expect(cells(sheet)[0]![0]).toBe('TRUE')
    expect(cells(sheet)[1]![0]).toBe('TRUE')
    // COUNTIF over the two now reads two, which it could not if the ticks
    // lived anywhere but in the cells.
    expect(el.textContent).toContain('2')
  })

  it('follows the cell when the value is changed from outside', async () => {
    const { el, api, sheet } = await mountSheet()
    api.selectCells([[0, 0, 1, 0]])
    flushSync()
    await act(sheet, 'insert-checkbox')
    api.getCommandContext().setCellValue(0, 0, 'TRUE')
    flushSync()
    await tick()
    expect([...boxes(el)].map((b) => b.checked)).toEqual([true, false])
    void sheet
  })

  it('draws a button and reports a press', async () => {
    const pressed: Array<{ row: number; col: number }> = []
    const { el, api, sheet } = await mountSheet({
      onCellAction: (e: { row: number; col: number }) => pressed.push({ row: e.row, col: e.col }),
    })
    api.selectCells([[0, 1, 0, 1]])
    flushSync()
    await act(sheet, 'insert-cell-button')
    const button = el.querySelector<HTMLElement>('.sheet-cell-control.button')
    expect(button).not.toBeNull()
    button!.click()
    flushSync()
    expect(pressed).toEqual([{ row: 0, col: 1 }])
  })

  it('clears the control and leaves the value behind', async () => {
    const { el, api, sheet } = await mountSheet()
    api.selectCells([[0, 0, 1, 0]])
    flushSync()
    await act(sheet, 'insert-checkbox')
    boxes(el)[0]!.click()
    flushSync()
    await tick()

    api.selectCells([[0, 0, 1, 0]])
    flushSync()
    await act(sheet, 'clear-cell-type')
    expect(el.querySelector('.sheet-cell-control')).toBeNull()
    // The TRUE the tick wrote is an ordinary cell value and stays.
    expect(cells(sheet)[0]![0]).toBe('TRUE')
  })
})
