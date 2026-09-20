/**
 * Sticky group rows: the group a row belongs to stays under the header
 * while its rows scroll past. Under virtualization the band renders a copy
 * of each ancestor; without it the real rows stick. Driven through the
 * `serverGroup` seam with plain data, so no row model is needed to say
 * which rows are groups and how deep they sit.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import { createCoreRowModel, tableFeatures } from './index'
import type { ColumnDef, SvGridApi } from './index'

type Row = { id: string; name: string; kind: 'group' | 'leaf'; level: number }
const features = tableFeatures({})
const cols: ColumnDef<typeof features, Row>[] = [
  { field: 'name', header: 'Name', width: 200 },
  { field: 'id', header: 'Id', width: 80 },
]

const tick = () => new Promise<void>((r) => setTimeout(r))

/** A(0) > A1(1) > 20 leaves, A2(1) > 20 leaves, B(0) > B1(1) > 20 leaves: 65 rows. */
function tree(): Row[] {
  const out: Row[] = []
  let n = 0
  const leaves = (under: string) => {
    for (let i = 0; i < 20; i += 1) out.push({ id: `${under}-${i}`, name: `leaf ${n++}`, kind: 'leaf', level: 2 })
  }
  out.push({ id: 'A', name: 'A', kind: 'group', level: 0 })
  out.push({ id: 'A1', name: 'A1', kind: 'group', level: 1 })
  leaves('A1')
  out.push({ id: 'A2', name: 'A2', kind: 'group', level: 1 })
  leaves('A2')
  out.push({ id: 'B', name: 'B', kind: 'group', level: 0 })
  out.push({ id: 'B1', name: 'B1', kind: 'group', level: 1 })
  leaves('B1')
  return out
}

function mountGrid(extra: Record<string, unknown>) {
  return new Promise<{ api: SvGridApi<typeof features, Row>; target: HTMLElement; destroy: () => void }>((res, rej) => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(SvGrid, {
      target,
      props: {
        data: tree(),
        columns: cols,
        features,
        _rowModels: { coreRowModel: createCoreRowModel() },
        getRowId: (r: Row) => r.id,
        rowHeight: 30,
        containerHeight: 200,
        stickyGroupRows: true,
        serverGroup: {
          isGroup: (r: Row) => r.kind === 'group',
          level: (r: Row) => r.level,
          expanded: () => true,
          onToggle: () => {},
        },
        onApiReady(api: SvGridApi<typeof features, Row>) {
          res({ api, target, destroy: () => { unmount(app); target.remove() } })
        },
        ...extra,
      } as any,
    })
    queueMicrotask(() => { if (!target.querySelector('[role="grid"]')) rej(new Error('no grid')) })
  })
}

async function scrollTo(target: HTMLElement, top: number) {
  const container = target.querySelector('.sv-grid-container') as HTMLElement
  container.scrollTop = top
  container.dispatchEvent(new Event('scroll'))
  // The virtualizer syncs to the scroll position on the next animation frame.
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  await tick()
  await tick()
}

const stickyNames = (target: HTMLElement) =>
  [...target.querySelectorAll<HTMLElement>('tr.sv-grid-row-sticky-group')].map((tr) => tr.textContent!.replace(/\s+/g, ' ').trim().split(' ')[0])

describe('stickyGroupRows under virtualization', () => {
  it('renders copies of the ancestors of the first row under the header, deepest last', async () => {
    const { target, destroy } = await mountGrid({ virtualization: true })
    try {
      await tick()
      // Row 0 is A itself: nothing to hold.
      expect(stickyNames(target)).toEqual([])
      // Row 10 is a leaf under A1: A, then A1.
      await scrollTo(target, 300)
      expect(stickyNames(target)).toEqual(['A', 'A1'])
      const band = [...target.querySelectorAll<HTMLElement>('tr.sv-grid-row-sticky-group')]
      expect(band[0]!.getAttribute('aria-hidden')).toBe('true')
      expect(band[1]!.classList.contains('sv-grid-row-sticky-group-last')).toBe(true)
      // The second sits a row under the first.
      expect(parseInt(band[1]!.style.top, 10) - parseInt(band[0]!.style.top, 10)).toBe(30)
      // A copy carries no cell ids, so the real row's id stays unique.
      expect(band[0]!.querySelector('[id]')).toBeNull()
      // Row 30 is a leaf under A2.
      await scrollTo(target, 900)
      expect(stickyNames(target)).toEqual(['A', 'A2'])
      // Row 50 is a leaf under B1.
      await scrollTo(target, 1500)
      expect(stickyNames(target)).toEqual(['B', 'B1'])
      // Back to the top: the band is gone.
      await scrollTo(target, 0)
      expect(stickyNames(target)).toEqual([])
    } finally {
      destroy()
    }
  })

  it('is off unless asked for', async () => {
    const { target, destroy } = await mountGrid({ virtualization: true, stickyGroupRows: false })
    try {
      await scrollTo(target, 300)
      expect(stickyNames(target)).toEqual([])
    } finally {
      destroy()
    }
  })
})

describe('stickyGroupRows without virtualization', () => {
  it('makes the real ancestor rows sticky instead of copying them', async () => {
    const { target, destroy } = await mountGrid({ virtualization: false })
    try {
      await scrollTo(target, 300)
      const sticky = [...target.querySelectorAll<HTMLElement>('tr.sv-grid-row-sticky-group')]
      expect(sticky.map((tr) => tr.textContent!.trim().split(/\s+/)[0])).toEqual(['A', 'A1'])
      // They are the rows themselves: cells keep their row index.
      expect(sticky[0]!.querySelector('[data-svgrid-row]')?.getAttribute('data-svgrid-row')).toBe('0')
      expect(sticky[1]!.querySelector('[data-svgrid-row]')?.getAttribute('data-svgrid-row')).toBe('1')
      expect(sticky[0]!.getAttribute('aria-hidden')).toBeNull()
      // Every row renders exactly once.
      const rows = [...target.querySelectorAll('tbody.sv-grid-body tr.sv-grid-row')]
      expect(rows).toHaveLength(65)
    } finally {
      destroy()
    }
  })
})
