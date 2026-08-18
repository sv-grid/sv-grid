/**
 * Right-click context menu (Track A). Mounts a grid with `contextMenu`,
 * fires a synthetic `contextmenu` event on a cell, and asserts the menu
 * opens with the expected items and that actions/close work.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from './index'
import type { ColumnDef, SvGridApi } from './index'
import type { ContextMenuItem } from './SvGrid.types'

type Row = { id: number; name: string; team: string }
const features = tableFeatures({ rowSortingFeature, rowSelectionFeature })
const rows: Row[] = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  name: `Person ${i + 1}`,
  team: ['A', 'B'][i % 2]!,
}))
const cols: ColumnDef<typeof features, Row>[] = [
  { field: 'name', header: 'Name', width: 200, editorType: 'text' },
  { field: 'team', header: 'Team', width: 160, editorType: 'text' },
]
// Macrotask boundary: drains pending microtasks incl. the menu overlay's lazy
// import() + flush, so the context menu is mounted before assertions (GridMenus
// loads lazily as its own chunk the first time a menu/tooltip opens).
const tick = () => new Promise<void>((r) => setTimeout(r))

function mountGrid(contextMenu: unknown) {
  return new Promise<{ api: SvGridApi<typeof features, Row>; target: HTMLElement; destroy: () => void }>(
    (res, rej) => {
      const target = document.createElement('div')
      document.body.appendChild(target)
      const app = mount(SvGrid, {
        target,
        props: {
          data: rows,
          columns: cols,
          features,
          _rowModels: {
            coreRowModel: createCoreRowModel(),
            filteredRowModel: createFilteredRowModel(),
            sortedRowModel: createSortedRowModel(sortFns),
          },
          rowHeight: 32,
          containerHeight: 400,
          virtualization: false,
          enableCellSelection: true,
          contextMenu,
          onApiReady(api: SvGridApi<typeof features, Row>) {
            res({ api, target, destroy: () => { unmount(app); target.remove() } })
          },
        } as any,
      })
      queueMicrotask(() => { if (!target.querySelector('[role="grid"]')) rej(new Error('no grid')) })
    },
  )
}

function rightClickFirstCell(target: HTMLElement) {
  const cell = target.querySelector('.sv-grid-cell[data-svgrid-row]') as HTMLElement
  const r = cell.getBoundingClientRect()
  cell.dispatchEvent(
    new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.x + 4, clientY: r.y + 4 }),
  )
  return cell
}

/**
 * Right-click and wait until the menu's ITEMS are in the DOM.
 *
 * GridMenus is a lazy chunk, and the overlay element appears before its items
 * render. Waiting for the element alone leaves callers reading an empty item
 * list; waiting a fixed tick makes them depend on an earlier test having
 * already warmed the chunk. Only for cases that expect the menu to open - the
 * "stays closed" case must not use this.
 */
async function openContextMenu(target: HTMLElement) {
  rightClickFirstCell(target)
  await vi.waitFor(() => {
    const menu = target.querySelector('.sv-grid-context-menu')
    expect(menu).not.toBeNull()
    expect(menu!.querySelectorAll('.sv-grid-menu-item').length).toBeGreaterThan(0)
  })
  return target.querySelector('.sv-grid-context-menu') as HTMLElement
}

describe('SvGrid context menu', () => {
  it('opens the default menu on right-click with the built-in items', async () => {
    const { target, destroy } = await mountGrid(true)
    await tick()
    const menu = await openContextMenu(target)
    const labels = [...menu.querySelectorAll('.sv-grid-menu-item')].map((b) => b.textContent?.trim())
    expect(labels).toContain('Copy')
    expect(labels).toContain('Paste')
    expect(labels).toContain('Remove row')
    expect(labels).toContain('Remove column')
    destroy()
  })

  it('does not open when contextMenu is omitted (native menu shows)', async () => {
    const { target, destroy } = await mountGrid(undefined)
    await tick()
    const cell = target.querySelector('.sv-grid-cell[data-svgrid-row]') as HTMLElement
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    cell.dispatchEvent(ev)
    await tick()
    expect(target.querySelector('.sv-grid-context-menu')).toBeNull()
    expect(ev.defaultPrevented).toBe(false)
    destroy()
  })

  it('renders only the configured custom items and runs the action', async () => {
    let ran = 0
    const items: ContextMenuItem<Row>[] = [
      'copy',
      'separator',
      { key: 'flag', label: 'Flag row', action: () => { ran += 1 } },
    ]
    const { target, destroy } = await mountGrid(items)
    await tick()
    // Was a bare `await tick()`, which only worked because the case above had
    // already loaded the lazy chunk - running this one alone would have read an
    // empty menu.
    await openContextMenu(target)
    const labels = [...target.querySelectorAll('.sv-grid-context-menu .sv-grid-menu-item')].map((b) =>
      b.textContent?.trim(),
    )
    expect(labels).toEqual(['Copy', 'Flag row'])
    const flag = [...target.querySelectorAll('.sv-grid-context-menu .sv-grid-menu-item')].find(
      (b) => b.textContent?.trim() === 'Flag row',
    ) as HTMLElement
    flag.click()
    expect(ran).toBe(1)
    await tick()
    expect(target.querySelector('.sv-grid-context-menu')).toBeNull()
    destroy()
  })
})
