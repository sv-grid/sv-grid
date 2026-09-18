/**
 * `<SvGrid rowModel={ctl} />` - the one-prop integration.
 *
 * The seams below it are tested in `svgrid.row-model-seam.svelte.test.ts`;
 * this suite is about what the prop itself is for: that handing the grid a
 * model wires all of those seams at once, that the model drives re-renders,
 * and that writing a prop explicitly still wins - so adopting it is never
 * all-or-nothing.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  createCoreRowModel,
  createServerDataSource,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  type ColumnDef,
  type GridRowModel,
  type ServerDataSource,
  type SvGridApi,
} from './index'

type Row = { id: number; name: string }
const features = tableFeatures({ rowSortingFeature, rowSelectionFeature })
const cols: ColumnDef<typeof features, Row>[] = [{ field: 'name', header: 'Name', width: 160 }]

const tick = () => new Promise<void>((r) => setTimeout(r))
const settle = async () => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve()
  await tick()
}

function mountGrid(props: Record<string, unknown>) {
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
        columns: cols,
        features,
        _rowModels: { coreRowModel: createCoreRowModel() },
        containerHeight: 200,
        virtualization: false,
        onApiReady(api: SvGridApi<typeof features, Row>) {
          res({ api, target, destroy: () => { unmount(app); target.remove() } })
        },
        ...props,
      } as any,
    })
    queueMicrotask(() => {
      if (!target.querySelector('[role="grid"]')) rej(new Error('no grid'))
    })
  })
}

/** A hand-written model, to prove the grid depends on the shape not the class. */
function handWritten(rows: Row[]) {
  const listeners = new Set<() => void>()
  let current = rows
  let loading = false
  const sorts: Array<unknown> = []
  return {
    sorts,
    push(next: Row[]) {
      current = next
      for (const l of listeners) l()
    },
    setLoading(next: boolean) {
      loading = next
      for (const l of listeners) l()
    },
    model: {
      subscribe(onChange: () => void) {
        listeners.add(onChange)
        return () => listeners.delete(onChange)
      },
      getRows: () => current,
      isLoading: () => loading,
      getRowId: (r: Row) => String(r.id),
      setSort: (s: unknown) => sorts.push(s),
    } satisfies GridRowModel<Row>,
  }
}

describe('the rowModel prop', () => {
  it('renders the rows the model reports, with no data prop at all', async () => {
    const source = handWritten([
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Grace' },
    ])
    const { target, destroy } = await mountGrid({ rowModel: source.model })
    await tick()

    expect(target.textContent).toContain('Ada')
    expect(target.textContent).toContain('Grace')
    destroy()
  })

  it('re-renders when the model says it changed', async () => {
    const source = handWritten([{ id: 1, name: 'Ada' }])
    const { target, destroy } = await mountGrid({ rowModel: source.model })
    await tick()
    expect(target.textContent).not.toContain('Linus')

    source.push([{ id: 1, name: 'Ada' }, { id: 9, name: 'Linus' }])
    await vi.waitFor(() => expect(target.textContent).toContain('Linus'))
    destroy()
  })

  it('unsubscribes on unmount', async () => {
    const source = handWritten([{ id: 1, name: 'Ada' }])
    const { destroy } = await mountGrid({ rowModel: source.model })
    await tick()
    destroy()
    await tick()

    // A model that outlives the grid must not keep it alive through a
    // listener; pushing after unmount should reach nobody and throw nothing.
    expect(() => source.push([{ id: 2, name: 'Grace' }])).not.toThrow()
  })

  it('takes over sorting when the model sorts, and says so to the grid', async () => {
    const source = handWritten([
      { id: 1, name: 'Zoe' },
      { id: 2, name: 'Ada' },
    ])
    const { api, target, destroy } = await mountGrid({ rowModel: source.model, sortable: true })
    await tick()

    api.setSort('name', 'asc')
    await tick()

    // The model was told; the grid did NOT reorder locally, because a model
    // with `setSort` implies `externalSort`. (The grid also reports the
    // empty initial sort on mount, as it does for any onSortingChange.)
    expect(source.sorts.at(-1)).toEqual([{ id: 'name', desc: false }])
    const firstRow = target.querySelector('tbody .sv-grid-row')!
    expect(firstRow.textContent).toContain('Zoe')
    destroy()
  })

  it('lets an explicit prop win over the model', async () => {
    const source = handWritten([{ id: 1, name: 'Ada' }])
    const { target, destroy } = await mountGrid({
      rowModel: source.model,
      data: [{ id: 7, name: 'Override' }],
    })
    await tick()

    expect(target.textContent).toContain('Override')
    expect(target.textContent).not.toContain('Ada')
    destroy()
  })

  it('drives a real server controller end to end', async () => {
    const source: ServerDataSource<Row> = {
      async getRows(req) {
        const all: Row[] = Array.from({ length: 250 }, (_, i) => ({ id: i, name: `Row ${i}` }))
        const sorted = req.sortModel[0]?.desc ? [...all].reverse() : all
        return { rows: sorted.slice(req.startRow, req.endRow), rowCount: all.length }
      },
    }
    const ctl = createServerDataSource<Row>(source, {
      mode: 'infinite',
      blockSize: 100,
      onChange: () => {},
    })

    const { target, destroy } = await mountGrid({ rowModel: ctl })

    // The grid reported its visible range, the controller fetched block 0, and
    // the rows arrived - with no wiring in this test beyond the one prop.
    await vi.waitFor(() => expect(target.textContent).toContain('Row 0'))
    expect(ctl.getCacheState().length).toBeGreaterThan(0)
    expect(ctl.getRows()).toHaveLength(250)
    destroy()
    ctl.dispose()
  }, 20_000)

  it('wires the pager from a page-mode controller', async () => {
    const source: ServerDataSource<Row> = {
      async getRows(req) {
        const all: Row[] = Array.from({ length: 95 }, (_, i) => ({ id: i, name: `Row ${i}` }))
        return { rows: all.slice(req.startRow, req.endRow), rowCount: all.length }
      },
    }
    const ctl = createServerDataSource<Row>(source, { pageSize: 20, onChange: () => {} })
    ctl.refresh()
    await settle()

    const { api, destroy } = await mountGrid({ rowModel: ctl, pageable: true })

    // 95 rows on the server, not the 20 in hand: the count came from the model.
    await vi.waitFor(() => expect(api.getPageInfo().pageCount).toBe(5))
    expect(api.getPageInfo().pageSize).toBe(20)
    destroy()
    ctl.dispose()
  }, 20_000)

  it('takes the page-size choices from the model and sizes the page to the body on request', async () => {
    const calls: number[] = []
    let pageSize = 10
    const rows: Row[] = Array.from({ length: 50 }, (_, i) => ({ id: i, name: `Row ${i}` }))
    const model: GridRowModel<Row> = {
      subscribe: () => () => {},
      getRows: () => rows.slice(0, pageSize),
      isLoading: () => false,
      get pagination() {
        return {
          pageIndex: 0,
          pageSize,
          rowCount: 50,
          setPage: () => {},
          setPageSize: (n: number) => {
            calls.push(n)
            pageSize = n
          },
          pageSizes: [7, 14, 21],
          autoPageSize: true,
        }
      },
    }
    // jsdom lays nothing out; give every element a 100px box so the grid
    // measures its body on mount (the way the responsive test fakes width).
    const desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 100 })
    try {
      const { api, target, destroy } = await mountGrid({ rowModel: model, pageable: true, rowHeight: 20 })
      // The footer offers the model's sizes, not the grid's defaults.
      await vi.waitFor(() => expect(target.querySelector('.sv-grid-pagination')).toBeTruthy())
      expect(api.getOption('pageSizeOptions')).toEqual([7, 14, 21])
      // Auto size: 100px of body over 20px rows is a page of five.
      await vi.waitFor(() => expect(calls.at(-1)).toBe(5))
      destroy()
    } finally {
      if (desc) Object.defineProperty(HTMLElement.prototype, 'clientHeight', desc)
      else delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight
    }
  }, 20_000)
})

describe('editing under a row model', () => {
  type Node = Row & { kind: "group" | "leaf" }
  it('refuses to edit a server group row or a placeholder, and edits a leaf', async () => {
    const nodes: Node[] = [
      { id: 1, name: 'EMEA', kind: 'group' },
      { id: 2, name: 'Ada', kind: 'leaf' },
    ]
    const model: GridRowModel<Node> = {
      subscribe: () => () => {},
      getRows: () => nodes,
      isLoading: () => false,
      getRowId: (r) => String(r.id),
      group: {
        isGroup: (r) => r.kind === 'group',
        level: () => 0,
        expanded: () => false,
        onToggle: () => {},
      },
    }
    const { api, target, destroy } = await mountGrid({
      rowModel: model,
      columns: [{ field: 'name', header: 'Name', width: 160, editorType: 'text' }],
      editable: true,
    })
    try {
      // The group row: nothing opens, whatever the column says.
      api.startEditing(0, 'name')
      await tick()
      expect(target.querySelector('.sv-grid-cell input')).toBeNull()
      // The leaf: an editor.
      api.startEditing(1, 'name')
      await vi.waitFor(() => expect(target.querySelector('.sv-grid-cell input')).not.toBeNull())
    } finally {
      destroy()
    }
  })
})

describe('the rowModel prop with virtualization on', () => {
  /** 100k rows, so only a window is rendered and most rows are placeholders. */
  function bigSource(): ServerDataSource<Row> {
    return {
      async getRows(req) {
        const rows: Row[] = []
        for (let i = req.startRow; i < Math.min(req.endRow, 100_000); i += 1) {
          rows.push({ id: i, name: `Row ${i}` })
        }
        return { rows, rowCount: 100_000 }
      },
    }
  }

  it('renders skeletons for the rows it has not loaded', async () => {
    const ctl = createServerDataSource<Row>(bigSource(), {
      mode: 'infinite',
      blockSize: 100,
      onChange: () => {},
    })
    const { target, destroy } = await mountGrid({
      rowModel: ctl,
      virtualization: true,
      containerHeight: 300,
      rowHeight: 30,
    })

    // Block 0 landed, so the window at the top is real data.
    await vi.waitFor(() => expect(target.textContent).toContain('Row 0'))

    // The grid claims the whole table, and everything outside the loaded
    // block is a placeholder - which is what keeps the scrollbar honest.
    const rows = ctl.getRows()
    expect(rows).toHaveLength(100_000)
    expect(ctl.rowPlaceholder?.(rows[50_000] as Row, 50_000)).toBe('loading')
    destroy()
    ctl.dispose()
  }, 20_000)

  it('draws skeleton cells for a row the model calls a placeholder', async () => {
    // Straight through the seam, with no fetching involved: the question here
    // is only whether `rowModel.rowPlaceholder` reaches the renderer. Driving
    // it from a real controller cannot answer that - with virtualization off
    // the grid reports every row as visible, so every block loads and no
    // placeholder survives to be rendered.
    const rows: Row[] = [
      { id: 0, name: 'Ada' },
      { id: 1, name: 'Grace' },
      { id: 2, name: 'Linus' },
    ]
    const model: GridRowModel<Row> = {
      subscribe: () => () => {},
      getRows: () => rows,
      isLoading: () => false,
      rowPlaceholder: (row) => (row.id === 2 ? 'loading' : null),
    }
    const { target, destroy } = await mountGrid({ rowModel: model })
    await tick()

    const placeholder = target.querySelector('.sv-grid-placeholder-row')!
    expect(placeholder).not.toBeNull()
    expect(placeholder.querySelectorAll('.sv-grid-placeholder-skeleton').length).toBe(cols.length)
    expect(target.textContent).toContain('Ada')
    destroy()
  })
})
