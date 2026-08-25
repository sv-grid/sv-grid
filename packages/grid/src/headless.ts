/**
 * The headless entry point: `@svgrid/grid/core`.
 *
 * Everything here is the grid's state machine - rows, columns, sorting,
 * filtering, grouping, pagination, expansion, selection - and nothing here
 * touches the DOM, ARIA, or CSS. Import from this subpath when you are writing
 * your own renderer, running the engine under SSR, or unit-testing row models
 * without a browser.
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
