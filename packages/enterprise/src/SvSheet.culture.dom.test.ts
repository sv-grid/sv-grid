/**
 * DOM test: the culture is a spelling applied at the edge.
 *
 * What the document holds must stay invariant whatever the locale, or a
 * file written by a German user would not open for an English one. These
 * mount the shell under `de-DE` and check both halves: the formula bar
 * shows `1,5` and `;`, and `getState()` still holds `1.5` and `,`.
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

type Api = { getCommandContext: () => { setCellValue: (r: number, c: number, v: string) => void; setActiveCell: (r: number, c: number) => void } }
type SheetInstance = { getState: () => { workbook: { sheets: Array<{ cells: string[][] }> } } }

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
        data: [{ name: 'Sheet1', cells: [['1.5', '2'], ['=ROUND(A1/3, 2)']] }],
        rows: 6,
        columns: 4,
        onReady: (api: Api) => resolve({ el: host!, api, sheet: sheet as unknown as SheetInstance }),
        ...props,
      },
    })
    comp = sheet
    flushSync()
  })
}

/** The fx box, which carries the RAW text of the active cell. */
const bar = (el: HTMLElement) => el.querySelector<HTMLTextAreaElement>('[aria-label="Formula"]')

async function showCell(el: HTMLElement, api: Api, r: number, c: number): Promise<string> {
  api.getCommandContext().setActiveCell(r, c)
  flushSync()
  await tick()
  return bar(el)?.value ?? ''
}

describe('SvSheet culture (DOM)', () => {
  it('shows a stored decimal with the locale’s mark', async () => {
    const { el, api } = await mountSheet({ localization: { locale: 'de-DE' } })
    expect(await showCell(el, api, 0, 0)).toBe('1,5')
  })

  it('shows a stored formula with the locale’s separator', async () => {
    const { el, api } = await mountSheet({ localization: { locale: 'de-DE' } })
    expect(await showCell(el, api, 1, 0)).toBe('=ROUND(A1/3; 2)')
  })

  it('leaves everything alone under an invariant locale', async () => {
    const { el, api } = await mountSheet({ localization: { locale: 'en-US' } })
    expect(await showCell(el, api, 0, 0)).toBe('1.5')
    expect(await showCell(el, api, 1, 0)).toBe('=ROUND(A1/3, 2)')
  })

  it('takes `culture: false` to translate the strings but not the spelling', async () => {
    const { el, api } = await mountSheet({ localization: { locale: 'de-DE', culture: false } })
    expect(await showCell(el, api, 0, 0)).toBe('1.5')
    expect(await showCell(el, api, 1, 0)).toBe('=ROUND(A1/3, 2)')
  })

  it('takes an override for one mark without naming the rest', async () => {
    // German strings and a semicolon separator, but the dot for decimals.
    const { el, api } = await mountSheet({ localization: { locale: 'de-DE', culture: { decimal: '.' } } })
    expect(await showCell(el, api, 1, 0)).toBe('=ROUND(A1/3; 2)')
    expect(await showCell(el, api, 0, 0)).toBe('1.5')
  })

  it('keeps the invariant spelling in the document', async () => {
    const { sheet } = await mountSheet({ localization: { locale: 'de-DE' } })
    const cells = sheet.getState().workbook.sheets[0]!.cells
    expect(cells[0]![0]).toBe('1.5')
    expect(cells[1]![0]).toBe('=ROUND(A1/3, 2)')
  })

  it('stores a number typed the locale’s way as the invariant one', async () => {
    const { api, sheet } = await mountSheet({ localization: { locale: 'de-DE' } })
    api.getCommandContext().setCellValue(2, 0, '3,25')
    flushSync()
    await tick()
    expect(sheet.getState().workbook.sheets[0]!.cells[2]![0]).toBe('3.25')
  })

  it('stores a formula typed the locale’s way as the invariant one', async () => {
    const { api, sheet } = await mountSheet({ localization: { locale: 'de-DE' } })
    api.getCommandContext().setCellValue(2, 0, '=ROUND(A1/3; 2)')
    flushSync()
    await tick()
    expect(sheet.getState().workbook.sheets[0]!.cells[2]![0]).toBe('=ROUND(A1/3, 2)')
  })

  it('round-trips a formula through the bar without drift', async () => {
    // Shown in the culture, typed back unchanged, stored invariant: the
    // spelling must survive the trip or an untouched cell would rewrite
    // itself every time someone clicked into it.
    const { el, api, sheet } = await mountSheet({ localization: { locale: 'de-DE' } })
    const shown = await showCell(el, api, 1, 0)
    api.getCommandContext().setCellValue(1, 0, shown)
    flushSync()
    await tick()
    expect(sheet.getState().workbook.sheets[0]!.cells[1]![0]).toBe('=ROUND(A1/3, 2)')
  })
})

describe('SvSheet culture: rendered cells (DOM)', () => {
  it('renders a formatted number with the locale’s marks', async () => {
    const { api, sheet } = await mountSheet({
      data: [{ name: 'Sheet1', cells: [['1234.5']] }],
      localization: { locale: 'de-DE' },
    })
    api.getCommandContext().setCellValue(0, 0, '1234.5')
    flushSync()
    await tick()
    // The pattern stays invariant in the document; only its marks change.
    void sheet
    expect(host!.textContent).toContain('1234,5')
  })
})
