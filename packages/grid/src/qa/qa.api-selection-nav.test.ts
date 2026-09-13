/**
 * QA sweep: selection (rows + cell ranges), the active cell, scrolling,
 * pagination and the find overlay.
 */
import { describe, expect, it, vi } from 'vitest'
import { cellAt, flush, mountQaGrid, qaGetRowId, qaRows } from './harness.svelte'
import type { QaRow } from './harness.svelte'

const manyRows: QaRow[] = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1,
  name: `Person ${i + 1}`,
  team: i % 2 === 0 ? 'Research' : 'Kernel',
  salary: 100_000 + i * 1_000,
  active: i % 3 === 0,
}))

describe('QA: api row selection', () => {
  it('selectAllRows selects every row; getSelectedRows / Ids agree', async () => {
    const { api } = await mountQaGrid()
    api.selectAllRows()
    await flush()
    expect(api.getSelectedRows().map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6])
    expect(api.getSelectedRowIds().length).toBe(6)
  })

  it('selectRows replaces by default and appends with additive:true', async () => {
    const { api } = await mountQaGrid({ getRowId: qaGetRowId })
    api.selectRows(['r2', 'r3'])
    await flush()
    expect(api.getSelectedRowIds()).toEqual(['r2', 'r3'])

    api.selectRows(['r5'])
    await flush()
    expect(api.getSelectedRowIds()).toEqual(['r5'])

    api.selectRows(['r1'], true)
    await flush()
    expect(new Set(api.getSelectedRowIds())).toEqual(new Set(['r1', 'r5']))
  })

  it('toggleRowSelected flips one row', async () => {
    const { api } = await mountQaGrid({ getRowId: qaGetRowId })
    api.toggleRowSelected('r2')
    await flush()
    expect(api.getSelectedRowIds()).toEqual(['r2'])
    api.toggleRowSelected('r2')
    await flush()
    expect(api.getSelectedRowIds()).toEqual([])
  })

  it('clearRowSelection wipes the selection and emits the empty payload', async () => {
    const onRowSelectionChange = vi.fn()
    const { api } = await mountQaGrid({ getRowId: qaGetRowId, onRowSelectionChange })
    api.selectAllRows()
    await flush()
    onRowSelectionChange.mockClear()

    api.clearRowSelection()
    await flush()
    expect(api.getSelectedRows()).toEqual([])
    expect(onRowSelectionChange).toHaveBeenCalledWith({}, [])
  })

  it('onRowSelectionChange reports the selection map and the materialised rows', async () => {
    const onRowSelectionChange = vi.fn()
    const { api } = await mountQaGrid({ getRowId: qaGetRowId, onRowSelectionChange })
    api.selectRows(['r1', 'r4'])
    await flush()
    const [map, rows] = onRowSelectionChange.mock.calls.at(-1)!
    expect(map).toEqual({ r1: true, r4: true })
    expect((rows as QaRow[]).map((r) => r.id)).toEqual([1, 4])
  })

  it('a click on the checkbox column selects that row', async () => {
    const { api, target } = await mountQaGrid({ showRowSelection: true })
    const box = target.querySelector<HTMLElement>('tbody button.sv-grid-checkbox')
    expect(box).not.toBeNull()
    box!.click()
    await flush()
    expect(api.getSelectedRows().length).toBe(1)
  })

  it('selection survives a sort, because ids are row-model keys', async () => {
    const { api } = await mountQaGrid({ getRowId: qaGetRowId })
    api.selectRows(['r1'])
    await flush()
    api.setSort('salary', 'desc')
    await flush()
    expect(api.getSelectedRows().map((r) => r.id)).toEqual([1])
  })
})

describe('QA: api.selectCells / getSelected', () => {
  it('selects one rectangle and reports it back in the same shape', async () => {
    const { api } = await mountQaGrid({ enableCellSelection: true })
    api.selectCells([[0, 0, 1, 1]])
    await flush()
    expect(api.getSelected()).toEqual([[0, 0, 1, 1]])
  })

  it('normalises a reversed rectangle and clamps out-of-range coordinates', async () => {
    const { api } = await mountQaGrid({ enableCellSelection: true })
    api.selectCells([[2, 2, 1, 1]])
    await flush()
    expect(api.getSelected()).toEqual([[1, 1, 2, 2]])

    api.selectCells([[0, 0, Infinity, Infinity]])
    await flush()
    expect(api.getSelected()).toEqual([[0, 0, qaRows.length - 1, 3]])
  })

  it('moves the active cell to the range start corner', async () => {
    const { api } = await mountQaGrid({ enableCellSelection: true })
    api.selectCells([[2, 1, 3, 2]])
    await flush()
    expect(api.getActiveCell()).toEqual({ rowIndex: 2, colIndex: 1, columnId: 'team' })
  })

  it('an empty array clears the selection', async () => {
    const { api } = await mountQaGrid({ enableCellSelection: true })
    api.selectCells([[0, 0, 1, 1]])
    await flush()
    api.selectCells([])
    await flush()
    expect(api.getSelected()).toEqual([])
  })

  it('keeps every rectangle when several are passed', async () => {
    const { api } = await mountQaGrid({ enableCellSelection: true })
    api.selectCells([
      [0, 0, 0, 0],
      [2, 1, 3, 2],
    ])
    await flush()
    expect(api.getSelected()).toEqual([
      [0, 0, 0, 0],
      [2, 1, 3, 2],
    ])
  })

  it('marks the selected cells in the DOM', async () => {
    const { api, target } = await mountQaGrid({ enableCellSelection: true })
    api.selectCells([[0, 0, 1, 1]])
    await flush()
    expect(target.querySelectorAll('td[data-selected-range="true"]').length).toBe(4)
  })

  it('fires onCellSelectionChange with the rectangles', async () => {
    const onCellSelectionChange = vi.fn()
    const { api } = await mountQaGrid({ enableCellSelection: true, onCellSelectionChange })
    api.selectCells([[0, 0, 1, 1]])
    await flush()
    expect(onCellSelectionChange).toHaveBeenCalledWith([[0, 0, 1, 1]])
  })
})

describe('QA: api.getActiveCell / setActiveCell / scrollToRow', () => {
  it('getActiveCell is null until something is focused', async () => {
    // The grid seeds its internal active cell to (0,0) at mount so keyboard
    // navigation has somewhere to start. That seed is not a focus, and the
    // documented contract is "null when nothing is focused".
    const { api } = await mountQaGrid()
    expect(api.getActiveCell()).toBeNull()
  })

  it('getActiveCell reports a cell after a click', async () => {
    const { api, target } = await mountQaGrid()
    cellAt(target, 2, 1)!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    await flush()
    expect(api.getActiveCell()).toEqual({ rowIndex: 2, colIndex: 1, columnId: 'team' })
  })

  it('setActiveCell moves the active cell and clamps to the grid bounds', async () => {
    const { api } = await mountQaGrid()
    api.setActiveCell(1, 2)
    await flush()
    expect(api.getActiveCell()).toEqual({ rowIndex: 1, colIndex: 2, columnId: 'salary' })

    api.setActiveCell(999, 999)
    await flush()
    expect(api.getActiveCell()).toEqual({
      rowIndex: qaRows.length - 1,
      colIndex: 3,
      columnId: 'active',
    })

    api.setActiveCell(-5, -5)
    await flush()
    expect(api.getActiveCell()).toEqual({ rowIndex: 0, colIndex: 0, columnId: 'name' })
  })

  it('the active cell is marked in the DOM', async () => {
    const { api, target } = await mountQaGrid()
    api.setActiveCell(1, 1)
    await flush()
    expect(cellAt(target, 1, 1)?.classList.contains('sv-grid-cell-active')).toBe(true)
  })

  it('fires onActiveCellChange on every move', async () => {
    const onActiveCellChange = vi.fn()
    const { api } = await mountQaGrid({ onActiveCellChange })
    api.setActiveCell(0, 0)
    await flush()
    api.setActiveCell(1, 0)
    await flush()
    expect(onActiveCellChange.mock.calls.map((c) => c[0])).toEqual([
      { rowIndex: 0, colIndex: 0, columnId: 'name' },
      { rowIndex: 1, colIndex: 0, columnId: 'name' },
    ])
  })

  it('scrollToRow scrolls the body and clamps to the row count', async () => {
    const { api, target } = await mountQaGrid({ virtualization: true, rowHeight: 30 }, manyRows)
    const body = target.querySelector<HTMLElement>('.sv-grid-container')
    expect(body).not.toBeNull()

    api.scrollToRow(10)
    await flush()
    expect(body!.scrollTop).toBe(300)

    api.scrollToRow(9_999)
    await flush()
    expect(body!.scrollTop).toBe((manyRows.length - 1) * 30)

    api.scrollToRow(-5)
    await flush()
    expect(body!.scrollTop).toBe(0)
  })
})

describe('QA: api pagination', () => {
  it('getPageInfo derives pageCount from the filtered total', async () => {
    const { api } = await mountQaGrid({ showPagination: true, pageSize: 10 }, manyRows)
    expect(api.getPageInfo()).toEqual({
      pageIndex: 0,
      pageSize: 10,
      pageCount: 4,
      total: 40,
    })

    api.setFilter('team', { operator: 'equals', value: 'Kernel' })
    await flush()
    expect(api.getPageInfo()).toMatchObject({ pageCount: 2, total: 20 })
  })

  it('getDisplayedRows returns just the current page', async () => {
    const { api } = await mountQaGrid({ showPagination: true, pageSize: 10 }, manyRows)
    expect(api.getDisplayedRows().map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    api.nextPage()
    await flush()
    expect(api.getDisplayedRows().map((r) => r.id)).toEqual([
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ])
  })

  it('setPage clamps to [0, pageCount - 1]', async () => {
    const { api } = await mountQaGrid({ showPagination: true, pageSize: 10 }, manyRows)
    api.setPage(2)
    await flush()
    expect(api.getPageInfo().pageIndex).toBe(2)

    api.setPage(99)
    await flush()
    expect(api.getPageInfo().pageIndex).toBe(3)

    api.setPage(-3)
    await flush()
    expect(api.getPageInfo().pageIndex).toBe(0)
  })

  it('next / prev / first / last walk the pages and stop at the ends', async () => {
    const { api } = await mountQaGrid({ showPagination: true, pageSize: 10 }, manyRows)
    api.nextPage()
    await flush()
    expect(api.getPageInfo().pageIndex).toBe(1)

    api.prevPage()
    await flush()
    expect(api.getPageInfo().pageIndex).toBe(0)

    api.prevPage()
    await flush()
    expect(api.getPageInfo().pageIndex).toBe(0)

    api.lastPage()
    await flush()
    expect(api.getPageInfo().pageIndex).toBe(3)

    api.nextPage()
    await flush()
    expect(api.getPageInfo().pageIndex).toBe(3)

    api.firstPage()
    await flush()
    expect(api.getPageInfo().pageIndex).toBe(0)
  })

  it('setPageSize changes the page size and keeps the first visible row in view', async () => {
    const { api } = await mountQaGrid({ showPagination: true, pageSize: 10 }, manyRows)
    api.setPage(2)
    await flush()
    api.setPageSize(5)
    await flush()
    const info = api.getPageInfo()
    expect(info.pageSize).toBe(5)
    expect(info.pageCount).toBe(8)
    // Row 21 was the first visible row on page 2 of 10; it must still show.
    expect(api.getDisplayedRows()[0]!.id).toBe(21)
  })

  it('setPageSize floors fractions and never goes below one row', async () => {
    const { api } = await mountQaGrid({ showPagination: true, pageSize: 10 }, manyRows)
    api.setPageSize(7.9)
    await flush()
    expect(api.getPageInfo().pageSize).toBe(7)

    api.setPageSize(0)
    await flush()
    expect(api.getPageInfo().pageSize).toBe(1)
  })

  it('does not fire onPaginationChange for local pagination', async () => {
    // Documented as the `externalPagination` hook only: local paging is the
    // grid's own state, so a consumer that re-fetches on this callback would
    // fetch on every local page turn.
    const onPaginationChange = vi.fn()
    const { api } = await mountQaGrid(
      { showPagination: true, pageSize: 10, onPaginationChange },
      manyRows,
    )
    api.setPage(1)
    await flush()
    expect(onPaginationChange).not.toHaveBeenCalled()
  })

  it('fires onPaginationChange under externalPagination instead of slicing', async () => {
    const onPaginationChange = vi.fn()
    const page = manyRows.slice(0, 10)
    const { target } = await mountQaGrid(
      {
        showPagination: true,
        externalPagination: true,
        pageSize: 10,
        pageIndex: 0,
        rowCount: 40,
        onPaginationChange,
      },
      page,
    )
    const next = [...target.querySelectorAll<HTMLButtonElement>('.sv-grid-pagination-btn')].find(
      (b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').toLowerCase().includes('next'),
    )
    expect(next).toBeDefined()
    next!.click()
    await flush()
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 1, pageSize: 10 })
  })
})

describe('QA: api find overlay', () => {
  it('openFind shows the overlay; closeFind hides it and clears the query', async () => {
    const { api, target } = await mountQaGrid()
    api.openFind()
    await flush()
    expect(target.querySelector('.sv-grid-find')).not.toBeNull()

    api.setFindQuery('Ada')
    await flush()
    expect(api.getFindHits().length).toBe(1)

    api.closeFind()
    await flush()
    expect(target.querySelector('.sv-grid-find')).toBeNull()
    expect(api.getFindHits()).toEqual([])
  })

  it('getFindHits reports every matching cell with its coordinates', async () => {
    const { api } = await mountQaGrid()
    api.openFind()
    api.setFindQuery('Research')
    await flush()
    expect(api.getFindHits()).toEqual([
      { rowIndex: 0, colIndex: 1, columnId: 'team' },
      { rowIndex: 2, colIndex: 1, columnId: 'team' },
      { rowIndex: 5, colIndex: 1, columnId: 'team' },
    ])
  })

  it('getFindHits is empty while the overlay is closed', async () => {
    const { api } = await mountQaGrid()
    api.setFindQuery('Research')
    await flush()
    expect(api.getFindHits()).toEqual([])
  })

  it('hands back a copy of the hit list', async () => {
    const { api } = await mountQaGrid()
    api.openFind()
    api.setFindQuery('Research')
    await flush()
    const hits = api.getFindHits()
    hits.length = 0
    expect(api.getFindHits().length).toBe(3)
  })
})
