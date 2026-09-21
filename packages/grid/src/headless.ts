/**
 * The headless entry point: `@svgrid/grid/core`.
 *
 * Everything here is the grid's state machine - rows, columns, sorting,
 * filtering, grouping, pagination, expansion, selection - and nothing here
 * touches the DOM, ARIA, or CSS. Import from this subpath when you are writing
 * your own renderer, running the engine under SSR, or unit-testing row models
 * without a browser.
 *
 * Two entry functions, and the difference matters outside a bundler:
 * `createSvGrid` is the Svelte 5 wrapper - it holds its state in runes, so it
 * needs the Svelte compiler in the pipeline (Vite, SvelteKit, vitest). Bare
 * `node script.mjs` cannot run it. `createSvGridCore` is the same engine with
 * no runes and no reactivity, so it runs anywhere Node runs: a service, a
 * worker, a CLI, a plain unit test.
 *
 * Every runtime symbol here is also reachable from the main `@svgrid/grid`
 * barrel, so the two paths never disagree. This entry additionally exposes the
 * low-level types a custom renderer needs and the barrel does not re-export
 * (`RowModelFactory`, `Store`, `createSvGridCore`, and the individual state
 * types), and it makes the headless bundle cost measurable instead of leaving
 * it to tree-shaking a 200+ export barrel.
 *
 * See docs/why-headless.md.
 */

export {
  columnFilteringFeature,
  columnGroupingFeature,
  createCoreRowModel,
  createExpandedRowModel,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  createTreeRowModel,
  createSvGridCore,
  flattenTreeData,
  applyGroupAggregate,
  filterFns,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  type Cell,
  type CellContext,
  type CellSpanParams,
  type ValueParserParams,
  type EditorContext,
  type CellData,
  type ActiveCellState,
  type CellFormatConfig,
  type CellFormatter,
  type Column,
  type ColumnDef,
  type ColumnDefTemplate,
  type ColumnFilter,
  type ColumnFiltersState,
  type ExpandedState,
  type GridColumnDef,
  type GridColumns,
  type GroupAggregator,
  type GroupingState,
  type Header,
  type HeaderContext,
  type HeaderGroup,
  type PaginationState,
  type Row,
  type RowData,
  type RowModel,
  type RowModelFactory,
  type RowSelectionState,
  type SortingState,
  type Store,
  type SvGrid as SvGridInstance,
  type SvGridOptions,
  type TableFeatures,
  type TreeRowModelOptions,
  type FlattenTreeOptions,
  type Updater,
} from './core'

export { createGrid, createSvGrid, type SvelteGrid } from './createGrid.svelte'
export { createGridState, createSvGridState } from './createGridState.svelte'
export { subscribeGrid, subscribeSvGrid } from './subscribe'

// The virtualizers are pure window arithmetic (scroll offset in, visible
// range out) with no DOM of their own, and a custom renderer over 50k rows
// needs one. They were only on the barrel, so the Headless demos imported
// the barrel to reach them and paid for the whole thing.
export { createVirtualizer } from './virtualization/virtualizer'
export { createSvelteVirtualizer } from './virtualization/svelte-virtualizer.svelte'
export { createColumnVirtualizer } from './virtualization/column-virtualizer'
export type { VirtualItem, VirtualizerOptions, VirtualizerState } from './virtualization/types'

// The WAI-ARIA attribute factories: plain objects to spread onto your own
// markup (`role`, `aria-sort`, `aria-rowindex`, ...). No DOM is touched here
// either; a custom renderer that wants keyboard navigation reads
// `activeCell` from the store and spreads these.
export {
  getGridCellDomId,
  getGridCellA11yProps,
  getGridHeaderA11yProps,
  getGridRootA11yProps,
  getGridRowA11yProps,
  type GridCellA11yInput,
  type GridColumnA11yInput,
  type GridSortDirection,
} from './a11y'
