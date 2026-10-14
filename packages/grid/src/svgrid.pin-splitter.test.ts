/**
 * `pinSplitter`: the divider at the edge of the left-pinned columns. Where a
 * drag lands, that pinning or unpinning keeps every column where it was
 * drawn, and that a grid without the prop never loads it.
 */
import { describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import { orderKeepingScreen, pinCountAt, pinEdges } from './pin-splitter'

const settle = () => new Promise<void>((r) => setTimeout(r))
async function until(check: () => boolean, label: string) {
  for (let i = 0; i < 100; i++) {
    if (check()) return
    await settle()
  }
  throw new Error(`timed out waiting for ${label}`)
}

describe('pin splitter arithmetic', () => {
  it('snaps to the nearest column edge, within the room left', () => {
    const edges = pinEdges(40, [100, 200, 150])
    expect(edges).toEqual([40, 140, 340, 490])
    expect(pinCountAt(edges, 60, 2, Infinity)).toBe(0)
    expect(pinCountAt(edges, 120, 2, Infinity)).toBe(1)
    expect(pinCountAt(edges, 300, 2, Infinity)).toBe(2)
    // Never every column, and never past the room the others need.
    expect(pinCountAt(edges, 900, 2, Infinity)).toBe(2)
    expect(pinCountAt(edges, 900, 3, 300)).toBe(1)
  })

  it('keeps the shown columns in screen order and hidden ones in their slots', () => {
    // b is hidden; d was pinned, so it is drawn first.
    expect(orderKeepingScreen(['a', 'b', 'c', 'd'], ['d', 'a', 'c'])).toEqual(['d', 'b', 'a', 'c'])
    // A column the grid adds itself (not in the order) is skipped.
    expect(orderKeepingScreen(['a', 'c'], ['auto', 'c', 'a'])).toEqual(['c', 'a'])
  })
})

function mountGrid(extra: Record<string, unknown> = {}) {
  const orders: string[][] = []
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGrid, {
    target,
    props: {
      data: [{ id: 1, name: 'Alpha', qty: 3, done: true }],
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'qty', header: 'Qty' },
        { field: 'done', header: 'Done' },
      ],
      getRowId: (r: { id: number }) => String(r.id),
      showRowNumbers: true,
      containerHeight: 300,
      virtualization: false,
      columnVirtualization: false,
      onColumnOrderChange: (o: string[]) => orders.push(o),
      ...extra,
    } as never,
  })
  flushSync()
  const header = () => [...target.querySelectorAll('thead th[data-svgrid-header-col]')].map((th) => th.getAttribute('data-svgrid-header-col'))
  const pinned = () => [...target.querySelectorAll('thead th[data-pinned="left"]')].map((th) => th.getAttribute('data-svgrid-header-col'))
  const hit = () => target.querySelector<HTMLElement>('.sv-pin-split-hit')
  const key = (k: string) => {
    hit()!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
    flushSync()
  }
  return { target, orders, header, pinned, hit, key, destroy: () => (unmount(app), target.remove()) }
}

describe('pinSplitter', () => {
  it('is drawn only when asked for, with its words from localization.text', async () => {
    const off = mountGrid()
    await settle()
    expect(off.target.querySelector('.sv-pin-split')).toBeNull()
    off.destroy()
    const on = mountGrid({ pinSplitter: true, localization: { text: { pinSplitterLabel: 'Fixed columns' } } })
    try {
      await until(() => !!on.hit(), 'the splitter')
      expect(on.hit()!.getAttribute('role')).toBe('separator')
      expect(on.hit()!.getAttribute('aria-label')).toBe('Fixed columns')
      expect(on.hit()!.getAttribute('aria-valuenow')).toBe('0')
      expect(on.hit()!.getAttribute('aria-valuemax')).toBe('2')
    } finally {
      on.destroy()
    }
  })

  it('pins and unpins one column per arrow key, never all of them', async () => {
    const g = mountGrid({ pinSplitter: true })
    try {
      await until(() => !!g.hit(), 'the splitter')
      g.key('ArrowRight')
      expect(g.pinned()).toEqual(['name'])
      g.key('ArrowRight')
      g.key('ArrowRight')
      expect(g.pinned()).toEqual(['name', 'qty'])
      expect(g.hit()!.getAttribute('aria-valuetext')).toBe('2 pinned columns')
      g.key('ArrowLeft')
      expect(g.pinned()).toEqual(['name'])
      g.key('Home')
      expect(g.pinned()).toEqual([])
    } finally {
      g.destroy()
    }
  })

  it('a column unpinned stays where it was drawn', async () => {
    // Done is pinned, so it is drawn first although declared last.
    const g = mountGrid({ pinSplitter: true, initialColumnPinning: { left: ['done'], right: [] } })
    try {
      await until(() => !!g.hit(), 'the splitter')
      expect(g.header()).toEqual(['done', 'name', 'qty'])
      g.key('ArrowLeft')
      expect(g.pinned()).toEqual([])
      expect(g.header()).toEqual(['done', 'name', 'qty'])
      expect(g.orders.at(-1)).toEqual(['done', 'name', 'qty'])
    } finally {
      g.destroy()
    }
  })
})
