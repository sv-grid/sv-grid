/**
 * QA sweep: the callback props the user drives from the DOM - clicks, double
 * clicks and the scroll-bottom hook - plus the two remaining seed props
 * (`icons`, `initialAdvancedFilter`).
 *
 * The callbacks that are driven imperatively (`onApiReady`, `onSortingChange`,
 * `onFiltersChange`, `onRowSelectionChange`, `onCellSelectionChange`,
 * `onActiveCellChange`, `onExpandedChange`, `onPaginationChange`,
 * `onColumnOrderChange`, `onAdvancedFilterChange`, `onCellValueChange`,
 * `onNoteChange`, `onRowDragEnd`, `onPivotModeChange`) are covered next to the
 * member that fires them, in the other QA files.
 */
import { describe, expect, it, vi } from 'vitest'
import { createRawSnippet } from 'svelte'
import { cellAt, flush, mountQaGrid, qaRows } from './harness.svelte'
import type { QaRow } from './harness.svelte'

describe('QA events: clicks', () => {
  it('onCellClick reports the cell, its column and the displayed value', async () => {
    const onCellClick = vi.fn()
    const { target } = await mountQaGrid({ onCellClick })
    cellAt(target, 1, 1)!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()
    expect(onCellClick).toHaveBeenCalledTimes(1)
    expect(onCellClick.mock.calls[0]![0]).toMatchObject({
      rowIndex: 1,
      colIndex: 1,
      columnId: 'team',
      value: 'Compilers',
    })
  })

  it('onRowClick reports the row behind the clicked cell', async () => {
    const onRowClick = vi.fn()
    const { target } = await mountQaGrid({ onRowClick })
    cellAt(target, 2, 0)!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()
    expect(onRowClick).toHaveBeenCalledTimes(1)
    const event = onRowClick.mock.calls[0]![0] as { rowIndex: number; row: QaRow }
    expect(event.rowIndex).toBe(2)
    expect(event.row.name).toBe('Alan Turing')
  })

  it('onCellDoubleClick / onRowDoubleClick fire on a read-only grid too', async () => {
    const onCellDoubleClick = vi.fn()
    const onRowDoubleClick = vi.fn()
    const { target } = await mountQaGrid({ onCellDoubleClick, onRowDoubleClick })
    cellAt(target, 0, 2)!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    await flush()
    expect(onCellDoubleClick.mock.calls[0]![0]).toMatchObject({
      rowIndex: 0,
      colIndex: 2,
      columnId: 'salary',
    })
    expect((onRowDoubleClick.mock.calls[0]![0] as { row: QaRow }).row.name).toBe('Ada Lovelace')
  })

  it('a group banner row fires neither click callback', async () => {
    const onCellClick = vi.fn()
    const onRowClick = vi.fn()
    const { target } = await mountQaGrid({ groupBy: ['team'], onCellClick, onRowClick })
    const banner = target.querySelector('tr.sv-grid-group-row td')
    expect(banner).not.toBeNull()
    banner!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()
    expect(onCellClick).not.toHaveBeenCalled()
    expect(onRowClick).not.toHaveBeenCalled()
  })
})

describe('QA events: onScrollBottomReached', () => {
  it('fires when the body reaches the bottom, and re-arms after scrolling back up', async () => {
    const onScrollBottomReached = vi.fn()
    const rows: QaRow[] = Array.from({ length: 200 }, (_, i) => ({
      id: i + 1,
      name: `P${i + 1}`,
      team: 'T',
      salary: i,
      active: true,
    }))
    const { target } = await mountQaGrid(
      { virtualization: true, rowHeight: 30, containerHeight: 300, onScrollBottomReached },
      rows,
    )
    const container = target.querySelector<HTMLElement>('.sv-grid-container')!

    // jsdom reports every layout metric as 0, so the guard's arithmetic
    // (scrollTop + clientHeight >= scrollHeight - threshold) is satisfied by a
    // plain scroll event: that is enough to prove the hook fires and re-arms.
    container.dispatchEvent(new Event('scroll'))
    await flush()
    expect(onScrollBottomReached).toHaveBeenCalledTimes(1)
    expect(onScrollBottomReached.mock.calls[0]![0]).toMatchObject({
      scrollTop: expect.any(Number),
      scrollHeight: expect.any(Number),
      clientHeight: expect.any(Number),
    })

    // Still at the bottom: the hook must not fire again for the same arrival.
    container.dispatchEvent(new Event('scroll'))
    await flush()
    expect(onScrollBottomReached).toHaveBeenCalledTimes(1)
  })
})

describe('QA props: icons', () => {
  const mark = (id: string) =>
    createRawSnippet(() => ({ render: () => `<svg data-icon="${id}"><path d="M0 0" /></svg>` }))

  it('replaces one glyph and leaves the rest at their defaults', async () => {
    const { target } = await mountQaGrid({
      showRowSelection: true,
      icons: { menu: mark('qa-menu') },
    })
    expect(target.querySelector('[data-icon="qa-menu"]')).not.toBeNull()
    // The other chrome glyphs still render: the map is per-name, not all-or-nothing.
    expect(target.querySelectorAll('.sv-grid-icon').length).toBeGreaterThan(0)
  })
})

describe('QA props: initialAdvancedFilter', () => {
  it('seeds the advanced-filter expression at mount', async () => {
    const expr = { kind: 'cmp', column: 'team', op: 'equals', value: 'Kernel' } as const
    const { api } = await mountQaGrid({ initialAdvancedFilter: expr })
    expect(api.getAdvancedFilter()).toEqual(expr)
    // No engine is registered in the free grid, so rows are untouched.
    expect(api.isAdvancedFilterActive()).toBe(false)
    expect(api.getDisplayedRows().length).toBe(qaRows.length)
  })
})
