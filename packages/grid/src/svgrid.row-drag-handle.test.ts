/**
 * Where a managed row drag starts. With row numbers the row header is the
 * handle: a press in a data cell (a pinned one too) selects or edits as it
 * does anywhere else. Without row numbers the whole row is the handle. Every
 * row is a drop target either way.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'

const rows = [
  { id: 1, name: 'Ada' },
  { id: 2, name: 'Grace' },
]
const columns = [{ field: 'name', header: 'Name' }]

const mounted: Array<() => void> = []
afterEach(() => {
  while (mounted.length) mounted.pop()!()
})

function mountGrid(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGrid, {
    target,
    props: { data: rows, columns, getRowId: (r: { id: number }) => String(r.id), rowDragManaged: true, containerHeight: 300, virtualization: false, ...props } as any,
  })
  flushSync()
  mounted.push(() => {
    unmount(app)
    target.remove()
  })
  return target
}

describe('managed row drag handle', () => {
  it('is the row header when row numbers show', () => {
    const t = mountGrid({ showRowNumbers: true })
    const tr = t.querySelector('tbody tr.sv-grid-row')!
    expect(tr.getAttribute('draggable')).toBeNull()
    expect(tr.classList.contains('sv-grid-row-drag-by-header')).toBe(true)
    expect(tr.querySelector('.sv-grid-row-number-cell')!.getAttribute('draggable')).toBe('true')
    expect(tr.querySelector('td:not(.sv-grid-row-number-cell)')!.getAttribute('draggable')).toBeNull()
  })

  it('is the whole row without row numbers', () => {
    const t = mountGrid({ showRowNumbers: false })
    const tr = t.querySelector('tbody tr.sv-grid-row')!
    expect(tr.getAttribute('draggable')).toBe('true')
    expect(tr.classList.contains('sv-grid-row-drag-by-header')).toBe(false)
  })
})
