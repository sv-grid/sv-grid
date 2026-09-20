/**
 * Detail rows under virtualization: `detailRowHeight` sizes a detail row for
 * the virtualizer, so a master-detail grid no longer needs
 * `virtualization={false}`.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import { createCoreRowModel, tableFeatures } from './index'
import type { ColumnDef, SvGridApi } from './index'

type Row = { id: string; name: string; kind: 'data' | 'detail' }
const features = tableFeatures({})
const cols: ColumnDef<typeof features, Row>[] = [{ field: 'name', header: 'Name', width: 200 }]
const tick = () => new Promise<void>((r) => setTimeout(r))

function rows(): Row[] {
  const out: Row[] = []
  for (let i = 0; i < 12; i += 1) {
    out.push({ id: `r${i}`, name: `row ${i}`, kind: 'data' })
    if (i === 1 || i === 4) out.push({ id: `d${i}`, name: `detail of ${i}`, kind: 'detail' })
  }
  return out
}

function mountGrid(extra: Record<string, unknown>) {
  return new Promise<{ api: SvGridApi<typeof features, Row>; target: HTMLElement; destroy: () => void }>((res, rej) => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(SvGrid, {
      target,
      props: {
        data: rows(),
        columns: cols,
        features,
        _rowModels: { coreRowModel: createCoreRowModel() },
        getRowId: (r: Row) => r.id,
        rowHeight: 30,
        containerHeight: 300,
        virtualization: true,
        isDetailRow: (r: Row) => r.kind === 'detail',
        onApiReady(api: SvGridApi<typeof features, Row>) {
          res({ api, target, destroy: () => { unmount(app); target.remove() } })
        },
        ...extra,
      } as any,
    })
    queueMicrotask(() => { if (!target.querySelector('[role="grid"]')) rej(new Error('no grid')) })
  })
}

describe('detailRowHeight', () => {
  it('sizes detail rows for the virtualizer and leaves the others at rowHeight', async () => {
    const { api, target, destroy } = await mountGrid({ detailRowHeight: 120 })
    try {
      await tick()
      const detail = target.querySelector<HTMLElement>('tr.sv-grid-detail-row')!
      expect(detail.classList.contains('sv-grid-detail-row-sized')).toBe(true)
      expect(detail.style.height).toBe('120px')
      // Index 2 is the detail under row 1; 3 is a plain row.
      expect(api.getRowHeight(2)).toBe(120)
      expect(api.getRowHeight(3)).toBe(30)
    } finally {
      destroy()
    }
  })

  it('takes a function of the row', async () => {
    const { api, destroy } = await mountGrid({ detailRowHeight: (r: Row) => (r.id === 'd1' ? 80 : 200) })
    try {
      await tick()
      expect(api.getRowHeight(2)).toBe(80)
      expect(api.getRowHeight(6)).toBe(200)
    } finally {
      destroy()
    }
  })

  it('without one a detail row is auto height, as before', async () => {
    const { target, destroy } = await mountGrid({ virtualization: false })
    try {
      await tick()
      const detail = target.querySelector<HTMLElement>('tr.sv-grid-detail-row')!
      expect(detail.classList.contains('sv-grid-detail-row-sized')).toBe(false)
      expect(detail.style.height).toBe('')
    } finally {
      destroy()
    }
  })
})

describe('showDetailToggle', () => {
  it('is a row-header column: sticky, no menu, no resize handle, a chevron per data row and none on a detail row', async () => {
    const open = new Set<string>(['r1', 'r4'])
    const toggled: string[] = []
    const { target, destroy } = await mountGrid({
      showDetailToggle: true,
      columnResize: true,
      columnMenu: true,
      onDetailToggle: (r: Row) => toggled.push(r.id),
      isDetailOpen: (r: Row) => open.has(r.id),
      detailRowHeight: 60,
    })
    try {
      await tick()
      const head = target.querySelector<HTMLElement>('thead th.sv-grid-detail-toggle-column')!
      expect(head).not.toBeNull()
      expect(head.getAttribute('aria-hidden')).toBe('true')
      expect(head.querySelector('.sv-grid-col-menu-btn, .sv-grid-column-resizer, [data-resize-handle]')).toBeNull()
      expect(head.style.position || getComputedStyle(head).position).not.toBe('')
      const first = target.querySelector<HTMLElement>('tbody tr.sv-grid-row:not(.sv-grid-detail-row)')!
      const cell = first.querySelector<HTMLElement>('td.sv-grid-detail-toggle-cell')!
      expect(cell).not.toBeNull()
      // The gutter is not a data cell: nothing the keyboard or the selection can land on.
      expect(cell.hasAttribute('data-svgrid-col')).toBe(false)
      const chev = cell.querySelector<HTMLButtonElement>('button.sv-grid-detail-toggle')!
      expect(chev.getAttribute('aria-expanded')).toBe('false')
      expect(chev.getAttribute('aria-label')).toBe('Open details')
      chev.click()
      expect(toggled).toEqual(['r0'])
      // Row 1 is open: its chevron says so; the detail row under it has a blank gutter cell.
      const rowsAll = [...target.querySelectorAll<HTMLElement>('tbody tr.sv-grid-row')]
      const r1 = rowsAll.find((tr) => tr.textContent?.includes('row 1'))!
      expect(r1.querySelector('button.sv-grid-detail-toggle')!.getAttribute('aria-expanded')).toBe('true')
      expect(r1.querySelector('button.sv-grid-detail-toggle')!.getAttribute('aria-label')).toBe('Close details')
      const detail = target.querySelector<HTMLElement>('tr.sv-grid-detail-row')!
      expect(detail.querySelector('button.sv-grid-detail-toggle')).toBeNull()
      // The full-width cell spans the gutter too.
      expect(detail.querySelector<HTMLTableCellElement>('td.sv-grid-detail-cell')!.colSpan).toBe(first.children.length)
    } finally {
      destroy()
    }
  })

  it('leaves the chevron out where hasDetail says no, and sticks after the row numbers and the checkbox', async () => {
    const { target, destroy } = await mountGrid({
      showDetailToggle: true,
      showRowNumbers: true,
      showRowSelection: true,
      onDetailToggle: () => {},
      hasDetail: (r: Row) => r.id !== 'r0',
    })
    try {
      await tick()
      const rowsAll = [...target.querySelectorAll<HTMLElement>('tbody tr.sv-grid-row:not(.sv-grid-detail-row)')]
      expect(rowsAll[0]!.querySelector('td.sv-grid-detail-toggle-cell button')).toBeNull()
      expect(rowsAll[1]!.querySelector('td.sv-grid-detail-toggle-cell button')).not.toBeNull()
      // Row number (56) + selection (44) sit before it.
      const cell = rowsAll[1]!.querySelector<HTMLElement>('td.sv-grid-detail-toggle-cell')!
      expect(cell.style.left).toBe('100px')
      expect(cell.style.width).toBe('36px')
      // The system cells come in that order, then the data.
      const classes = [...rowsAll[1]!.children].map((td) => td.className.split(' ')[1])
      expect(classes.slice(0, 3)).toEqual(['sv-grid-row-number-cell', 'sv-grid-selection-cell', 'sv-grid-detail-toggle-cell'])
    } finally {
      destroy()
    }
  })

  it('on a server row model the seam decides: groups get no chevron, a leaf reads detailOpen and calls toggleDetail', async () => {
    const calls: string[] = []
    const { target, destroy } = await mountGrid({
      showDetailToggle: true,
      serverGroup: {
        isGroup: (r: Row) => r.id === 'r0',
        level: () => 0,
        onToggle: () => {},
        toggleDetail: (r: Row) => calls.push(r.id),
        detailOpen: (r: Row) => r.id === 'r1',
        hasDetail: (r: Row) => r.kind === 'data',
      },
    })
    try {
      await tick()
      const rowsAll = [...target.querySelectorAll<HTMLElement>('tbody tr.sv-grid-row')]
      const r0 = rowsAll.find((tr) => tr.textContent?.includes('row 0'))!
      const r1 = rowsAll.find((tr) => tr.textContent?.includes('row 1'))!
      expect(r0.querySelector('button.sv-grid-detail-toggle')).toBeNull()
      const chev = r1.querySelector<HTMLButtonElement>('button.sv-grid-detail-toggle')!
      expect(chev.getAttribute('aria-expanded')).toBe('true')
      chev.click()
      expect(calls).toEqual(['r1'])
    } finally {
      destroy()
    }
  })
})
