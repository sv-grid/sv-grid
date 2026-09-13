/**
 * QA sweep: the headless engine - `createSvGrid`, its options, the instance
 * members a renderer reads, the row-model pipeline, the feature registry and
 * the sort / filter function registries.
 *
 * No component here: this is the surface a consumer gets when they skip
 * `<SvGrid>` and render the engine themselves, so the cases are checked against
 * `docs/reference/headless-engine.md` and `docs/reference/features.md`.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  columnFilteringFeature,
  columnGroupingFeature,
  createCoreRowModel,
  createExpandedRowModel,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  createSvGrid,
  createTreeRowModel,
  filterFns,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from '../index'
import { createGridState, subscribeGrid } from '../index'
import { createSvGridCore } from '../core'
/**
 * Imported from the BARREL on purpose. A controlled consumer has to type the
 * `on*Change` handlers `SvGridOptions` asks for, and half these slices used to be
 * reachable only from `@svgrid/grid/core` - so this import is the regression
 * test, and `pnpm test:types` is what enforces it.
 */
import type {
  ActiveCellState,
  ColumnDef,
  ColumnFilter,
  ColumnFiltersState,
  ExpandedState,
  GroupingState,
  PaginationState,
  RowModel,
  RowSelectionState,
  SortingState,
  SvGridOptions,
  Updater,
} from '../index'

type Repo = { id: number; name: string; lang: string; stars: number }

const repos: Repo[] = [
  { id: 1, name: 'svelte', lang: 'TypeScript', stars: 79_000 },
  { id: 2, name: 'vite', lang: 'TypeScript', stars: 68_000 },
  { id: 3, name: 'ripgrep', lang: 'Rust', stars: 47_000 },
  { id: 4, name: 'fd', lang: 'Rust', stars: 33_000 },
  { id: 5, name: 'jq', lang: 'C', stars: 30_000 },
]

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  columnGroupingFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
})

const columns: ColumnDef<typeof features, Repo>[] = [
  { field: 'name', header: 'Name' },
  { field: 'lang', header: 'Language' },
  { field: 'stars', header: 'Stars', editorType: 'number' },
]

/** The whole pipeline, in the documented order. */
const allRowModels = () => ({
  coreRowModel: createCoreRowModel<Repo>(),
  filteredRowModel: createFilteredRowModel<Repo>(),
  sortedRowModel: createSortedRowModel<Repo>(sortFns),
  groupedRowModel: createGroupedRowModel<Repo>(),
  expandedRowModel: createExpandedRowModel<Repo>(),
  paginatedRowModel: createPaginatedRowModel<Repo>(),
})

function makeGrid(options: Record<string, unknown> = {}) {
  return createSvGrid({
    _features: features,
    _rowModels: allRowModels(),
    columns,
    data: repos,
    ...options,
  } as never)
}

const names = (grid: ReturnType<typeof makeGrid>) =>
  grid.getRowModel().rows.map((r) => (r.original as Repo)?.name)

/**
 * Data rows only. A group row's `original` is a SYNTHESIZED object (each
 * column's aggregate, or its shared value when every child agrees), so a
 * single-row group looks like a data row through `original` alone - `depth`,
 * `subRows` or `getCanExpand()` are what separate them.
 */
const leafNames = (grid: ReturnType<typeof makeGrid>) =>
  grid
    .getRowModel()
    .rows.filter((r) => !r.getCanExpand())
    .map((r) => (r.original as Repo).name)

describe('QA headless: createSvGrid options', () => {
  it('_features + _rowModels + columns + data are all it needs', () => {
    const grid = createSvGrid({
      _features: features,
      _rowModels: { coreRowModel: createCoreRowModel<Repo>() },
      columns,
      data: repos,
    } as never)
    expect(grid.getRowModel().rows).toHaveLength(repos.length)
    expect(grid.getAllColumns().map((c) => c.id)).toEqual(['name', 'lang', 'stars'])
  })

  it('state seeds the engine stores', () => {
    const grid = makeGrid({
      state: { sorting: [{ id: 'stars', desc: false }], pagination: { pageIndex: 0, pageSize: 2 } },
    })
    expect(grid.getState().sorting).toEqual([{ id: 'stars', desc: false }])
    expect(names(grid)).toEqual(['jq', 'fd'])
  })

  it('getRowId decides row.id; without it ids are the row index', () => {
    const withId = makeGrid({ getRowId: (row: Repo) => `repo-${row.id}` })
    expect(withId.getRowModel().rows.map((r) => r.id)).toEqual([
      'repo-1',
      'repo-2',
      'repo-3',
      'repo-4',
      'repo-5',
    ])

    const withoutId = makeGrid()
    expect(withoutId.getRowModel().rows.map((r) => r.id)).toEqual(['0', '1', '2', '3', '4'])
  })

  it('every on*Change option receives the updater the setter was called with', () => {
    const onSortingChange = vi.fn()
    const onColumnFiltersChange = vi.fn()
    const onPaginationChange = vi.fn()
    const onGroupingChange = vi.fn()
    const onExpandedChange = vi.fn()
    const onRowSelectionChange = vi.fn()
    const onActiveCellChange = vi.fn()
    const grid = makeGrid({
      onSortingChange,
      onColumnFiltersChange,
      onPaginationChange,
      onGroupingChange,
      onExpandedChange,
      onRowSelectionChange,
      onActiveCellChange,
    })

    grid.setSorting([{ id: 'stars', desc: true }])
    grid.setColumnFilters([{ id: 'lang', value: 'Rust' }])
    grid.setPagination({ pageIndex: 1, pageSize: 2 })
    grid.setGrouping(['lang'])
    grid.setExpanded({ group_lang_Rust: true })
    grid.setRowSelection({ '0': true })
    grid.setActiveCell({ rowIndex: 1, colIndex: 1, cellId: null })

    expect(onSortingChange).toHaveBeenCalledWith([{ id: 'stars', desc: true }])
    expect(onColumnFiltersChange).toHaveBeenCalledWith([{ id: 'lang', value: 'Rust' }])
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 1, pageSize: 2 })
    expect(onGroupingChange).toHaveBeenCalledWith(['lang'])
    expect(onExpandedChange).toHaveBeenCalledWith({ group_lang_Rust: true })
    expect(onRowSelectionChange).toHaveBeenCalledWith({ '0': true })
    expect(onActiveCellChange).toHaveBeenCalledWith({ rowIndex: 1, colIndex: 1, cellId: null })
  })
})

describe('QA headless: the instance members a renderer reads', () => {
  it('getRowModel returns the post-pipeline rows', () => {
    const grid = makeGrid()
    expect(names(grid)).toEqual(['svelte', 'vite', 'ripgrep', 'fd', 'jq'])
  })

  it('getAllColumns exposes each column with its def and sort / filter capability', () => {
    const grid = makeGrid()
    const [name, , stars] = grid.getAllColumns()
    expect(name!.id).toBe('name')
    expect(name!.columnDef.header).toBe('Name')
    expect(name!.depth).toBe(0)
    expect(name!.getCanSort()).toBe(true)
    expect(name!.getCanFilter()).toBe(true)
    expect(stars!.columnDef.editorType).toBe('number')
  })

  it('getIsSorted / getToggleSortingHandler drive a header click', () => {
    const grid = makeGrid()
    const stars = grid.getAllColumns().find((c) => c.id === 'stars')!
    expect(stars.getIsSorted()).toBe(false)

    stars.getToggleSortingHandler()()
    expect(stars.getIsSorted()).toBe('asc')
    expect(names(grid)).toEqual(['jq', 'fd', 'ripgrep', 'vite', 'svelte'])

    stars.getToggleSortingHandler()()
    expect(stars.getIsSorted()).toBe('desc')
    expect(names(grid)[0]).toBe('svelte')
  })

  /**
   * The engine emits ONE header level - the leaf columns - with `colSpan: 1`
   * and no placeholders; `getAllColumns()` is leaves-only too. A group column
   * (`columns: [...]`) contributes its children, not a spanning header of its
   * own, and `<SvGrid>` builds the group-header row itself on top of this. The
   * reference page says so; this pins it so the engine and the docs cannot
   * drift apart again.
   */
  it('getHeaderGroups emits one level of leaf headers, group columns included', () => {
    const grouped: ColumnDef<typeof features, Repo>[] = [
      { id: 'repo', header: 'Repo', columns: [{ field: 'name', header: 'Name' }] },
      { field: 'stars', header: 'Stars', footer: 'Total' },
    ]
    const grid = createSvGrid({
      _features: features,
      _rowModels: allRowModels(),
      columns: grouped,
      data: repos,
    } as never)

    expect(grid.getAllColumns().map((c) => c.id)).toEqual(['name', 'stars'])

    const headerGroups = grid.getHeaderGroups()
    expect(headerGroups).toHaveLength(1)
    expect(headerGroups[0]!.id).toBe('header_group_0')
    expect(headerGroups[0]!.headers.map((h) => h.column.id)).toEqual(['name', 'stars'])
    expect(headerGroups[0]!.headers.every((h) => h.colSpan === 1)).toBe(true)
    expect(headerGroups[0]!.headers.some((h) => h.isPlaceholder)).toBe(false)
    expect(headerGroups[0]!.headers[0]!.getContext().column.id).toBe('name')
    expect(headerGroups[0]!.headers[0]!.getContext().table).toBe(grid)
  })

  it('getFooterGroups mirrors the header groups, carrying each footer slot', () => {
    const grid = createSvGrid({
      _features: features,
      _rowModels: allRowModels(),
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'stars', header: 'Stars', footer: 'Total' },
      ],
      data: repos,
    } as never)
    const footerGroups = grid.getFooterGroups()
    expect(footerGroups).toHaveLength(1)
    expect(footerGroups[0]!.headers.map((h) => h.column.columnDef.footer)).toEqual([
      undefined,
      'Total',
    ])
  })

  it('store / optionsStore / state / getState expose the engine state', () => {
    const grid = makeGrid()
    expect(grid.getState().sorting).toEqual([])
    expect(grid.store.state.sorting).toEqual([])
    expect(grid.optionsStore.state.columns).toHaveLength(3)

    let notified = 0
    const unsubscribe = grid.store.subscribe(() => (notified += 1))
    grid.setSorting([{ id: 'name', desc: false }])
    expect(notified).toBe(1)
    expect(grid.getState().sorting).toEqual([{ id: 'name', desc: false }])
    unsubscribe()
    grid.setSorting([])
    expect(notified).toBe(1)
  })

  it('setOptions swaps options (data included) and the row model follows', () => {
    const grid = makeGrid()
    grid.setOptions((prev: Record<string, unknown>) => ({
      ...prev,
      data: repos.slice(0, 2),
    }))
    expect(names(grid)).toEqual(['svelte', 'vite'])
  })

  it('every setter accepts a value or an updater function', () => {
    const grid = makeGrid()
    grid.setSorting([{ id: 'stars', desc: false }])
    grid.setSorting((prev) => [...prev, { id: 'name', desc: true }])
    expect(grid.getState().sorting).toHaveLength(2)

    grid.setRowSelection({ '0': true })
    grid.setRowSelection((prev) => ({ ...prev, '1': true }))
    expect(grid.getState().rowSelection).toEqual({ '0': true, '1': true })

    grid.setColumnFilters((prev) => [...prev, { id: 'lang', value: 'Rust' }])
    expect(names(grid)).toEqual(['fd', 'ripgrep'])
  })

  it('setActiveCell / moveActiveCell walk the grid and clamp at the edges', () => {
    const grid = makeGrid()
    grid.setActiveCell({ rowIndex: 0, colIndex: 0, cellId: null })

    grid.moveActiveCell({ rowDelta: 1, colDelta: 1 })
    expect(grid.getState().activeCell).toMatchObject({ rowIndex: 1, colIndex: 1 })

    grid.moveActiveCell({ rowDelta: -5, colDelta: -5 })
    expect(grid.getState().activeCell).toMatchObject({ rowIndex: 0, colIndex: 0 })

    grid.moveActiveCell({ rowDelta: 99, colDelta: 99 })
    expect(grid.getState().activeCell).toMatchObject({ rowIndex: 4, colIndex: 2 })
  })
})

describe('QA headless: the Row shape', () => {
  it('carries id, index, original, depth and reads cells by column id', () => {
    const grid = makeGrid()
    const row = grid.getRowModel().rows[1]!
    expect(row.id).toBe('1')
    expect(row.index).toBe(1)
    expect(row.depth).toBe(0)
    expect(row.original).toEqual(repos[1])
    expect(row.getCellValueByColumnId('stars')).toBe(68_000)
    expect(row.getCellValueByColumnId('nope')).toBeUndefined()
  })

  it('getAllCells returns one cell per column, each resolving its own value', () => {
    const grid = makeGrid()
    const cells = grid.getRowModel().rows[0]!.getAllCells()
    expect(cells.map((c) => c.column.id)).toEqual(['name', 'lang', 'stars'])
    expect(cells.map((c) => c.getValue())).toEqual(['svelte', 'TypeScript', 79_000])
  })

  it('getIsSelected / toggleSelected drive the selection state', () => {
    const grid = makeGrid()
    const row = grid.getRowModel().rows[0]!
    expect(row.getIsSelected()).toBe(false)
    row.toggleSelected()
    expect(row.getIsSelected()).toBe(true)
    expect(grid.getState().rowSelection).toEqual({ '0': true })
    row.toggleSelected()
    expect(row.getIsSelected()).toBe(false)
  })

  it('getCanExpand / getIsExpanded / toggleExpanded work on a group row', () => {
    const grid = makeGrid({ state: { grouping: ['lang'] } })
    const banner = grid.getRowModel().rows[0]!
    expect(banner.getCanExpand()).toBe(true)
    expect(banner.getIsExpanded()).toBe(false)
    expect(banner.leafCount).toBe(2)

    banner.toggleExpanded()
    expect(banner.getIsExpanded()).toBe(true)
    expect(leafNames(grid)).toEqual(['svelte', 'vite'])

    // A data row cannot expand.
    const leaf = grid.getRowModel().rows.find((r) => r.depth === 1)!
    expect(leaf.getCanExpand()).toBe(false)
  })

  it("a group row's original is synthesized from its children, not a data row", () => {
    const grid = createSvGrid({
      _features: features,
      _rowModels: allRowModels(),
      columns: [
        { field: 'lang', header: 'Language' },
        { field: 'stars', header: 'Stars', editorType: 'number', aggregate: 'sum' },
      ],
      data: repos,
      state: { grouping: ['lang'] },
    } as never)
    const [typescript, , c] = grid.getRowModel().rows
    // The aggregate for `stars`, and the shared value for the grouped column.
    expect(typescript!.original).toEqual({ lang: 'TypeScript', stars: 147_000 })
    // A one-row group therefore looks like its only child, plus aggregates.
    expect(c!.original).toEqual({ lang: 'C', stars: 30_000 })
    expect(c!.getCanExpand()).toBe(true)
    expect(c!.leafCount).toBe(1)
    // A column whose children disagree and that has no aggregate reads back
    // undefined rather than an arbitrary child's value.
    const noAgg = makeGrid({ state: { grouping: ['lang'] } })
    expect((noAgg.getRowModel().rows[0]!.original as Repo).name).toBeUndefined()
  })

  it('a row serializes to a small constant, not the whole dataset', () => {
    const small = makeGrid()
    const big = createSvGrid({
      _features: features,
      _rowModels: allRowModels(),
      columns,
      data: Array.from({ length: 2_000 }, (_, i) => ({
        id: i,
        name: `r${i}`,
        lang: 'Go',
        stars: i,
      })),
    } as never)
    const smallSize = JSON.stringify(small.getRowModel().rows[0]).length
    const bigSize = JSON.stringify(big.getRowModel().rows[0]).length
    expect(bigSize).toBeLessThan(smallSize * 2)
  })
})

describe('QA headless: the row-model pipeline', () => {
  it('runs filter, then sort, then group, then expand, then paginate', () => {
    const grid = makeGrid({
      state: {
        columnFilters: [{ id: 'lang', value: 'Rust' }],
        sorting: [{ id: 'stars', desc: true }],
        pagination: { pageIndex: 0, pageSize: 10 },
      },
    })
    expect(names(grid)).toEqual(['ripgrep', 'fd'])
  })

  it('createCoreRowModel alone is the identity stage', () => {
    const grid = createSvGrid({
      _features: features,
      _rowModels: { coreRowModel: createCoreRowModel<Repo>() },
      columns,
      data: repos,
      state: { sorting: [{ id: 'stars', desc: true }] },
    } as never)
    // No sorted stage registered, so `sorting` state changes nothing.
    expect(names(grid)).toEqual(['svelte', 'vite', 'ripgrep', 'fd', 'jq'])
  })

  it('createSortedRowModel picks the comparator from the column type', () => {
    const grid = makeGrid({ state: { sorting: [{ id: 'stars', desc: false }] } })
    // Numeric, not lexical: 30000 sorts before 47000 before 68000.
    expect(names(grid)).toEqual(['jq', 'fd', 'ripgrep', 'vite', 'svelte'])
  })

  it('createPaginatedRowModel slices to the current page, last', () => {
    const grid = makeGrid({ state: { pagination: { pageIndex: 1, pageSize: 2 } } })
    expect(names(grid)).toEqual(['ripgrep', 'fd'])
    grid.setPagination({ pageIndex: 2, pageSize: 2 })
    expect(names(grid)).toEqual(['jq'])
  })

  it('createGroupedRowModel emits a banner per bucket, with aggregates', () => {
    const grid = createSvGrid({
      _features: features,
      _rowModels: allRowModels(),
      columns: [
        { field: 'lang', header: 'Language' },
        { field: 'stars', header: 'Stars', editorType: 'number', aggregate: 'sum' },
      ],
      data: repos,
      state: { grouping: ['lang'] },
    } as never)
    const rows = grid.getRowModel().rows
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.id)).toEqual([
      'group_lang_TypeScript',
      'group_lang_Rust',
      'group_lang_C',
    ])
    expect(rows[0]!.getCellValueByColumnId('stars')).toBe(147_000)
  })

  it('createExpandedRowModel hides collapsed children', () => {
    const grid = makeGrid({ state: { grouping: ['lang'] } })
    expect(grid.getRowModel().rows).toHaveLength(3)
    grid.setExpanded({ group_lang_Rust: true })
    expect(leafNames(grid)).toEqual(['ripgrep', 'fd'])
  })

  it('createTreeRowModel nests rows by parent id', () => {
    type Node = { id: number; parentId: number | null; name: string }
    const nodes: Node[] = [
      { id: 1, parentId: null, name: 'root' },
      { id: 2, parentId: 1, name: 'child' },
      { id: 3, parentId: 2, name: 'grandchild' },
    ]
    const grid = createSvGrid({
      _features: features,
      _rowModels: {
        coreRowModel: createCoreRowModel<Node>(),
        groupedRowModel: createTreeRowModel<Node>({ parentField: 'parentId', idField: 'id' }),
        expandedRowModel: createExpandedRowModel<Node>(),
      },
      columns: [{ field: 'name', header: 'Name' }],
      data: nodes,
    } as never)

    expect(grid.getRowModel().rows.map((r) => (r.original as Node).name)).toEqual(['root'])
    const root = grid.getRowModel().rows[0]!
    expect(root.getCanExpand()).toBe(true)
    root.toggleExpanded()
    expect(grid.getRowModel().rows.map((r) => (r.original as Node).name)).toEqual([
      'root',
      'child',
    ])
  })
})

describe('QA headless: features and the function registries', () => {
  it('tableFeatures is an identity pass-through', () => {
    const input = { rowSortingFeature }
    expect(tableFeatures(input)).toBe(input)
  })

  it('a missing feature turns the column capability off, not the pipeline stage', () => {
    const noSort = createSvGrid({
      _features: tableFeatures({ columnFilteringFeature }),
      _rowModels: allRowModels(),
      columns,
      data: repos,
      state: { sorting: [{ id: 'stars', desc: false }] },
    } as never)
    const column = noSort.getAllColumns()[2]!
    // The feature decides the AFFORDANCE: no sort indicator, no header toggle.
    expect(column.getCanSort()).toBe(false)
    expect(column.getCanFilter()).toBe(true)
    // The registered stage still applies the state it was given, so a headless
    // caller who wires `createSortedRowModel` without `rowSortingFeature` gets
    // sorted rows with no way for the user to change the sort.
    expect(names(noSort)).toEqual(['jq', 'fd', 'ripgrep', 'vite', 'svelte'])

    const noFilter = createSvGrid({
      _features: tableFeatures({ rowSortingFeature }),
      _rowModels: allRowModels(),
      columns,
      data: repos,
      state: { columnFilters: [{ id: 'lang', value: 'Rust' }] },
    } as never)
    expect(noFilter.getAllColumns()[1]!.getCanFilter()).toBe(false)
    expect(names(noFilter)).toEqual(['ripgrep', 'fd'])
  })

  it('sortFns carries auto, number and date comparators', () => {
    expect(Object.keys(sortFns).sort()).toEqual(['auto', 'date', 'number'])
    expect(sortFns.auto('a', 'b')).toBeLessThan(0)
    expect(sortFns.number(2, 10)).toBeLessThan(0)
    // The lexical comparator would put '10' before '2'.
    expect(sortFns.auto(10, 2)).toBeLessThan(0)
    expect(sortFns.date('2026-01-01', '2026-06-01')).toBeLessThan(0)
  })

  it('filterFns carries includesString (the default) and equals', () => {
    expect(Object.keys(filterFns).sort()).toEqual(['equals', 'includesString'])
    expect(filterFns.includesString('TypeScript', 'script')).toBe(true)
    expect(filterFns.equals(30, 30)).toBe(true)
    expect(filterFns.equals('30', 30)).toBe(false)
  })

  it('a column filter uses includesString unless it names another fn', () => {
    const loose = makeGrid({ state: { columnFilters: [{ id: 'lang', value: 'rust' }] } })
    expect(names(loose)).toEqual(['ripgrep', 'fd'])

    const strict = makeGrid({
      state: { columnFilters: [{ id: 'lang', value: 'rust', fn: 'equals' }] },
    })
    expect(names(strict)).toEqual([])

    const exact = makeGrid({
      state: { columnFilters: [{ id: 'lang', value: 'Rust', fn: 'equals' }] },
    })
    expect(names(exact)).toEqual(['ripgrep', 'fd'])
  })

  it('an unknown filter fn falls back to the default and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      // A typo in a clause used to throw `filter.fn is not a function` from
      // inside the row model, which rendered the whole grid empty.
      const grid = makeGrid({
        state: { columnFilters: [{ id: 'lang', value: 'rust', fn: 'between' }] },
      })
      expect(names(grid)).toEqual(['ripgrep', 'fd'])
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]![0]).toContain('unknown filter fn "between"')

      // Same name again: still filters, no second warning.
      const again = makeGrid({
        state: { columnFilters: [{ id: 'lang', value: 'rust', fn: 'between' }] },
      })
      expect(names(again)).toEqual(['ripgrep', 'fd'])
      expect(warn).toHaveBeenCalledTimes(1)
    } finally {
      warn.mockRestore()
    }
  })

  it('a filter fn added to the registry at runtime is usable by name', () => {
    const registry = filterFns as Record<string, (value: unknown, query: unknown) => boolean>
    registry.startsWithQa = (value, query) =>
      String(value).toLowerCase().startsWith(String(query).toLowerCase())
    try {
      const grid = makeGrid({
        state: { columnFilters: [{ id: 'name', value: 'r', fn: 'startsWithQa' }] },
      })
      expect(names(grid)).toEqual(['ripgrep'])
    } finally {
      delete registry.startsWithQa
    }
  })
})

describe('QA headless: the no-runes entry and the reactivity helpers', () => {
  it('createSvGridCore runs the same pipeline without Svelte', () => {
    const grid = createSvGridCore({
      _features: features,
      _rowModels: allRowModels(),
      columns,
      data: repos,
      state: { sorting: [{ id: 'stars', desc: true }] },
    } as never)

    expect(grid.getRowModel().rows.map((r) => (r.original as Repo).name)).toEqual([
      'svelte',
      'vite',
      'ripgrep',
      'fd',
      'jq',
    ])
    grid.setColumnFilters([{ id: 'lang', value: 'Rust' }])
    expect(grid.getRowModel().rows).toHaveLength(2)
    // `state` on the core is the raw state object, not a reactive projection.
    expect(grid.state.columnFilters).toEqual([{ id: 'lang', value: 'Rust' }])
  })

  it('the createSvGrid selector decides what grid.state exposes', () => {
    const grid = createSvGrid(
      {
        _features: features,
        _rowModels: allRowModels(),
        columns,
        data: repos,
      } as never,
      (state: Record<string, unknown>) => ({ sorting: state.sorting }),
    )
    expect(grid.state).toEqual({ sorting: [] })
    grid.setSorting([{ id: 'name', desc: false }])
    expect(grid.state).toEqual({ sorting: [{ id: 'name', desc: false }] })
  })

  it('subscribeGrid tracks one slice from outside a component', () => {
    const grid = makeGrid()
    const selection = subscribeGrid(grid, (state: Record<string, unknown>) => state.rowSelection)
    expect(selection.current).toEqual({})
    grid.setRowSelection({ '2': true })
    expect(selection.current).toEqual({ '2': true })
  })

  it('createGridState hands back a getter / setter pair that takes an updater', () => {
    const [sorting, setSorting] = createGridState<Array<{ id: string; desc: boolean }>>([])
    expect(sorting()).toEqual([])

    setSorting([{ id: 'stars', desc: true }])
    expect(sorting()).toEqual([{ id: 'stars', desc: true }])

    setSorting((prev) => [...prev, { id: 'name', desc: false }])
    expect(sorting()).toHaveLength(2)
  })
})

describe('QA headless: the state types are usable from the main barrel', () => {
  it('types every controlled handler without reaching for the /core subpath', () => {
    const sorting: SortingState = [{ id: 'stars', desc: true }]
    const clause: ColumnFilter = { id: 'lang', value: 'Rust', fn: 'equals' }
    const columnFilters: ColumnFiltersState = [clause]
    const pagination: PaginationState = { pageIndex: 0, pageSize: 10 }
    const grouping: GroupingState = ['lang']
    const expanded: ExpandedState = { group_lang_Rust: true }
    const rowSelection: RowSelectionState = { '0': true }
    const activeCell: ActiveCellState = { rowIndex: 0, colIndex: 0, cellId: null }

    /** The exact shape a controlled consumer writes. */
    const apply = <T,>(updater: Updater<T>, prev: T): T =>
      typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater

    const options: SvGridOptions<typeof features, Repo> = {
      _features: features,
      _rowModels: allRowModels(),
      columns,
      data: repos,
      state: { sorting, columnFilters, pagination, grouping, expanded, rowSelection, activeCell },
      onSortingChange: (updater) => void apply(updater, sorting),
      onColumnFiltersChange: (updater) => void apply(updater, columnFilters),
      onPaginationChange: (updater) => void apply(updater, pagination),
      onGroupingChange: (updater) => void apply(updater, grouping),
      onExpandedChange: (updater) => void apply(updater, expanded),
      onRowSelectionChange: (updater) => void apply(updater, rowSelection),
      onActiveCellChange: (updater) => void apply(updater, activeCell),
    }

    const grid = createSvGridCore(options)
    const model: RowModel<Repo> = grid.getRowModel()
    // The Rust banner plus its two expanded children: the seeded filter,
    // grouping and expansion all applied.
    expect(model.rows.map((row) => row.id)).toEqual(['group_lang_Rust', '2', '3'])
    expect(grid.getState().grouping).toEqual(['lang'])
  })
})
