/**
 * DOM test: the ribbon collapses the way Excel's does.
 *
 * Collapsed, only the tabs show and a chevron on their row expands it
 * again; a click on a tab peeks the band over the sheet until Escape, a
 * click elsewhere or a command puts it away; a double-click on a tab and
 * the chevron at the band's end toggle the whole thing.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvSheetRibbon from './SvSheetRibbon.svelte'
import type { GridCommandContext } from '@svgrid/grid/shortcuts'

// jsdom lacks ResizeObserver, which the band's width measuring touches.
if (typeof (globalThis as Record<string, unknown>).ResizeObserver === 'undefined') {
  ;(globalThis as Record<string, unknown>).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return [] }
  }
}

let host: HTMLElement | null = null
let comp: ReturnType<typeof mount> | null = null
afterEach(() => {
  if (comp) { unmount(comp); comp = null }
  if (host) { host.remove(); host = null }
})

function fakeCmd(): GridCommandContext {
  return {
    api: { canUndo: () => false, canRedo: () => false } as never,
    editing: false,
    activeCell: { rowIndex: 0, colIndex: 0, columnId: 'a' },
    rowCount: 5,
    colCount: 4,
    ranges: [[0, 0, 0, 0]],
    columnIdAt: (c: number) => ['a', 'b', 'c', 'd'][c] ?? null,
    getCellValue: () => undefined,
    setCellValue: () => {},
    setActiveCell: vi.fn(),
    setSelection: vi.fn(),
    extendSelection: vi.fn(),
    scrollIntoView: vi.fn(),
    startEditing: vi.fn(() => true),
    batch: <T,>(fn: () => T) => fn(),
    focus: vi.fn(),
    paste: vi.fn(async () => {}),
    recordUndo: vi.fn(),
  } as unknown as GridCommandContext
}

function render(props: { collapsed?: boolean; onAction?: (action: string, cmd: GridCommandContext) => void } = {}): HTMLElement {
  host = document.createElement('div')
  document.body.appendChild(host)
  const cmd = fakeCmd()
  comp = mount(SvSheetRibbon, { target: host, props: { cmd: () => cmd, ...props } as never })
  flushSync()
  return host
}

const band = (el: HTMLElement) => el.querySelector<HTMLElement>('.band:not(.measure)')!
const tab = (el: HTMLElement, name: string) =>
  [...el.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((b) => b.textContent?.trim() === name)!

describe('SvSheetRibbon collapse (DOM)', () => {
  it('shows the band with a collapse chevron at its end, and none on the tab row', () => {
    const el = render()
    expect(band(el).classList.contains('away')).toBe(false)
    expect(el.querySelector('[aria-label="Collapse the Ribbon"]')).not.toBeNull()
    expect(el.querySelector('[aria-label="Expand the Ribbon"]')).toBeNull()
  })

  it('collapsed: the band is gone and the tab row carries the expand chevron', () => {
    const el = render({ collapsed: true })
    expect(band(el).classList.contains('away')).toBe(true)
    expect(el.querySelector('[aria-label="Expand the Ribbon"]')).not.toBeNull()
  })

  it('a tab click while collapsed peeks the band; Escape puts it away', () => {
    const el = render({ collapsed: true })
    tab(el, 'Insert').click()
    flushSync()
    expect(band(el).classList.contains('peek')).toBe(true)
    expect(band(el).classList.contains('away')).toBe(false)
    // The peek shows the tab that was clicked.
    expect(el.querySelector('.band:not(.measure) .group[aria-label="Sheets"]')).not.toBeNull()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    flushSync()
    expect(band(el).classList.contains('away')).toBe(true)
  })

  it('a click outside the ribbon puts the peeked band away', () => {
    const el = render({ collapsed: true })
    tab(el, 'Home').click()
    flushSync()
    expect(band(el).classList.contains('peek')).toBe(true)
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    flushSync()
    expect(band(el).classList.contains('away')).toBe(true)
  })

  it('a command run from the peeked band puts it away', () => {
    const onAction = vi.fn()
    const el = render({ collapsed: true, onAction })
    tab(el, 'Review').click()
    flushSync()
    el.querySelector<HTMLButtonElement>('.band.peek [aria-label^="New Comment"]')!.click()
    flushSync()
    expect(onAction).toHaveBeenCalledWith('new-comment', expect.anything())
    expect(band(el).classList.contains('away')).toBe(true)
  })

  it('a double-click on a tab collapses the ribbon and expands it again', () => {
    const el = render()
    tab(el, 'Home').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    flushSync()
    expect(band(el).classList.contains('away')).toBe(true)
    tab(el, 'Home').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    flushSync()
    expect(band(el).classList.contains('away')).toBe(false)
  })

  it('the chevron at the band\'s end collapses, and the one on the tab row expands', () => {
    const el = render()
    el.querySelector<HTMLButtonElement>('[aria-label="Collapse the Ribbon"]')!.click()
    flushSync()
    expect(band(el).classList.contains('away')).toBe(true)
    el.querySelector<HTMLButtonElement>('[aria-label="Expand the Ribbon"]')!.click()
    flushSync()
    expect(band(el).classList.contains('away')).toBe(false)
  })

  it('pins the peeked band open from its own chevron', () => {
    const el = render({ collapsed: true })
    tab(el, 'Home').click()
    flushSync()
    el.querySelector<HTMLButtonElement>('.band.peek [aria-label="Pin the Ribbon"]')!.click()
    flushSync()
    expect(band(el).classList.contains('peek')).toBe(false)
    expect(band(el).classList.contains('away')).toBe(false)
  })
})
