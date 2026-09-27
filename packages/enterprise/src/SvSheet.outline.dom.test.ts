/**
 * DOM test: Data > Group folds rows away and brings them back, and a row
 * a group folded is not confused with one the user hid by hand.
 *
 * That last part is the whole reason the outline is kept apart from
 * `hidden` in the document: reading a folded row back as a hidden one
 * would leave it invisible after its group reopened.
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

type Cmd = {
  setCellValue: (r: number, c: number, v: string) => void
  setActiveCell: (r: number, c: number) => void
  setSelection: (r: number, c: number) => void
}
type Api = {
  getCommandContext: () => Cmd
  isRowCollapsed: (r: number) => boolean
  selectCells: (rects: ReadonlyArray<readonly [number, number, number, number]>) => void
}
type SheetInstance = {
  getState: () => { sheets: Record<string, { hidden: { rows: number[]; cols: number[] }; outline?: { rows: { levels: Record<number, number>; collapsed: number[] } } }> }
  /** The shell runs a ribbon action for us, as a click on it would. */
  act: (action: string) => void
}

let host: HTMLElement | null = null
let comp: ReturnType<typeof mount> | null = null
afterEach(() => {
  if (comp) { unmount(comp); comp = null }
  if (host) { host.remove(); host = null }
})

function mountSheet(): Promise<{ el: HTMLElement; api: Api; sheet: SheetInstance }> {
  return new Promise((resolve) => {
    host = document.createElement('div')
    document.body.appendChild(host)
    const sheet = mount(SvSheet, {
      target: host,
      props: {
        data: [{ name: 'Sheet1', cells: [['10'], ['20'], ['30'], ['40'], ['=SUM(A1:A4)']] }],
        rows: 8,
        columns: 3,
        onReady: (api: Api) => resolve({ el: host!, api, sheet: sheet as unknown as SheetInstance }),
      },
    })
    comp = sheet
    flushSync()
  })
}

/**
 * Let the outline bar be measured.
 *
 * It is taken off the rendered rows inside a `requestAnimationFrame`, the
 * same way the auditing arrows are, so a test that only flushes Svelte
 * sees the state change but not the bar.
 */
const painted = () => new Promise((resolve) => setTimeout(resolve, 50))

/** Drive a ribbon action through the shell's own entry point. */
async function act(sheet: SheetInstance, id: string) {
  sheet.act(id)
  flushSync()
  await tick()
  await painted()
}

/** Click a bar button and let the bar be measured again. */
async function press(el: HTMLElement, selector: string) {
  const button = el.querySelector<HTMLElement>(selector)
  expect(button, selector).not.toBeNull()
  button!.click()
  flushSync()
  await tick()
  await painted()
}

describe('SvSheet outline (DOM)', () => {
  it('draws no outline bar until something is grouped', async () => {
    const { el } = await mountSheet()
    expect(el.querySelector('.sheet-outline-bar')).toBeNull()
  })

  it('groups the selected rows and folds them away', async () => {
    const { el, api, sheet } = await mountSheet()
    api.selectCells([[0, 0, 3, 0]])
    flushSync()
    await act(sheet, 'group-rows')

    const outline = sheet.getState().sheets.Sheet1!.outline!
    expect(outline.rows.levels).toEqual({ 0: 1, 1: 1, 2: 1, 3: 1 })
    // The bar appears with a collapse button on the summary row.
    expect(el.querySelector('.sheet-outline-bar')).not.toBeNull()

    // Nothing is folded until the group is collapsed.
    for (const r of [0, 1, 2, 3]) expect(api.isRowCollapsed(r)).toBe(false)

    await press(el, '.sheet-outline-toggle')
    for (const r of [0, 1, 2, 3]) expect(api.isRowCollapsed(r)).toBe(true)
    // The summary row itself stays.
    expect(api.isRowCollapsed(4)).toBe(false)
  })

  it('does not record a folded row as one the user hid', async () => {
    const { el, api, sheet } = await mountSheet()
    api.selectCells([[0, 0, 3, 0]])
    flushSync()
    await act(sheet, 'group-rows')
    await press(el, '.sheet-outline-toggle')

    const state = sheet.getState().sheets.Sheet1!
    expect(state.outline!.rows.collapsed).toEqual([4])
    // The folded rows belong to the group, not to `hidden`.
    expect(state.hidden.rows).toEqual([])
  })

  it('brings the rows back when the group is expanded again', async () => {
    const { el, api, sheet } = await mountSheet()
    api.selectCells([[0, 0, 3, 0]])
    flushSync()
    await act(sheet, 'group-rows')
    await press(el, '.sheet-outline-toggle')
    expect(api.isRowCollapsed(0)).toBe(true)
    await press(el, '.sheet-outline-toggle')
    for (const r of [0, 1, 2, 3]) expect(api.isRowCollapsed(r)).toBe(false)
  })

  it('ungroups back to nothing', async () => {
    const { el, api, sheet } = await mountSheet()
    api.selectCells([[0, 0, 3, 0]])
    flushSync()
    await act(sheet, 'group-rows')
    api.selectCells([[0, 0, 3, 0]])
    flushSync()
    await act(sheet, 'ungroup-rows')
    expect(sheet.getState().sheets.Sheet1!.outline?.rows.levels ?? {}).toEqual({})
    expect(el.querySelector('.sheet-outline-bar')).toBeNull()
  })
})
