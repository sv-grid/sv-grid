/**
 * DOM: body cells are recycled across the column window.
 *
 * With column virtualization on, the body cells' {#each} is keyed by a slot,
 * not by the column id. A column keeps its <td> while it stays in the window;
 * a column entering the window takes the <td> of one that left. A thumb drag
 * that jumps far along a wide grid therefore updates the cells in place
 * instead of destroying the window's cells and creating new ones.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import { renderComponent } from './render-component'
import CountingCell from './counting-cell.test.svelte'

const COLS = 400
const ROWS = 10

type Row = Record<string, number>

function makeData(): Row[] {
  return Array.from({ length: ROWS }, (_, r) => {
    const row: Row = { id: r }
    for (let c = 0; c < COLS; c += 1) row[`c${c}`] = r * 1000 + c
    return row
  })
}

let cleanup: (() => void) | null = null
afterEach(() => {
  cleanup?.()
  cleanup = null
})

async function mountGrid(columns: unknown[]) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGrid, {
    target,
    props: {
      data: makeData(),
      columns,
      getRowId: (r: Row) => String(r.id),
      containerHeight: 400,
      containerWidth: 1000,
    } as never,
  })
  flushSync()
  await new Promise((r) => setTimeout(r, 30))
  flushSync()
  cleanup = () => {
    unmount(app)
    target.remove()
  }
  return target
}

async function scrollTo(root: HTMLElement, left: number) {
  const container = root.querySelector<HTMLElement>('.sv-grid-container')!
  container.scrollLeft = left
  container.dispatchEvent(new Event('scroll'))
  await new Promise((r) => setTimeout(r, 40))
  flushSync()
}

const firstRowCells = (root: HTMLElement) =>
  [...root.querySelector('tbody tr')!.querySelectorAll<HTMLElement>(':scope > td[data-col-id]')]

const plainColumns = () => Array.from({ length: COLS }, (_, c) => ({ field: `c${c}`, header: `C${c}`, width: 100 }))

describe('body cells recycled across the column window', { timeout: 30_000 }, () => {
  it('reuses the <td>s on a far jump and every cell shows its own column', async () => {
    const root = await mountGrid(plainColumns())
    const before = firstRowCells(root)
    expect(before[0]!.dataset.colId).toBe('c0')

    await scrollTo(root, 200 * 100)
    const after = firstRowCells(root)
    const ids = after.map((td) => td.dataset.colId!)
    // The window moved: none of the first columns are rendered any more.
    expect(ids).not.toContain('c0')
    expect(ids.some((id) => Number(id.slice(1)) >= 195)).toBe(true)
    // ...and the cells are the same elements, now showing other columns.
    const reused = after.filter((td) => before.includes(td)).length
    expect(reused).toBeGreaterThanOrEqual(Math.min(before.length, after.length) - 2)
    // Every cell's text is its own column's value (row 0: value = column index).
    for (const td of after) expect(td.textContent!.trim()).toBe(td.dataset.colId!.slice(1))
    // Ids stay unique.
    expect(new Set(after.map((td) => td.id)).size).toBe(after.length)
  })

  it('keeps a column on the same <td> while it stays in the window', async () => {
    const root = await mountGrid(plainColumns())
    const byColumn = () => new Map(firstRowCells(root).map((td) => [td.dataset.colId!, td]))
    const before = byColumn()
    await scrollTo(root, 200)
    const after = byColumn()
    const kept = [...before.keys()].filter((id) => after.has(id))
    expect(kept.length).toBeGreaterThan(0)
    for (const id of kept) expect(after.get(id)).toBe(before.get(id))
  })

  it('re-creates an app cell component per column instead of re-propping it', async () => {
    const columns = Array.from({ length: COLS }, (_, c) => ({
      field: `c${c}`,
      header: `C${c}`,
      width: 100,
      cell: (ctx: { getValue: () => unknown; column: { id: string } }) =>
        renderComponent(CountingCell, { columnId: ctx.column.id, value: ctx.getValue() }),
    }))
    const root = await mountGrid(columns)
    await scrollTo(root, 200 * 100)
    // Each mounted instance records the column it was created for; a cell
    // showing a column must be an instance created for that column.
    for (const td of firstRowCells(root)) {
      const el = td.querySelector<HTMLElement>('[data-counting-cell]')!
      expect(el.dataset.createdFor).toBe(td.dataset.colId)
    }
  })
})
