/**
 * DOM test: two sheets on one page, and the keys go to the one the user is in.
 *
 * The shortcut targets in sheet/shortcuts.ts are module-level singletons.
 * Before a sheet claimed them on pointer-down and focus, they belonged to
 * whichever sheet mounted last, so Ctrl+B in the first sheet bolded a cell
 * in the second; a docs page with an example per section showed it on every
 * key. Unmounting a sheet lets go only of what is still its own.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, unmount, flushSync, tick } from 'svelte'
import SvSheet from './SvSheet.svelte'
import { handleSheetKey, getShortcutOwner } from './sheet/shortcuts'
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

type Mounted = { host: HTMLElement; comp: ReturnType<typeof mount>; sheet: SvSheet; cmd: () => GridCommandContext }
const mounted: Mounted[] = []
afterEach(() => {
  for (const m of mounted.splice(0)) { unmount(m.comp); m.host.remove() }
})

function mountSheet(): Promise<Mounted> {
  return new Promise((resolve) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api: { getCommandContext(): GridCommandContext } | null = null
    const comp = mount(SvSheet, {
      target: host,
      props: {
        data: [{ name: 'Sheet1', cells: [['1', '2'], ['3', '4']] }],
        rows: 4,
        columns: 3,
        showRibbon: false,
        onReady: (a: { getCommandContext(): GridCommandContext }) => {
          api = a
          const m: Mounted = { host, comp, sheet: comp as unknown as SvSheet, cmd: () => api!.getCommandContext() }
          mounted.push(m)
          resolve(m)
        },
      },
    })
    flushSync()
  })
}

const ctrlB = () => new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, cancelable: true })
const boldAt = (m: Mounted, key: string) => Boolean(m.sheet.getState().sheets.Sheet1!.formats[key]?.bold)
const pointerDownIn = (m: Mounted) => {
  m.host.querySelector('.sv-sheet')!.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  flushSync()
}

describe('SvSheet shortcut ownership', () => {
  it('Ctrl+B bolds the sheet the pointer is in, not the one mounted last', async () => {
    const a = await mountSheet()
    const b = await mountSheet()
    // The last mount owns the targets until someone clicks elsewhere.
    expect(getShortcutOwner()).not.toBeNull()

    pointerDownIn(a)
    expect(handleSheetKey(ctrlB(), a.cmd())).toBe(true)
    flushSync()
    await tick()
    expect(boldAt(a, 'r0 A')).toBe(true)
    expect(boldAt(b, 'r0 A')).toBe(false)

    pointerDownIn(b)
    expect(handleSheetKey(ctrlB(), b.cmd())).toBe(true)
    flushSync()
    await tick()
    expect(boldAt(b, 'r0 A')).toBe(true)
  })

  it('unmounting the other sheet does not disarm the one the user is in', async () => {
    const a = await mountSheet()
    const b = await mountSheet()
    pointerDownIn(a)
    const owner = getShortcutOwner()
    unmount(b.comp)
    b.host.remove()
    mounted.splice(mounted.indexOf(b), 1)
    // B was not the owner, so its teardown left A's claim alone.
    expect(getShortcutOwner()).toBe(owner)
    expect(handleSheetKey(ctrlB(), a.cmd())).toBe(true)
    flushSync()
    await tick()
    expect(boldAt(a, 'r0 A')).toBe(true)
  })
})
