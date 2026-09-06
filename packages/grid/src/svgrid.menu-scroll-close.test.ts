/**
 * The scroll-close gate for the CELL CONTEXT MENU and the COMMENT EDITOR.
 *
 * Both are positioned from a one-time cursor measurement and rendered
 * `position: fixed`, exactly like the column / filter / operator menus - but
 * both were missing from the effect that closes those on an outside scroll, so
 * after any scroll they floated over unrelated cells.
 *
 * The comment editor is closed by SAVING, not discarding. Backdrop-click and
 * Escape throw the draft away and that is right, because both are the user
 * saying "away with this". A scroll is not a dismissal gesture, so it must not
 * destroy text the user has typed.
 *
 * The sibling file `svgrid.filter-menu-scroll.test.ts` covers the four menus
 * that were already gated, including the must-NOT-close cases.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from './index'
import type { ColumnDef, SvGridApi } from './index'

type Row = { id: number; name: string; team: string }
const features = tableFeatures({ rowSortingFeature })
const rows: Row[] = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  name: `Person ${i + 1}`,
  team: ['A', 'B'][i % 2]!,
}))
const cols: ColumnDef<typeof features, Row>[] = [
  { field: 'name', header: 'Name', width: 200, editorType: 'text' },
  { field: 'team', header: 'Team', width: 160, editorType: 'text' },
]

/** Macrotask boundary - drains the overlay's lazy import() plus its flush. */
const tick = () => new Promise<void>((r) => setTimeout(r))

function mountGrid(extra: Record<string, unknown> = {}) {
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
          containerHeight: 240,
          virtualization: false,
          // `comment` is not one of the default items - ask for it by id so
          // the comment editor is reachable at all.
          contextMenu: ['copy', 'comment'],
          onApiReady(api: SvGridApi<typeof features, Row>) {
            res({ api, target, destroy: () => { unmount(app); target.remove() } })
          },
          ...extra,
        } as any,
      })
      queueMicrotask(() => { if (!target.querySelector('[role="grid"]')) rej(new Error('no grid')) })
    },
  )
}

async function openContextMenu(target: HTMLElement) {
  const cell = target.querySelector('.sv-grid-cell[data-svgrid-row]') as HTMLElement
  const r = cell.getBoundingClientRect()
  cell.dispatchEvent(
    new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.x + 4, clientY: r.y + 4 }),
  )
  await vi.waitFor(() => {
    const menu = target.querySelector('.sv-grid-context-menu')
    expect(menu).not.toBeNull()
    expect(menu!.querySelectorAll('.sv-grid-menu-item').length).toBeGreaterThan(0)
  })
  return target.querySelector('.sv-grid-context-menu') as HTMLElement
}

/** Right-click, then pick "Edit comment" to get the comment popover open. */
async function openCommentEditor(target: HTMLElement) {
  const menu = await openContextMenu(target)
  const item = [...menu.querySelectorAll<HTMLElement>('.sv-grid-menu-item')].find((b) =>
    (b.textContent ?? '').includes('Edit comment'),
  )
  expect(item, 'the "Edit comment" item should be in the configured menu').toBeTruthy()
  item!.click()
  await vi.waitFor(() => {
    expect(target.querySelector('.sv-grid-comment-editor')).not.toBeNull()
  })
  return target.querySelector('.sv-grid-comment-editor') as HTMLElement
}

/** Scroll something that is NOT inside any menu. */
function scrollOutside(target: HTMLElement) {
  const viewport = target.querySelector('.sv-grid-viewport') ?? target
  viewport.dispatchEvent(new Event('scroll'))
}

describe('cell context menu - scroll', () => {
  it('closes when something outside it scrolls', async () => {
    const { target, destroy } = await mountGrid()
    await tick()
    await openContextMenu(target)

    scrollOutside(target)
    await vi.waitFor(() => expect(target.querySelector('.sv-grid-context-menu')).toBeNull())

    destroy()
  })

  it('stays open while the menu itself scrolls', async () => {
    const { target, destroy } = await mountGrid()
    await tick()
    const menu = await openContextMenu(target)

    menu.dispatchEvent(new Event('scroll'))
    await tick()
    expect(target.querySelector('.sv-grid-context-menu')).not.toBeNull()

    destroy()
  })

  it('carries the grid id, so a second grid can tell whose menu it is', async () => {
    const { target, destroy } = await mountGrid()
    await tick()
    const menu = await openContextMenu(target)

    const id = menu.getAttribute('data-svgrid-menu')
    expect(id).toBeTruthy()
    // The same id the grid stamps on its cells, so the two are one grid.
    const cellId = target.querySelector('.sv-grid-cell[id]')?.getAttribute('id')
    expect(cellId).toContain(id!)

    destroy()
  })
})

describe('comment editor - scroll', () => {
  it('closes when something outside it scrolls', async () => {
    const { target, destroy } = await mountGrid()
    await tick()
    await openCommentEditor(target)

    scrollOutside(target)
    await vi.waitFor(() => expect(target.querySelector('.sv-grid-comment-editor')).toBeNull())

    destroy()
  })

  it('SAVES the draft rather than throwing it away', async () => {
    const changes: Array<{ note: string }> = []
    const { target, destroy } = await mountGrid({
      onNoteChange: (e: { note: string }) => changes.push(e),
    })
    await tick()
    const editor = await openCommentEditor(target)

    const textarea = editor.querySelector('textarea') as HTMLTextAreaElement
    textarea.value = 'half-written thought'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await tick()

    scrollOutside(target)
    await vi.waitFor(() => expect(target.querySelector('.sv-grid-comment-editor')).toBeNull())

    expect(changes.map((c) => c.note)).toContain('half-written thought')

    destroy()
  })

  it('still DISCARDS on Escape, which is a real dismissal', async () => {
    const changes: Array<{ note: string }> = []
    const { target, destroy } = await mountGrid({
      onNoteChange: (e: { note: string }) => changes.push(e),
    })
    await tick()
    const editor = await openCommentEditor(target)

    const textarea = editor.querySelector('textarea') as HTMLTextAreaElement
    textarea.value = 'never mind'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await tick()

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => expect(target.querySelector('.sv-grid-comment-editor')).toBeNull())

    expect(changes).toHaveLength(0)

    destroy()
  })
})
