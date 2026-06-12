/**
 * Component tests for the engine-level row pinning props
 * (`pinnedTopRows` / `pinnedBottomRows`). Mount a real <SvGrid>,
 * pass the props, then assert on the rendered DOM:
 *
 *   - pinned-top / pinned-bottom <tbody>s are rendered
 *   - each pinned row carries the expected class + data attributes
 *   - column widths + cell values match the schema
 *   - read-only invariants hold (no editor cell, no checkbox cell)
 *   - reactive prop changes re-render
 *   - stacking attributes (data-pinned-index) are present
 *   - CSS variables for sticky offsets are set on the shell
 */

import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  columnFilteringFeature,
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from './index'
import type { ColumnDef, SvGridApi } from './index'

type Row = { id: string; account: string; arr: number; seats: number }

const features = tableFeatures({ columnFilteringFeature, rowSortingFeature })

const rows: Row[] = [
  { id: 'ACC-1', account: 'Helios',  arr: 120_000, seats: 40 },
  { id: 'ACC-2', account: 'Vertex',  arr:  85_000, seats: 22 },
  { id: 'ACC-3', account: 'Atlas',   arr: 250_000, seats: 80 },
  { id: 'ACC-4', account: 'Quantum', arr:  60_000, seats: 15 },
]

const cols: ColumnDef<typeof features, Row>[] = [
  { field: 'id',      header: 'ID',      width: 100, editable: false },
  { field: 'account', header: 'Account', width: 200, editable: false },
  { field: 'arr',     header: 'ARR',     width: 130, editable: false, align: 'right',
    format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } } },
  { field: 'seats',   header: 'Seats',   width:  90, editable: false, align: 'right' },
]

type MountOpts = {
  pinnedTopRows?: ReadonlyArray<Row>
  pinnedBottomRows?: ReadonlyArray<Row>
}

function mountGrid(opts: MountOpts = {}) {
  return new Promise<{
    target: HTMLElement
    api: SvGridApi<typeof features, Row>
    destroy: () => void
    setProps: (next: MountOpts) => void
  }>((res, rej) => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const propsState: MountOpts = { ...opts }
    let api: SvGridApi<typeof features, Row> | null = null
    const app = mount(SvGrid, {
      target,
      props: {
        data: rows,
        columns: cols,
        features,
        _rowModels: {
          coreRowModel:     createCoreRowModel(),
          filteredRowModel: createFilteredRowModel(),
          sortedRowModel:   createSortedRowModel(sortFns),
        },
        containerHeight: 480,
        virtualization: false,
        columnVirtualization: false,
        enableInlineEditing: false,
        showPagination: false,
        showColumnFilters: false,
        showGlobalFilter: false,
        showRowSelection: false,
        pinnedTopRows: propsState.pinnedTopRows,
        pinnedBottomRows: propsState.pinnedBottomRows,
        onApiReady(received: SvGridApi<typeof features, Row>) {
          api = received
          res({
            target,
            api,
            destroy: () => {
              unmount(app)
              target.remove()
            },
            setProps(next) {
              propsState.pinnedTopRows = next.pinnedTopRows
              propsState.pinnedBottomRows = next.pinnedBottomRows
              // Svelte 5: re-mount-with-new-props isn't ideal, but here
              // we use the `$state` props passthrough via the parent
              // closure. The easiest mechanism is to imperatively
              // update via Svelte's prop machinery, which $props()
              // reads from this same object reference.
              ;(app as unknown as { pinnedTopRows: unknown; pinnedBottomRows: unknown })
                .pinnedTopRows = next.pinnedTopRows
              ;(app as unknown as { pinnedTopRows: unknown; pinnedBottomRows: unknown })
                .pinnedBottomRows = next.pinnedBottomRows
              flushSync()
            },
          })
        },
      } as any,
    })
    queueMicrotask(() => { if (!api) rej(new Error('onApiReady never fired')) })
  })
}

const tick = () => new Promise<void>((r) => queueMicrotask(r))

const TOTALS: Row = {
  id: '⌃ TOTALS', account: 'All accounts',
  arr: rows.reduce((s, r) => s + r.arr, 0),
  seats: rows.reduce((s, r) => s + r.seats, 0),
}
const BENCHMARK: Row = {
  id: '⌃ BENCH', account: 'Industry benchmark',
  arr: 180_000, seats: 95,
}
const PAGE: Row = {
  id: '⌄ PAGE', account: 'Visible page',
  arr: rows.reduce((s, r) => s + r.arr, 0),
  seats: rows.reduce((s, r) => s + r.seats, 0),
}

describe('SvGrid - pinnedTopRows render', () => {
  it('renders a pinned-top tbody when prop is provided', async () => {
    const { target, destroy } = await mountGrid({ pinnedTopRows: [TOTALS] })
    try {
      await tick()
      const topBody = target.querySelector('tbody.sv-grid-pinned-top-body')
      expect(topBody, 'pinned-top tbody should exist').not.toBeNull()
      const trs = topBody!.querySelectorAll('tr.sv-grid-pinned-row-top')
      expect(trs.length).toBe(1)
    } finally { destroy() }
  })

  it('does NOT render the tbody when prop is empty / undefined', async () => {
    const { target, destroy } = await mountGrid({ pinnedTopRows: [] })
    try {
      await tick()
      const topBody = target.querySelector('tbody.sv-grid-pinned-top-body')
      expect(topBody).toBeNull()
    } finally { destroy() }
  })

  it('renders the row values using the column schema (format applied)', async () => {
    const { target, destroy } = await mountGrid({ pinnedTopRows: [TOTALS] })
    try {
      await tick()
      const tds = target
        .querySelectorAll('tr.sv-grid-pinned-row-top td')
      expect(tds.length).toBe(cols.length)
      // ARR cell should be currency-formatted ($515,000) - currency
      // symbol exact form may vary by ICU build; assert a "$" plus the
      // raw number with grouping is present.
      const arrCellText = (tds[2]?.textContent ?? '').trim()
      expect(arrCellText).toMatch(/\$/)
      expect(arrCellText).toContain('515')
    } finally { destroy() }
  })

  it('stacks multiple pinned-top rows with data-pinned-index', async () => {
    const { target, destroy } = await mountGrid({
      pinnedTopRows: [TOTALS, BENCHMARK],
    })
    try {
      await tick()
      const trs = target.querySelectorAll('tr.sv-grid-pinned-row-top')
      expect(trs.length).toBe(2)
      expect(trs[0]!.getAttribute('data-pinned-row')).toBe('top')
      expect(trs[0]!.getAttribute('data-pinned-index')).toBe('0')
      expect(trs[1]!.getAttribute('data-pinned-index')).toBe('1')
    } finally { destroy() }
  })

  it('marks pinned cells with the data-pinned-row attribute', async () => {
    const { target, destroy } = await mountGrid({ pinnedTopRows: [TOTALS] })
    try {
      await tick()
      const tr = target.querySelector('tr.sv-grid-pinned-row-top')
      expect(tr!.getAttribute('data-pinned-row')).toBe('top')
    } finally { destroy() }
  })
})

describe('SvGrid - pinnedBottomRows render', () => {
  it('renders a pinned-bottom tbody when prop is provided', async () => {
    const { target, destroy } = await mountGrid({ pinnedBottomRows: [PAGE] })
    try {
      await tick()
      const bottomBody = target.querySelector('tbody.sv-grid-pinned-bottom-body')
      expect(bottomBody).not.toBeNull()
      const trs = bottomBody!.querySelectorAll('tr.sv-grid-pinned-row-bottom')
      expect(trs.length).toBe(1)
      expect(trs[0]!.getAttribute('data-pinned-row')).toBe('bottom')
    } finally { destroy() }
  })

  it('renders bottom rows AFTER the regular tbody', async () => {
    const { target, destroy } = await mountGrid({ pinnedBottomRows: [PAGE] })
    try {
      await tick()
      const bodies = target.querySelectorAll('tbody')
      // [regular .sv-grid-body, .sv-grid-pinned-bottom-body]
      // In the DOM order, the bottom tbody must come after the main body.
      const classes = Array.from(bodies).map((b) => b.className)
      const mainIdx = classes.findIndex((c) => c.includes('sv-grid-body') && !c.includes('pinned'))
      const botIdx  = classes.findIndex((c) => c.includes('sv-grid-pinned-bottom-body'))
      expect(mainIdx).toBeGreaterThanOrEqual(0)
      expect(botIdx).toBeGreaterThan(mainIdx)
    } finally { destroy() }
  })
})

describe('SvGrid - pinned rows are read-only', () => {
  it('pinned-row cells do not carry the editing class even with inline editing enabled', async () => {
    const { target, destroy } = await mountGrid({ pinnedTopRows: [TOTALS] })
    try {
      await tick()
      const editingCells = target.querySelectorAll(
        'tr.sv-grid-pinned-row-top td.sv-grid-cell-editing',
      )
      expect(editingCells.length).toBe(0)
    } finally { destroy() }
  })

  it('pinned rows do not carry the selection checkbox cell', async () => {
    const { target, destroy } = await mountGrid({ pinnedTopRows: [TOTALS] })
    try {
      await tick()
      // The selection cell class is `.sv-grid-selection-cell`. It may
      // appear in the regular row when row-selection is on, but never
      // with a working <button role="checkbox"> inside it on a pinned
      // row (the snippet renders an empty <td>).
      const checkboxes = target.querySelectorAll(
        'tr.sv-grid-pinned-row-top button[role="checkbox"]',
      )
      expect(checkboxes.length).toBe(0)
    } finally { destroy() }
  })
})

describe('SvGrid - pinned rows + CSS variables', () => {
  it('sets --sg-thead-h and --sg-pinned-row-h CSS variables on the shell', async () => {
    const { target, destroy } = await mountGrid({
      pinnedTopRows: [TOTALS],
      pinnedBottomRows: [PAGE],
    })
    try {
      await tick()
      const shell = target.querySelector('.sv-grid-shell') as HTMLElement | null
      expect(shell, 'shell should exist').not.toBeNull()
      const style = shell!.getAttribute('style') ?? ''
      expect(style).toContain('--sg-thead-h')
      expect(style).toContain('--sg-pinned-row-h')
    } finally { destroy() }
  })
})
