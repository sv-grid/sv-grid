/**
 * The grid-extension seam: what an opt-in Enterprise module (fields) can add
 * to <SvGrid>, and that a grid with nothing registered draws as before.
 * The registry is module-global, so the "nothing registered" case runs first.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import { registerGridExtension } from './grid-extension.svelte'
import ExtCell from './ext-cell.test.svelte'
import ExtHeaderEnd from './ext-header-end.test.svelte'
import ExtBodyEnd from './ext-body-end.test.svelte'
import ExtOverlay from './ext-overlay.test.svelte'
import ExtGroupRow from './ext-group-row.test.svelte'

type Row = { id: number; name: string; score: number; status: string }
const rows: Row[] = [
  { id: 1, name: 'Ada', score: 4, status: 'Blocked' },
  { id: 2, name: 'Grace', score: 2, status: 'Done' },
]
const columns = [
  { field: 'name', header: 'Name', width: 120 },
  { field: 'score', header: 'Score', width: 100, fieldType: 'probe' },
  { field: 'status', header: 'Status', width: 100, fieldType: 'plainProbe' },
]
const settle = () => new Promise<void>((r) => setTimeout(r))

function mountGrid(extra: Record<string, unknown> = {}) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGrid, {
    target,
    props: {
      data: rows,
      columns,
      getRowId: (r: Row) => String(r.id),
      rowHeight: 32,
      containerHeight: 240,
      virtualization: false,
      columnVirtualization: false,
      showRowSelection: false,
      showRowNumbers: true,
      ...extra,
    } as never,
  })
  return { target, destroy: () => { unmount(app); target.remove() } }
}
const cell = (t: HTMLElement, r: number, col: string) =>
  t.querySelectorAll('tbody tr.sv-grid-row')[r]?.querySelector(`td[data-col-id="${col}"]`) as HTMLElement

describe('grid-extension seam', () => {
  it('with nothing registered, a fieldType column draws as an ordinary one', async () => {
    const g = mountGrid()
    try {
      await settle()
      expect(cell(g.target, 0, 'score').textContent?.trim()).toBe('4')
      expect(g.target.querySelector('.probe-header-end, .probe-body-end, .probe-cell')).toBeNull()
      const tr = g.target.querySelector('tbody tr.sv-grid-row') as HTMLElement
      expect(tr.style.getPropertyValue('--sv-row-mark')).toBe('')
    } finally {
      g.destroy()
    }
  })

  it('draws field cells, the header and body end, and row marks from the extension', async () => {
    registerGridExtension({
      // Only 'probe' has a cell of its own; 'plainProbe' is filled in and drawn by the grid.
      column: (def) => (def.fieldType === 'plainProbe' ? { ...def, align: 'right' } : def),
      cell: ExtCell as never,
      hasCell: (def) => def.fieldType === 'probe',
      headerEnd: ExtHeaderEnd as never,
      bodyEnd: ExtBodyEnd as never,
      rowMarkColor: (_ctrl, row) => ((row as Row).status === 'Blocked' ? '#ef4444' : null),
      rowMarkLabel: (_ctrl, row) => (row as Row).status,
      rootClass: () => 'probe-root',
      headerIcon: (def) => (def.fieldType === 'probe' ? 'M4 4h16v16H4z' : null),
      overlay: (ctrl) => (ctrl.props.showRowNumbers ? (ExtOverlay as never) : null),
      headerNote: (def) => (def.fieldType === 'probe' ? { text: 'How sure we are', icon: 'M12 8h.01' } : null),
      groupRow: (ctrl) => (ctrl.props.showRowNumbers ? (ExtGroupRow as never) : null),
    })
    const g = mountGrid()
    try {
      await settle()
      expect(cell(g.target, 0, 'score').textContent?.trim()).toBe('[4]')
      expect(cell(g.target, 0, 'status').textContent?.trim()).toBe('Blocked')
      expect(cell(g.target, 0, 'status').getAttribute('data-align')).toBe('right')
      // The header-end cell is the last child of the header row.
      const headerRow = g.target.querySelector('thead tr.sv-grid-header-row:not(.sv-grid-group-header-row)')!
      expect(headerRow.lastElementChild?.classList.contains('probe-header-end')).toBe(true)
      // The body-end row comes after the last data row.
      const body = g.target.querySelector('tbody.sv-grid-body')!
      expect(body.lastElementChild?.classList.contains('probe-body-end')).toBe(true)
      // A row mark is a CSS variable on the row, and its label is on the row number.
      const [first, second] = [...g.target.querySelectorAll<HTMLElement>('tbody tr.sv-grid-row:not(.probe-body-end)')]
      expect(first!.style.getPropertyValue('--sv-row-mark')).toBe('#ef4444')
      expect(second!.style.getPropertyValue('--sv-row-mark')).toBe('')
      expect(first!.querySelector('.sv-grid-row-number-cell')?.getAttribute('title')).toBe('Blocked')
      expect(g.target.querySelector('.sv-grid-root')?.classList.contains('probe-root')).toBe(true)
      // The header icon only on the columns the extension gives one.
      const icons = [...g.target.querySelectorAll('thead .sv-grid-header-type-icon path')].map((p) => p.getAttribute('d'))
      expect(icons).toEqual(['M4 4h16v16H4z'])
      // The overlay sits beside the scrolling box, not inside it.
      const overlay = g.target.querySelector('.probe-overlay')!
      expect(overlay.parentElement?.classList.contains('sv-grid-shell')).toBe(true)
      expect(g.target.querySelector('.sv-grid-container .probe-overlay')).toBeNull()
      // A note after the label, read on hover.
      const notes = [...g.target.querySelectorAll('thead .sv-grid-header-note')]
      expect(notes.map((n) => n.getAttribute('title'))).toEqual(['How sure we are'])
      expect(notes[0]!.closest('th')?.getAttribute('data-svgrid-header-col')).toBe('score')
    } finally {
      g.destroy()
    }
    // Grouped: the extension draws each group's content after the grid's toggle.
    const grouped = mountGrid({ groupBy: ['name'] })
    try {
      await settle()
      const groups = [...grouped.target.querySelectorAll('tbody .sv-grid-group-row')]
      expect(groups.map((r) => r.querySelector('.probe-group')?.textContent)).toEqual(['Ada / 1', 'Grace / 1'])
      expect(groups[0]!.querySelector('.sv-grid-group-toggle')).not.toBeNull()
      expect(groups[0]!.querySelector('.sv-grid-group-label')).toBeNull()
    } finally {
      grouped.destroy()
    }
    // The extension decides per grid: null draws nothing.
    const plain = mountGrid({ showRowNumbers: false })
    try {
      await settle()
      expect(plain.target.querySelector('.probe-overlay')).toBeNull()
    } finally {
      plain.destroy()
    }
  })
})
