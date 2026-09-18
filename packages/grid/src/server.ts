/**
 * `@svgrid/grid/server` - the server-side data primitives, with no Svelte in
 * the import graph.
 *
 * Everything here is also on the package root. This entry point exists for
 * code that must not pull `SvGrid.svelte` into its bundle or its test
 * runner: a SvelteKit `+server.ts` shaping a `ServerRequest` into a query,
 * a worker feeding a block cache, or `@svgrid/enterprise`'s own row model,
 * whose unit tests run without the Svelte compiler.
 */
export {
  createServerDataSource,
  type ServerDataSource,
  type ServerSelectionRule,
  type ServerRequest,
  type ServerResult,
  type ServerController,
  type ServerControllerOptions,
  type ServerState,
  type ServerSortModel,
  type ServerFilterModel,
  type ServerAggregation,
  type ServerGroupRow,
  type ServerLeafRow,
  type ServerMoreRow,
  type ServerFooterRow,
  type ServerSkeletonRow,
  type ServerGrandTotalRow,
  type ServerPlaceholderRow,
  type ServerDisplayRow,
} from './server-data-source'
export {
  createBlockCache,
  createRowPlaceholder,
  rowPlaceholderState,
  type BlockCache,
  type BlockCacheOptions,
  type BlockCacheState,
  type BlockFetchResult,
  type BlockState,
} from './server-block-cache'
export {
  toServerFilterColumns,
  type GridRowModel,
  type GridFilterState,
  type GridRowModelSort,
} from './row-model'
