/**
 * Track C: free-text autocomplete cell type + editable cell comments.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import { createCoreRowModel, tableFeatures } from './index'
import type { ColumnDef, SvGridApi } from './index'

type Row = { id: number; name: string; city: string }
const features = tableFeatures({})
const rows: Row[] = [
  { id: 1, name: 'Ann', city: 'Paris' },
  { id: 2, name: 'Bo', city: 'Berlin' },
]
// Macrotask boundary: drains pending microtasks incl. the menu overlay's lazy
// import() + flush, so the context menu is mounted before assertions (GridMenus
// loads lazily as its own chunk the first time a menu/tooltip opens).
const tick = () => new Promise<void>((r) => setTimeout(r))

function mountGrid(extraCols: ColumnDef<typeof features, Row>[], props: Record<string, unknown> = {}) {
  return new Promise<{ api: SvGridApi<typeof features, Row>; target: HTMLElement; destroy: () => void }>(
    (res) => {
      const target = document.createElement('div')
      document.body.appendChild(target)
      const app = mount(SvGrid, {
        target,
        props: {
          data: rows,
          columns: [{ field: 'name', header: 'Name', width: 160, editorType: 'text' }, ...extraCols],
          features,
          _rowModels: { coreRowModel: createCoreRowModel() },
          rowHeight: 32,
          containerHeight: 360,
          virtualization: false,
          enableInlineEditing: true,
          enableCellSelection: true,
          onApiReady(api: SvGridApi<typeof features, Row>) {
            res({ api, target, destroy: () => { unmount(app); target.remove() } })
          },
          ...props,
        } as any,
      })
    },
  )
}

function dataCell(target: HTMLElement, col: number) {
  return target.querySelectorAll('.sv-grid-cell[data-svgrid-row]')[col] as HTMLElement
}

describe('autocomplete cell type', () => {
  it('filters suggestions as you type and commits the picked option', async () => {
    const { api, target, destroy } = await mountGrid([
      {
        field: 'city',
        header: 'City',
        width: 200,
        editorType: 'autocomplete',
        editorOptions: ['Paris', 'Berlin', 'Boston', 'Brussels'],
      },
    ])
    await tick()
    // city is the 2nd column => index 1 in the first row's cells
    const cell = target.querySelectorAll('.sv-grid-cell[data-svgrid-row="0"]')[1] as HTMLElement
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    await tick()
    const input = target.querySelector('.sv-grid-cell-editor-autocomplete') as HTMLInputElement
    expect(input).not.toBeNull()
    input.value = 'B'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await tick()
    const opts = [...target.querySelectorAll('.sv-grid-autocomplete-option')].map((b) => b.textContent?.trim())
    // 'B' matches Berlin, Boston, Brussels - not Paris
    expect(opts).toEqual(['Berlin', 'Boston', 'Brussels'])
    const berlin = [...target.querySelectorAll('.sv-grid-autocomplete-option')].find(
      (b) => b.textContent?.trim() === 'Boston',
    ) as HTMLElement
    berlin.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await tick()
    expect(api.getCellValue(0, 'city')).toBe('Boston')
    destroy()
  })
})

describe('editable comments', () => {
  it('adds a comment via the context menu and emits onNoteChange', async () => {
    const changes: Array<{ rowId: string; columnId: string; note: string }> = []
    const { target, destroy } = await mountGrid(
      [{ field: 'city', header: 'City', width: 200, editorType: 'text' }],
      { contextMenu: true, editableComments: true, onNoteChange: (e: any) => changes.push(e) },
    )
    await tick()
    const cell = dataCell(target, 0)
    cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    // First menu-open triggers GridMenus' lazy import; poll until it mounts.
    await vi.waitFor(() => expect(target.querySelector('.sv-grid-context-menu')).not.toBeNull())
    await tick()
    const editItem = [...target.querySelectorAll('.sv-grid-context-menu .sv-grid-menu-item')].find(
      (b) => b.textContent?.trim() === 'Edit comment',
    ) as HTMLElement
    expect(editItem).toBeTruthy()
    editItem.click()
    await tick()
    const ta = target.querySelector('.sv-grid-comment-textarea') as HTMLTextAreaElement
    expect(ta).not.toBeNull()
    ta.value = 'Needs review'
    ta.dispatchEvent(new Event('input', { bubbles: true }))
    await tick()
    ;(target.querySelector('.sv-grid-comment-save') as HTMLElement).click()
    await tick()
    expect(changes.length).toBe(1)
    expect(changes[0]!.note).toBe('Needs review')
    expect(target.querySelector('.sv-grid-comment-editor')).toBeNull()
    destroy()
  })
})
