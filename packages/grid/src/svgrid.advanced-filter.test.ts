/**
 * Component tests for the advanced filter, exercised through a real mounted
 * grid rather than the pipeline in isolation.
 *
 * The behaviour that matters here is not "does the predicate work" - that is
 * settled by the compiler's differential tests in @svgrid/enterprise. It is:
 *
 *   - the grid FAILS OPEN when no engine is registered, so the free package
 *     shows every row rather than none
 *   - a compile failure or a throw also fails open, never half-filters
 *   - it composes with AND against the global, column and facet filters
 *   - it runs LAST, so an engine sees only the rows those stages left
 *   - clearAllFilters() clears it, and view state round-trips it
 */
import { describe, expect, it, afterEach } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  columnFilteringFeature,
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  registerAdvancedFilterEngine,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from './index'
import type {
  AdvancedFilterEngine,
  ColumnDef,
  GridPredicateExpr,
  SvGridApi,
} from './index'

type Order = { id: string; region: string; status: string; amount: number }

const features = tableFeatures({ columnFilteringFeature, rowSortingFeature })

const rows: Order[] = [
  { id: 'O-1', region: 'EMEA', status: 'open', amount: 100 },
  { id: 'O-2', region: 'EMEA', status: 'paid', amount: 200 },
  { id: 'O-3', region: 'APAC', status: 'open', amount: 300 },
  { id: 'O-4', region: 'APAC', status: 'paid', amount: 400 },
]

const cols: ColumnDef<typeof features, Order>[] = [
  { field: 'id', header: 'ID', width: 90 },
  { field: 'region', header: 'Region', width: 110 },
  { field: 'status', header: 'Status', width: 110 },
  { field: 'amount', header: 'Amount', width: 100 },
]

function mountGrid(props: Record<string, unknown> = {}) {
  return new Promise<{
    api: SvGridApi<typeof features, Order>
    target: HTMLElement
    destroy: () => void
  }>(
    (res, rej) => {
      const target = document.createElement('div')
      document.body.appendChild(target)
      let api: SvGridApi<typeof features, Order> | null = null
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
          containerHeight: 360,
          virtualization: false,
          columnVirtualization: false,
          showPagination: false,
          ...props,
          onApiReady(received: SvGridApi<typeof features, Order>) {
            api = received
            res({ api, target, destroy: () => { unmount(app); target.remove() } })
          },
        } as never,
      })
      queueMicrotask(() => { if (!api) rej(new Error('onApiReady never fired')) })
    },
  )
}

const tick = () => new Promise<void>((r) => queueMicrotask(r))
const ids = (api: SvGridApi<typeof features, Order>) =>
  api.getDisplayedRows().map((r) => (r as unknown as Order).id)

/** An engine that honours only a flat `cmp` on `region` with `equals`. */
const regionEqualsEngine: AdvancedFilterEngine = (expr, ctx) => {
  if (expr.kind !== 'cmp' || expr.op !== 'equals') return null
  const want = String(expr.value ?? '')
  return (row) => String(ctx.getValue(row, expr.column) ?? '') === want
}

const EMEA: GridPredicateExpr = { kind: 'cmp', column: 'region', op: 'equals', value: 'EMEA' }

afterEach(() => registerAdvancedFilterEngine(null))

describe('advanced filter without an engine (free grid)', () => {
  it('shows every row - fails OPEN rather than filtering nothing through', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.setAdvancedFilter(EMEA)
      await tick()
      expect(ids(api)).toEqual(['O-1', 'O-2', 'O-3', 'O-4'])
    } finally {
      destroy()
    }
  })

  it('still records the expression, and reports itself inactive', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.setAdvancedFilter(EMEA)
      await tick()
      expect(api.getAdvancedFilter()).toEqual(EMEA)
      expect(api.isAdvancedFilterActive()).toBe(false)
    } finally {
      destroy()
    }
  })
})

describe('advanced filter with an engine', () => {
  it('narrows the rows', async () => {
    registerAdvancedFilterEngine(regionEqualsEngine)
    const { api, destroy } = await mountGrid()
    try {
      api.setAdvancedFilter(EMEA)
      await tick()
      expect(ids(api)).toEqual(['O-1', 'O-2'])
      expect(api.isAdvancedFilterActive()).toBe(true)
    } finally {
      destroy()
    }
  })

  it('clearing restores every row', async () => {
    registerAdvancedFilterEngine(regionEqualsEngine)
    const { api, destroy } = await mountGrid()
    try {
      api.setAdvancedFilter(EMEA)
      await tick()
      api.clearAdvancedFilter()
      await tick()
      expect(ids(api)).toHaveLength(4)
      expect(api.getAdvancedFilter()).toBeNull()
    } finally {
      destroy()
    }
  })

  it('fails open when the engine cannot compile the expression', async () => {
    registerAdvancedFilterEngine(regionEqualsEngine)
    const { api, destroy } = await mountGrid()
    try {
      // `contains` is outside what this engine handles, so it returns null.
      api.setAdvancedFilter({ kind: 'cmp', column: 'region', op: 'contains', value: 'EM' })
      await tick()
      expect(ids(api)).toHaveLength(4)
    } finally {
      destroy()
    }
  })

  it('fails open when the engine throws', async () => {
    registerAdvancedFilterEngine(() => {
      throw new Error('boom')
    })
    const { api, destroy } = await mountGrid()
    try {
      api.setAdvancedFilter(EMEA)
      await tick()
      expect(ids(api)).toHaveLength(4)
    } finally {
      destroy()
    }
  })

  it('fails open when the compiled predicate itself throws', async () => {
    registerAdvancedFilterEngine(() => () => {
      throw new Error('boom per row')
    })
    const { api, destroy } = await mountGrid()
    try {
      api.setAdvancedFilter(EMEA)
      await tick()
      expect(ids(api)).toHaveLength(4)
    } finally {
      destroy()
    }
  })
})

describe('composition with the other filter stages', () => {
  it('ANDs with a column filter', async () => {
    registerAdvancedFilterEngine(regionEqualsEngine)
    const { api, destroy } = await mountGrid()
    try {
      api.setAdvancedFilter(EMEA)
      api.setFilter('status', { operator: 'equals', value: 'paid' })
      await tick()
      expect(ids(api)).toEqual(['O-2'])
    } finally {
      destroy()
    }
  })

  it('ANDs with a facet filter', async () => {
    registerAdvancedFilterEngine(regionEqualsEngine)
    const { api, destroy } = await mountGrid()
    try {
      api.setAdvancedFilter(EMEA)
      api.setFacetFilter('status', ['open'])
      await tick()
      expect(ids(api)).toEqual(['O-1'])
    } finally {
      destroy()
    }
  })

  it('runs LAST - the engine only sees rows the earlier stages kept', async () => {
    let seen: number | null = null
    registerAdvancedFilterEngine((_expr, ctx) => {
      seen = ctx.rows.length
      return () => true
    })
    const { api, destroy } = await mountGrid()
    try {
      api.setFilter('region', { operator: 'equals', value: 'EMEA' })
      api.setAdvancedFilter(EMEA)
      await tick()
      // 2 EMEA rows, not the full 4: aggregates fold over the narrowed set.
      expect(seen).toBe(2)
    } finally {
      destroy()
    }
  })

  it('is cleared by clearAllFilters(), which promises every filter surface', async () => {
    registerAdvancedFilterEngine(regionEqualsEngine)
    const { api, destroy } = await mountGrid()
    try {
      api.setAdvancedFilter(EMEA)
      api.setFilter('status', { operator: 'equals', value: 'paid' })
      await tick()
      api.clearAllFilters()
      await tick()
      expect(api.getAdvancedFilter()).toBeNull()
      expect(ids(api)).toHaveLength(4)
    } finally {
      destroy()
    }
  })
})

describe('seeding and view state', () => {
  it('seeds from initialAdvancedFilter at mount', async () => {
    registerAdvancedFilterEngine(regionEqualsEngine)
    const { api, destroy } = await mountGrid({ initialAdvancedFilter: EMEA })
    try {
      await tick()
      expect(api.getAdvancedFilter()).toEqual(EMEA)
      expect(ids(api)).toEqual(['O-1', 'O-2'])
    } finally {
      destroy()
    }
  })

  it('omits the key from getState() when no advanced filter is set', async () => {
    const { api, destroy } = await mountGrid()
    try {
      // Existing saved views must round-trip byte-identical, so the key is
      // absent rather than present-and-null.
      expect('advancedFilter' in api.getState()).toBe(false)
    } finally {
      destroy()
    }
  })

  it('round-trips through getState / setState', async () => {
    registerAdvancedFilterEngine(regionEqualsEngine)
    const { api, destroy } = await mountGrid()
    try {
      api.setAdvancedFilter(EMEA)
      await tick()
      const saved = JSON.parse(JSON.stringify(api.getState()))
      api.clearAdvancedFilter()
      await tick()
      expect(ids(api)).toHaveLength(4)

      api.setState(saved)
      await tick()
      expect(api.getAdvancedFilter()).toEqual(EMEA)
      expect(ids(api)).toEqual(['O-1', 'O-2'])
    } finally {
      destroy()
    }
  })

  it('leaves the filter alone when setState omits the key', async () => {
    registerAdvancedFilterEngine(regionEqualsEngine)
    const { api, destroy } = await mountGrid()
    try {
      api.setAdvancedFilter(EMEA)
      await tick()
      api.setState({ globalFilter: '' })
      await tick()
      expect(api.getAdvancedFilter()).toEqual(EMEA)
    } finally {
      destroy()
    }
  })

  it('clears when setState passes an explicit null', async () => {
    registerAdvancedFilterEngine(regionEqualsEngine)
    const { api, destroy } = await mountGrid()
    try {
      api.setAdvancedFilter(EMEA)
      await tick()
      api.setState({ advancedFilter: null })
      await tick()
      expect(api.getAdvancedFilter()).toBeNull()
      expect(ids(api)).toHaveLength(4)
    } finally {
      destroy()
    }
  })
})

describe('toolbar indicator', () => {
  // A filter set from a consumer-mounted panel hides rows with nothing in the
  // grid to explain it. The chip is the grid's own account of that state.
  const chip = (t: HTMLElement) => t.querySelector('.sv-grid-advf-chip')

  it('is absent until an advanced filter is set', async () => {
    const { target, destroy } = await mountGrid()
    try {
      await tick()
      expect(chip(target)).toBeNull()
    } finally {
      destroy()
    }
  })

  it('appears when a filter is set, even with no engine registered', async () => {
    // Deliberate: the expression IS set, so the state is real and worth
    // showing. Whether an engine acts on it is a separate concern, and the
    // panel reports that separately.
    const { api, target, destroy } = await mountGrid()
    try {
      api.setAdvancedFilter(EMEA)
      await tick()
      expect(chip(target)).not.toBeNull()
    } finally {
      destroy()
    }
  })

  it('clears the filter and restores the rows', async () => {
    registerAdvancedFilterEngine(regionEqualsEngine)
    const { api, target, destroy } = await mountGrid()
    try {
      api.setAdvancedFilter(EMEA)
      await tick()
      expect(ids(api)).toEqual(['O-1', 'O-2'])

      ;(chip(target)!.querySelector('.sv-grid-advf-clear') as HTMLButtonElement).click()
      await tick()

      expect(api.getAdvancedFilter()).toBeNull()
      expect(ids(api)).toEqual(['O-1', 'O-2', 'O-3', 'O-4'])
      expect(chip(target)).toBeNull()
    } finally {
      destroy()
    }
  })

  it('labels the clear control for assistive tech and translates it', async () => {
    const { api, target, destroy } = await mountGrid({
      localization: { text: { advancedFilterActive: 'Geavanceerd filter' } },
    })
    try {
      api.setAdvancedFilter(EMEA)
      await tick()
      expect(chip(target)!.textContent).toContain('Geavanceerd filter')
      expect(
        chip(target)!.querySelector('.sv-grid-advf-clear')!.getAttribute('aria-label'),
      ).toBe('Clear advanced filter')
    } finally {
      destroy()
    }
  })
})

describe('onAdvancedFilterChange', () => {
  // The authoring panel lives outside the grid, so a change the grid makes on
  // its own has to be announced or the two drift apart.
  it('does not fire on mount', async () => {
    const seen: Array<GridPredicateExpr | null> = []
    const { destroy } = await mountGrid({
      onAdvancedFilterChange: (e: GridPredicateExpr | null) => seen.push(e),
    })
    try {
      await tick()
      expect(seen).toEqual([])
    } finally {
      destroy()
    }
  })

  it('fires when the filter is set and when it is cleared', async () => {
    const seen: Array<GridPredicateExpr | null> = []
    const { api, destroy } = await mountGrid({
      onAdvancedFilterChange: (e: GridPredicateExpr | null) => seen.push(e),
    })
    try {
      api.setAdvancedFilter(EMEA)
      await tick()
      api.clearAdvancedFilter()
      await tick()
      expect(seen).toEqual([EMEA, null])
    } finally {
      destroy()
    }
  })

  it('fires when the toolbar chip clears it', async () => {
    const seen: Array<GridPredicateExpr | null> = []
    const { api, target, destroy } = await mountGrid({
      onAdvancedFilterChange: (e: GridPredicateExpr | null) => seen.push(e),
    })
    try {
      api.setAdvancedFilter(EMEA)
      await tick()
      ;(target.querySelector('.sv-grid-advf-clear') as HTMLButtonElement).click()
      await tick()
      expect(seen.at(-1)).toBeNull()
    } finally {
      destroy()
    }
  })

  it('fires when clearAllFilters sweeps it away', async () => {
    const seen: Array<GridPredicateExpr | null> = []
    const { api, destroy } = await mountGrid({
      onAdvancedFilterChange: (e: GridPredicateExpr | null) => seen.push(e),
    })
    try {
      api.setAdvancedFilter(EMEA)
      await tick()
      api.clearAllFilters()
      await tick()
      expect(seen.at(-1)).toBeNull()
    } finally {
      destroy()
    }
  })

  it('does not fire again when the same expression is re-applied', async () => {
    const seen: Array<GridPredicateExpr | null> = []
    const { api, destroy } = await mountGrid({
      onAdvancedFilterChange: (e: GridPredicateExpr | null) => seen.push(e),
    })
    try {
      api.setAdvancedFilter(EMEA)
      await tick()
      api.setAdvancedFilter({ ...EMEA })
      await tick()
      expect(seen).toHaveLength(1)
    } finally {
      destroy()
    }
  })
})
