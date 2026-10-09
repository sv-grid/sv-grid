/**
 * DOM: pinned columns with column virtualization on (the default).
 *
 * Pinned cells are position: sticky, so they must stay in the DOM. The grid
 * used to keep them there by rendering one contiguous run from column 0 (a
 * left pin) to the last column (a right pin), so pinning either edge of a
 * 1,000-column grid rendered every column. It now renders three runs - the
 * pinned-left columns, the virtual window, the pinned-right columns - with a
 * spacer cell for the columns between two runs.
 *
 * The table uses `table-layout: fixed`, so every row must give each column the
 * same slot. The checks compare each row's total declared width (cells plus
 * spacers) against the leaf header row.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'

const COLS = 120
const ROWS = 20

type Row = Record<string, number>

function leafColumns() {
  return Array.from({ length: COLS }, (_, c) => ({ field: `c${c}`, header: `C${c}`, width: 100 }))
}

function makeData(): Row[] {
  return Array.from({ length: ROWS }, (_, r) => {
    const row: Row = { id: r }
    for (let c = 0; c < COLS; c += 1) row[`c${c}`] = r * COLS + c
    return row
  })
}

let cleanup: (() => void) | null = null
afterEach(() => {
  cleanup?.()
  cleanup = null
})

async function mountGrid(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGrid, {
    target,
    props: {
      data: makeData(),
      columns: leafColumns(),
      getRowId: (r: Row) => String(r.id),
      containerHeight: 400,
      containerWidth: 1000,
      ...props,
    } as never,
  })
  flushSync()
  // The column virtualizer learns its count and viewport in effects.
  await new Promise((r) => setTimeout(r, 30))
  flushSync()
  cleanup = () => {
    unmount(app)
    target.remove()
  }
  return target
}

const px = (el: Element) => Number.parseFloat((el as HTMLElement).style.width) || 0
const rowWidth = (tr: Element) => [...tr.children].reduce((sum, cell) => sum + px(cell), 0)
const dataCells = (tr: Element) => [...tr.querySelectorAll<HTMLElement>('td[data-col-id]')]
const firstBodyRow = (root: HTMLElement) => root.querySelector('tbody tr')!
const leafHeaderRow = (root: HTMLElement) => [...root.querySelectorAll('thead tr')].pop()!

describe('pinned columns with column virtualization', { timeout: 30_000 }, () => {
  it('renders only the window when nothing is pinned (baseline)', async () => {
    const root = await mountGrid({})
    const ids = dataCells(firstBodyRow(root)).map((td) => td.dataset.colId)
    expect(ids.length).toBeLessThan(40)
    expect(ids).not.toContain(`c${COLS - 1}`)
  })

  it('renders the window plus the pinned columns, not every column', async () => {
    const root = await mountGrid({ initialColumnPinning: { left: ['c0'], right: [`c${COLS - 1}`] } })
    const ids = dataCells(firstBodyRow(root)).map((td) => td.dataset.colId)
    // Before: pinning both ends rendered all 120 columns in every row.
    expect(ids.length).toBeLessThan(40)
    expect(ids[0]).toBe('c0')
    expect(ids[ids.length - 1]).toBe(`c${COLS - 1}`)
    // The columns between the window and the right pin are a spacer, not cells.
    const spacers = firstBodyRow(root).querySelectorAll('td.sv-grid-cell-spacer')
    expect(spacers.length).toBeGreaterThan(0)
  })

  it('gives every row the same slots as the leaf header row', async () => {
    const root = await mountGrid({ initialColumnPinning: { left: ['c0'], right: [`c${COLS - 1}`] } })
    const header = leafHeaderRow(root)
    const body = firstBodyRow(root)
    expect(slots(body)).toBe(slots(header))
    // Fixed layout: cells plus spacers cover every column (plus the system
    // columns, such as the row checkbox, that sit before them).
    expect(rowWidth(header)).toBeGreaterThanOrEqual(COLS * 100)
    expect(rowWidth(body)).toBeCloseTo(rowWidth(header), 0)
  })

  it('splits a column group that crosses a seam into one cell per run', async () => {
    const columns = [
      { id: 'all', header: 'Everything', columns: leafColumns() },
    ]
    const root = await mountGrid({ columns, initialColumnPinning: { left: ['c0'], right: [`c${COLS - 1}`] } })
    const groupCells = [...root.querySelectorAll<HTMLElement>('th.sv-grid-group-header-cell')]
    // One piece over the left pin + window, one over the right pin; distinct
    // keys, or Svelte would have thrown on a duplicate key in the each block.
    expect(groupCells.length).toBe(2)
    expect(groupCells.every((th) => th.textContent?.includes('Everything'))).toBe(true)
    const groupRow = groupCells[0]!.closest('tr')!
    const header = leafHeaderRow(root)
    expect(slots(groupRow)).toBe(slots(header))
    expect(rowWidth(groupRow)).toBeCloseTo(rowWidth(header), 0)
  })

  it('clamps a merged cell to the run it starts in', async () => {
    const root = await mountGrid({
      initialColumnPinning: { left: ['c0'], right: [`c${COLS - 1}`] },
      mergedCells: [{ rowIndex: 0, colIndex: 0, rowSpan: 1, colSpan: COLS }],
    })
    const header = leafHeaderRow(root)
    const body = firstBodyRow(root)
    // The merge covers every column, but no td may span across a spacer: the
    // row keeps the header's slots, so each piece stays inside its run.
    expect(slots(body)).toBe(slots(header))
    expect(rowWidth(body)).toBeCloseTo(rowWidth(header), 0)
  })
})

describe('the first render of a wide grid', { timeout: 30_000 }, () => {
  it('draws a window of columns, not every column, before anything is measured', async () => {
    const wide = 2000
    const target = document.createElement('div')
    document.body.appendChild(target)
    const columns = Array.from({ length: wide }, (_, c) => ({ field: `c${c}`, header: `C${c}`, width: 100 }))
    const data = [Object.fromEntries([['id', 0], ...columns.map((c, i) => [c.field, i])])]
    const app = mount(SvGrid, {
      target,
      props: { data, columns, getRowId: (r: Row) => String(r.id), containerHeight: 300 } as never,
    })
    flushSync()
    cleanup = () => {
      unmount(app)
      target.remove()
    }
    // jsdom never lays out, so this is the pre-measure window: the columns
    // that fit an estimated viewport, plus the overscan.
    const cells = dataCells(firstBodyRow(target))
    expect(cells.length).toBeGreaterThan(0)
    expect(cells.length).toBeLessThan(40)
    expect(target.querySelectorAll('td').length).toBeLessThan(200)
  })
})

/** Table slots a row occupies: each cell counts its colspan. */
function slots(tr: Element): number {
  return [...tr.children].reduce((n, cell) => n + ((cell as HTMLTableCellElement).colSpan || 1), 0)
}
