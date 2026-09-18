/**
 * The four seams a server-backed row model plugs into, all free:
 *
 *   - `onVisibleRangeChange` - which rows are on screen, by index
 *   - `rowPlaceholder` / `onRetryRow` - rows whose data has not arrived
 *   - `rowSelectionModel` - selection the grid does not own
 *
 * They are deliberately generic: none of them mentions groups, blocks or a
 * datasource, so the free infinite controller and the Enterprise row model
 * plug into the same four holes, and an app with its own fetching can too.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  createCoreRowModel,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
} from './index'
import type { ColumnDef, SvGridApi } from './index'

type Row = { id: number; name: string }
const features = tableFeatures({ rowSortingFeature, rowSelectionFeature })
const cols: ColumnDef<typeof features, Row>[] = [
  { field: 'name', header: 'Name', width: 160 },
  { field: 'id', header: 'Id', width: 80 },
]

const tick = () => new Promise<void>((r) => setTimeout(r))
const rowsOf = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: i, name: `Row ${i}` }))

function mountGrid(extra: Record<string, unknown>, data: Row[] = rowsOf(5)) {
  return new Promise<{
    api: SvGridApi<typeof features, Row>
    target: HTMLElement
    destroy: () => void
  }>((res, rej) => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(SvGrid, {
      target,
      props: {
        data,
        columns: cols,
        features,
        _rowModels: { coreRowModel: createCoreRowModel() },
        getRowId: (r: Row) => String(r.id),
        containerHeight: 200,
        virtualization: false,
        onApiReady(api: SvGridApi<typeof features, Row>) {
          res({ api, target, destroy: () => { unmount(app); target.remove() } })
        },
        ...extra,
      } as any,
    })
    queueMicrotask(() => {
      if (!target.querySelector('[role="grid"]')) rej(new Error('no grid'))
    })
  })
}

describe('onVisibleRangeChange', () => {
  it('reports the whole list when virtualization is off', async () => {
    const seen: Array<{ startIndex: number; endIndex: number }> = []
    const { destroy } = await mountGrid({ onVisibleRangeChange: (r: any) => seen.push(r) }, rowsOf(5))
    await tick()

    expect(seen.at(-1)).toEqual({ startIndex: 0, endIndex: 4 })
    destroy()
  })

  it('reports row indices, not pixels, when virtualization is on', async () => {
    const seen: Array<{ startIndex: number; endIndex: number }> = []
    const { destroy } = await mountGrid(
      {
        onVisibleRangeChange: (r: any) => seen.push(r),
        virtualization: true,
        containerHeight: 200,
      },
      rowsOf(10_000),
    )
    await tick()

    const last = seen.at(-1)!
    expect(last.startIndex).toBe(0)
    // A 200px viewport cannot be showing ten thousand rows, and the numbers
    // are row indices - if these were the pixel offsets the old deriveds
    // carry, endIndex would be in the hundreds.
    expect(last.endIndex).toBeGreaterThan(0)
    expect(last.endIndex).toBeLessThan(200)
    destroy()
  })

  it('does not fire again while the range is unchanged', async () => {
    const seen: Array<unknown> = []
    const { api, destroy } = await mountGrid({ onVisibleRangeChange: (r: any) => seen.push(r) })
    await tick()
    const count = seen.length

    // Something unrelated changes; the visible rows do not.
    api.selectRows(['1'])
    await tick()
    expect(seen).toHaveLength(count)
    destroy()
  })
})

describe('rowPlaceholder', () => {
  it('draws a skeleton cell per column for a loading row', async () => {
    const { target, destroy } = await mountGrid({
      rowPlaceholder: (row: Row) => (row.id === 2 ? 'loading' : null),
    })
    await tick()

    const placeholder = target.querySelector('.sv-grid-placeholder-row')!
    expect(placeholder).not.toBeNull()
    expect(placeholder.getAttribute('aria-busy')).toBe('true')
    // One shimmer per real column, so the table keeps its shape.
    expect(placeholder.querySelectorAll('.sv-grid-placeholder-skeleton')).toHaveLength(cols.length)
    // And the rows around it are untouched.
    expect(target.querySelectorAll('.sv-grid-placeholder-row')).toHaveLength(1)
    destroy()
  })

  it('draws one full-width message with a Retry button for a failed row', async () => {
    const retried: Array<{ row: Row; index: number }> = []
    const { target, destroy } = await mountGrid({
      rowPlaceholder: (row: Row) => (row.id === 3 ? 'failed' : null),
      onRetryRow: (row: Row, index: number) => retried.push({ row, index }),
    })
    await tick()

    const failed = target.querySelector('.sv-grid-placeholder-failed')!
    expect(failed).not.toBeNull()
    expect(failed.textContent).toContain('Could not load')
    expect(failed.querySelectorAll('.sv-grid-placeholder-skeleton')).toHaveLength(0)

    const retry = failed.querySelector<HTMLButtonElement>('.sv-grid-placeholder-retry')!
    retry.click()
    expect(retried).toHaveLength(1)
    expect(retried[0]!.row.id).toBe(3)
    expect(retried[0]!.index).toBe(3)
    destroy()
  })

  it('gives a run of failed rows one message, and a band under it', async () => {
    // A failed block is claimed row by row; the message and Retry sit on
    // the first row of the run, the rest are the same tint with nothing
    // to read, so a hundred-row block is not a hundred red lines.
    const { target, destroy } = await mountGrid(
      {
        rowPlaceholder: (row: Row) => (row.id >= 2 && row.id <= 4 ? 'failed' : null),
        onRetryRow: () => {},
      },
      rowsOf(7),
    )
    await tick()
    const failed = [...target.querySelectorAll('.sv-grid-placeholder-failed')]
    expect(failed).toHaveLength(3)
    expect(failed.map((r) => r.classList.contains('sv-grid-placeholder-failed-cont'))).toEqual([false, true, true])
    expect(target.querySelectorAll('.sv-grid-placeholder-retry')).toHaveLength(1)
    expect(failed[0]!.textContent).toContain('Could not load')
    expect(failed[1]!.textContent!.trim()).toBe('')
    // Every row of the run keeps its own slot: the scrollbar does not move.
    expect(target.querySelectorAll('tbody .sv-grid-row').length).toBe(7)
    destroy()
  })

  it('omits the Retry button when there is no handler to run', async () => {
    const { target, destroy } = await mountGrid({
      rowPlaceholder: (row: Row) => (row.id === 3 ? 'failed' : null),
    })
    await tick()
    expect(target.querySelector('.sv-grid-placeholder-retry')).toBeNull()
    destroy()
  })

  it('keeps placeholder rows out of select-all', async () => {
    const { api, destroy } = await mountGrid({
      showRowSelection: true,
      rowPlaceholder: (row: Row) => (row.id >= 3 ? 'loading' : null),
    })
    await tick()

    api.selectAllRows()
    await tick()
    // Selecting a row that has not loaded would leave an id that never
    // resolves to anything.
    expect(api.getSelectedRowIds().sort()).toEqual(['0', '1', '2'])
    destroy()
  })

  it('changes nothing for a grid that does not use it', async () => {
    const { target, destroy } = await mountGrid({})
    await tick()
    expect(target.querySelector('.sv-grid-placeholder-row')).toBeNull()
    expect(target.querySelectorAll('.sv-grid-row').length).toBeGreaterThan(0)
    destroy()
  })
})

describe('rowSelectionModel', () => {
  /**
   * "Everything except these", the shape a server-side selection needs.
   *
   * Its state is a rune, so the header checkbox re-derives when the model
   * changes. That is a requirement of the seam, not an accident of the test:
   * the grid re-reads `headerState()` only when something reactive that it
   * touched has changed.
   */
  function exceptModel(totalRows: number) {
    const state = $state({ selectAll: false, toggled: new Set<string>() })
    return {
      state,
      isSelected: (rowId: string) => state.selectAll !== state.toggled.has(rowId),
      headerState: () => {
        if (state.selectAll) return state.toggled.size === 0 ? 'all' : 'some'
        return state.toggled.size === 0 ? 'none' : 'some'
      },
      toggle: (rowId: string) => {
        const next = new Set(state.toggled)
        if (next.has(rowId)) next.delete(rowId)
        else next.add(rowId)
        state.toggled = next
      },
      toggleAll: (next: boolean) => {
        state.selectAll = next
        state.toggled = new Set()
      },
      selectedCount: () => (state.selectAll ? totalRows - state.toggled.size : state.toggled.size),
    }
  }

  it('answers the header checkbox instead of counting loaded rows', async () => {
    const model = exceptModel(1_000_000)
    const { target, destroy } = await mountGrid({ showRowSelection: true, rowSelectionModel: model })
    await tick()

    const header = target.querySelector('thead [role="checkbox"], thead input[type="checkbox"]')!
    expect(header.getAttribute('aria-checked')).toBe('false')

    model.toggleAll(true)
    await vi.waitFor(() =>
      expect(
        target.querySelector('thead [role="checkbox"], thead input[type="checkbox"]')!
          .getAttribute('aria-checked'),
      ).toBe('true'),
    )
    // Five rows are loaded; a million are selected. The grid says "all"
    // because the model said so, which is the whole point of the seam.
    expect(model.selectedCount()).toBe(1_000_000)
    destroy()
  })

  it('routes the header checkbox click to toggleAll, not to the loaded rows', async () => {
    const model = exceptModel(1_000_000)
    const { target, destroy } = await mountGrid({ showRowSelection: true, rowSelectionModel: model })
    await tick()

    const header = target.querySelector<HTMLElement>('thead [role="checkbox"], thead input[type="checkbox"]')!
    header.click()
    await tick()

    expect(model.state.selectAll).toBe(true)
    expect(model.selectedCount()).toBe(1_000_000)
    destroy()
  })

  it('routes a row checkbox through the model', async () => {
    const model = exceptModel(1_000_000)
    const { api, destroy } = await mountGrid({ showRowSelection: true, rowSelectionModel: model })
    await tick()

    api.toggleRowSelected('2')
    await tick()
    expect(model.state.toggled.has('2')).toBe(true)
    expect(model.isSelected('2')).toBe(true)

    model.toggleAll(true)
    await tick()
    api.toggleRowSelected('2')
    // Under select-all, toggling a row means "except this one".
    expect(model.isSelected('2')).toBe(false)
    expect(model.selectedCount()).toBe(999_999)
    destroy()
  })
})
