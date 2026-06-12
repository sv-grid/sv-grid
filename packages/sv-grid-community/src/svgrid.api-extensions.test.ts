/**
 * Behavioral tests for the SvGridApi extensions inspired by the jqxGrid API:
 *   - Row selection read/write (getSelectedRows / getSelectedRowIds /
 *     selectRows / selectAllRows / toggleRowSelected)
 *   - Pagination control (getPageInfo / setPage / next/prev/first/last /
 *     setPageSize)
 *   - Navigation (scrollToRow / getActiveCell / setActiveCell)
 *   - View state (getState / setState / refresh)
 *   - Click / double-click / scroll-bottom events
 *
 * They mount the real <SvGrid /> in jsdom and exercise the api object handed
 * back from onApiReady.
 */

import { describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  columnFilteringFeature,
  getGridCellDomId,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
} from './index'
import type { ColumnDef, SvGridApi } from './index'

type Row = { id: number; name: string; team: string; salary: number }

const sampleRows: Row[] = [
  { id: 1, name: 'Ada Lovelace', team: 'Research', salary: 142_000 },
  { id: 2, name: 'Grace Hopper', team: 'Compilers', salary: 158_000 },
  { id: 3, name: 'Alan Turing', team: 'Research', salary: 138_000 },
  { id: 4, name: 'Margaret Hamilton', team: 'Apollo', salary: 165_000 },
  { id: 5, name: 'Linus Torvalds', team: 'Kernel', salary: 175_000 },
]

const sampleColumns: ColumnDef<any, Row>[] = [
  { field: 'name', header: 'Name', width: 200 },
  { field: 'team', header: 'Team', width: 160 },
  { field: 'salary', header: 'Salary', width: 140 },
]

// One microtask is enough for the grid's derived state (gridStateVersion) to
// re-run after an imperative mutation - mirrors the existing api test.
const flush = () => Promise.resolve()

function mountGrid(
  extraProps: Record<string, unknown> = {},
  features: any = tableFeatures({
    columnFilteringFeature,
    rowSortingFeature,
    rowSelectionFeature,
  }),
): Promise<{ api: SvGridApi<any, Row>; target: HTMLElement; destroy: () => void }> {
  return new Promise((resolveApi, rejectApi) => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    let captured: SvGridApi<any, Row> | null = null
    const app = mount(SvGrid, {
      target,
      props: {
        data: sampleRows,
        columns: sampleColumns,
        features,
        rowHeight: 36,
        containerHeight: 480,
        virtualization: false,
        onApiReady(api: SvGridApi<any, Row>) {
          captured = api
          resolveApi({
            api,
            target,
            destroy: () => {
              unmount(app)
              target.remove()
            },
          })
        },
        ...extraProps,
      } as any,
    })
    queueMicrotask(() => {
      if (!captured) rejectApi(new Error('onApiReady never fired'))
    })
  })
}

describe('SvGridApi - row selection', () => {
  it('selectAllRows selects every row; getSelectedRows / Ids reflect it', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.selectAllRows()
      await flush()
      expect(api.getSelectedRows().length).toBe(5)
      expect(api.getSelectedRowIds().length).toBe(5)
    } finally {
      destroy()
    }
  })

  it('selectRows replaces the selection by default and adds with additive', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.selectAllRows()
      await flush()
      const ids = api.getSelectedRowIds()
      expect(ids.length).toBe(5)

      api.selectRows([ids[0]!])
      await flush()
      expect(api.getSelectedRowIds()).toEqual([ids[0]!])

      api.selectRows([ids[1]!], true)
      await flush()
      expect(new Set(api.getSelectedRowIds())).toEqual(new Set([ids[0]!, ids[1]!]))
    } finally {
      destroy()
    }
  })

  it('toggleRowSelected flips one row; clearRowSelection wipes all', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.selectAllRows()
      await flush()
      const id = api.getSelectedRowIds()[0]!
      api.toggleRowSelected(id)
      await flush()
      expect(api.getSelectedRowIds()).not.toContain(id)

      api.clearRowSelection()
      await flush()
      expect(api.getSelectedRowIds().length).toBe(0)
    } finally {
      destroy()
    }
  })
})

describe('SvGridApi - pagination', () => {
  const paged = () =>
    mountGrid(
      { showPagination: true, pageSize: 2 },
      tableFeatures({ rowPaginationFeature }),
    )

  it('getPageInfo derives pageCount from the filtered total', async () => {
    const { api, destroy } = await paged()
    try {
      const info = api.getPageInfo()
      expect(info.total).toBe(5)
      expect(info.pageSize).toBe(2)
      expect(info.pageCount).toBe(3) // ceil(5 / 2)
      expect(info.pageIndex).toBe(0)
    } finally {
      destroy()
    }
  })

  it('setPage clamps to [0, pageCount - 1]', async () => {
    const { api, destroy } = await paged()
    try {
      api.setPage(99)
      await flush()
      expect(api.getPageInfo().pageIndex).toBe(2)
      api.setPage(-5)
      await flush()
      expect(api.getPageInfo().pageIndex).toBe(0)
    } finally {
      destroy()
    }
  })

  it('next/prev/first/last move through the pages', async () => {
    const { api, destroy } = await paged()
    try {
      api.nextPage()
      await flush()
      expect(api.getPageInfo().pageIndex).toBe(1)
      api.lastPage()
      await flush()
      expect(api.getPageInfo().pageIndex).toBe(2)
      api.prevPage()
      await flush()
      expect(api.getPageInfo().pageIndex).toBe(1)
      api.firstPage()
      await flush()
      expect(api.getPageInfo().pageIndex).toBe(0)
    } finally {
      destroy()
    }
  })

  it('setPageSize updates the page size and recomputes pageCount', async () => {
    const { api, destroy } = await paged()
    try {
      api.setPageSize(5)
      await flush()
      const info = api.getPageInfo()
      expect(info.pageSize).toBe(5)
      expect(info.pageCount).toBe(1)
    } finally {
      destroy()
    }
  })
})

describe('SvGridApi - navigation', () => {
  it('setActiveCell + getActiveCell round-trip with the column id', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.setActiveCell(2, 1)
      await flush()
      expect(api.getActiveCell()).toEqual({
        rowIndex: 2,
        colIndex: 1,
        columnId: 'team',
      })
    } finally {
      destroy()
    }
  })

  it('setActiveCell clamps out-of-range coordinates', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.setActiveCell(999, 999)
      await flush()
      const cell = api.getActiveCell()
      expect(cell?.rowIndex).toBe(4) // last row
      expect(cell?.colIndex).toBe(2) // last column
    } finally {
      destroy()
    }
  })

  it('scrollToRow does not throw for valid or out-of-range indices', async () => {
    const { api, destroy } = await mountGrid()
    try {
      expect(() => api.scrollToRow(3)).not.toThrow()
      expect(() => api.scrollToRow(9999)).not.toThrow()
    } finally {
      destroy()
    }
  })
})

describe('SvGridApi - view state (getState / setState)', () => {
  it('getState captures sort + filters; setState restores them', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.setSort('salary', 'desc')
      api.setFilter('team', { operator: 'equals', value: 'Research' })
      await flush()

      const snapshot = api.getState()
      expect(snapshot.sorting).toEqual([{ id: 'salary', desc: true }])
      expect(snapshot.columnFilters.team).toEqual({
        operator: 'equals',
        value: 'Research',
      })

      // Wipe, then restore from the snapshot.
      api.clearSort()
      api.clearAllFilters()
      await flush()
      expect(api.getState().sorting).toEqual([])
      expect(api.getFilters()).toEqual({})

      api.setState(snapshot)
      await flush()
      expect(api.getState().sorting).toEqual([{ id: 'salary', desc: true }])
      expect(api.getFilters().team).toEqual({
        operator: 'equals',
        value: 'Research',
      })
    } finally {
      destroy()
    }
  })

  it('setState restores column width + visibility', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.setState({ columnWidths: { name: 320 }, hiddenColumns: ['team'] })
      await flush()
      expect(api.getColumnWidths().name).toBe(320)
      expect(api.isColumnVisible('team')).toBe(false)
      expect(api.getState().hiddenColumns).toContain('team')
    } finally {
      destroy()
    }
  })

  it('partial setState only touches the keys present', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.setSort('name', 'asc')
      await flush()
      // Restoring only filters must not clear the existing sort.
      api.setState({ globalFilter: '' })
      await flush()
      expect(api.getState().sorting).toEqual([{ id: 'name', desc: false }])
    } finally {
      destroy()
    }
  })
})

describe('SvGridApi - click / double-click / scroll events', () => {
  function clickCell(_target: HTMLElement, rowIndex: number, colIndex: number, type: 'click' | 'dblclick') {
    const id = getGridCellDomId('svgrid', rowIndex, colIndex)
    const el = document.getElementById(id)
    if (!el) throw new Error(`cell ${id} not found`)
    el.dispatchEvent(new MouseEvent(type, { bubbles: true }))
  }

  it('onCellClick + onRowClick fire with the expected payload', async () => {
    const cellEvents: any[] = []
    const rowEvents: any[] = []
    const { target, destroy } = await mountGrid({
      onCellClick: (e: unknown) => cellEvents.push(e),
      onRowClick: (e: unknown) => rowEvents.push(e),
    })
    try {
      clickCell(target, 0, 0, 'click')
      await flush()
      expect(cellEvents.length).toBe(1)
      expect(cellEvents[0]).toMatchObject({
        rowIndex: 0,
        colIndex: 0,
        columnId: 'name',
        value: 'Ada Lovelace',
      })
      expect((cellEvents[0].row as Row).id).toBe(1)
      expect(rowEvents.length).toBe(1)
      expect(rowEvents[0]).toMatchObject({ rowIndex: 0, columnId: 'name' })
    } finally {
      destroy()
    }
  })

  it('onCellDoubleClick + onRowDoubleClick fire on dblclick', async () => {
    const cellEvents: any[] = []
    const rowEvents: any[] = []
    const { target, destroy } = await mountGrid({
      enableInlineEditing: false,
      onCellDoubleClick: (e: unknown) => cellEvents.push(e),
      onRowDoubleClick: (e: unknown) => rowEvents.push(e),
    })
    try {
      clickCell(target, 1, 1, 'dblclick')
      await flush()
      expect(cellEvents.length).toBe(1)
      expect(cellEvents[0]).toMatchObject({ rowIndex: 1, colIndex: 1, columnId: 'team' })
      expect(rowEvents.length).toBe(1)
    } finally {
      destroy()
    }
  })
})
