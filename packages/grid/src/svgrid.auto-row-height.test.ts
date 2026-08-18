/**
 * DOM: `autoRowHeight` sizes each row to its own content.
 *
 * jsdom does no layout - getBoundingClientRect is 0 and the global
 * ResizeObserver stub never fires - so this file installs a controllable
 * observer and fakes element heights. That is enough to prove the wiring that
 * actually matters: rows are measured, the measurement reaches the virtualizer,
 * and a measured row is sized by its content instead of the fixed rowHeight.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  sortFns,
  tableFeatures,
  rowSortingFeature,
} from './index'

type Row = { id: number; name: string; notes: string }

const data: Row[] = [
  { id: 1, name: 'Ada', notes: 'short' },
  { id: 2, name: 'Linus', notes: 'a much longer note that would wrap onto several lines in a narrow column' },
  { id: 3, name: 'Grace', notes: 'medium length note' },
]

const columns = [
  { field: 'name', header: 'Name', width: 120 },
  { field: 'notes', header: 'Notes', width: 160 },
]

const features = tableFeatures({ rowSortingFeature })
const tick = () => new Promise<void>((r) => queueMicrotask(r))
const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

/** A ResizeObserver whose callbacks this test can fire on demand. */
class ControllableRO {
  static instances: ControllableRO[] = []
  cb: () => void
  targets: Element[] = []
  constructor(cb: () => void) {
    this.cb = cb
    ControllableRO.instances.push(this)
  }
  observe(el: Element) { this.targets.push(el) }
  unobserve() {}
  disconnect() { this.targets = [] }
  static fireAll() { for (const i of ControllableRO.instances) i.cb() }
  static reset() { ControllableRO.instances = [] }
}

let originalRO: typeof globalThis.ResizeObserver
beforeEach(() => {
  originalRO = globalThis.ResizeObserver
  ControllableRO.reset()
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ControllableRO
})
afterEach(() => {
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = originalRO
})

function mountGrid(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGrid, {
    target,
    props: {
      data,
      columns,
      features,
      rowHeight: 30,
      _rowModels: {
        coreRowModel: createCoreRowModel(),
        filteredRowModel: createFilteredRowModel(),
        sortedRowModel: createSortedRowModel(sortFns),
      },
      containerHeight: 400,
      virtualization: false,
      ...props,
    } as never,
  })
  return { target, destroy: () => { unmount(app); target.remove() } }
}

let cleanup: (() => void) | null = null
afterEach(() => { cleanup?.(); cleanup = null })

const dataRows = (t: HTMLElement) =>
  [...t.querySelectorAll<HTMLElement>('tbody tr.sv-grid-row')].filter((r) => !r.classList.contains('sv-grid-group-row'))

describe('autoRowHeight', () => {
  it('is off by default: rows get a fixed height and no wrap class', async () => {
    const g = mountGrid({})
    cleanup = g.destroy
    await tick()
    const row = dataRows(g.target)[0]!
    expect(row.classList.contains('sv-grid-row-auto-height')).toBe(false)
    expect(row.getAttribute('style')).toContain('height: 30px')
    expect(row.getAttribute('style')).not.toContain('min-height')
  })

  it('switches rows to min-height + the wrap class when on', async () => {
    const g = mountGrid({ autoRowHeight: true })
    cleanup = g.destroy
    await tick()
    for (const row of dataRows(g.target)) {
      expect(row.classList.contains('sv-grid-row-auto-height')).toBe(true)
      // min-height, so content can grow the row instead of being clipped.
      expect(row.getAttribute('style')).toContain('min-height: 30px')
    }
  })

  it('feeds a measured height back into the row size', async () => {
    const g = mountGrid({ autoRowHeight: true })
    cleanup = g.destroy
    await tick()

    const rows = dataRows(g.target)
    expect(rows.length).toBe(3)
    // Fake layout: row 1 (the long note) wraps to 3 lines.
    const heights = [30, 90, 30]
    rows.forEach((row, i) => {
      row.getBoundingClientRect = () => ({ height: heights[i], width: 280, top: 0, left: 0, right: 280, bottom: heights[i]!, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
    })

    ControllableRO.fireAll()
    await raf()
    await tick()

    const after = dataRows(g.target)
    expect(after[0]?.getAttribute('style')).toContain('min-height: 30px')
    // The measured tall row is now sized by its content, not by rowHeight.
    expect(after[1]?.getAttribute('style')).toContain('min-height: 90px')
    expect(after[2]?.getAttribute('style')).toContain('min-height: 30px')
  })

  it('ignores autoRowHeight when rowHeight is a function (caller owns heights)', async () => {
    const g = mountGrid({ autoRowHeight: true, rowHeight: (i: number) => 40 + i * 10 })
    cleanup = g.destroy
    await tick()
    const rows = dataRows(g.target)
    expect(rows[0]?.classList.contains('sv-grid-row-auto-height')).toBe(false)
    expect(rows[0]?.getAttribute('style')).toContain('height: 40px')
    expect(rows[1]?.getAttribute('style')).toContain('height: 50px')
  })

  it('uses a numeric rowHeight as the pre-measure estimate', async () => {
    const g = mountGrid({ autoRowHeight: true, rowHeight: 48 })
    cleanup = g.destroy
    await tick()
    // Nothing measured yet, so every row sits at the estimate.
    for (const row of dataRows(g.target)) {
      expect(row.getAttribute('style')).toContain('min-height: 48px')
    }
  })

  it('works on the virtualized body too (the variable-size path)', async () => {
    const g = mountGrid({ autoRowHeight: true, virtualization: true })
    cleanup = g.destroy
    await tick()
    const rows = dataRows(g.target)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]?.classList.contains('sv-grid-row-auto-height')).toBe(true)

    rows.forEach((row, i) => {
      const h = i === 1 ? 96 : 30
      row.getBoundingClientRect = () => ({ height: h, width: 280, top: 0, left: 0, right: 280, bottom: h, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
    })
    ControllableRO.fireAll()
    await raf()
    await tick()

    const after = dataRows(g.target)
    // The virtualizer now sizes row 1 from its measurement, so the row element
    // reflects the measured height rather than the 30px estimate.
    expect(after[1]?.getAttribute('style')).toContain('96px')
  })

  it('does not re-report a sub-pixel change (no measure/layout loop)', async () => {
    const g = mountGrid({ autoRowHeight: true })
    cleanup = g.destroy
    await tick()
    const rows = dataRows(g.target)
    rows.forEach((row) => {
      row.getBoundingClientRect = () => ({ height: 70, width: 280, top: 0, left: 0, right: 280, bottom: 70, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
    })
    ControllableRO.fireAll()
    await raf()
    await tick()
    expect(dataRows(g.target)[0]?.getAttribute('style')).toContain('min-height: 70px')

    // A 0.4px drift must be ignored - otherwise fractional layout ping-pongs.
    dataRows(g.target).forEach((row) => {
      row.getBoundingClientRect = () => ({ height: 70.4, width: 280, top: 0, left: 0, right: 280, bottom: 70.4, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
    })
    ControllableRO.fireAll()
    await raf()
    await tick()
    expect(dataRows(g.target)[0]?.getAttribute('style')).toContain('min-height: 70px')
  })
})
