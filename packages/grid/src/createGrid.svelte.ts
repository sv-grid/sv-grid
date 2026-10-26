import { createSvGridCore } from './core'
import type {
  RowData,
  SvGrid,
  SvGridOptions,
  TableFeatures,
} from './core'

/**
 * The grid instance `createSvGrid` returns: the headless {@link SvGrid} plus a
 * rune-backed `state` holding whatever the selector picked out of the store.
 */
export type SvelteGrid<
  TFeatures extends TableFeatures,
  TData extends RowData,
  TSelected = {},
> = SvGrid<TData> & {
  readonly state: Readonly<TSelected>
}

/**
 * The headless engine for Svelte: the same grid `<SvGrid>` renders, without the
 * renderer, so you write the markup. Returns the instance with
 * `getHeaderGroups()`, `getRowModel()` and the `set*` writers.
 *
 * `selector` picks the slice of grid state your markup reads; it is re-run on
 * every store change and exposed as the reactive `grid.state`, so a template
 * that reads `grid.state.sorting` re-renders when sorting changes.
 *
 * @example
 * const grid = createSvGrid(
 *   {
 *     _features: tableFeatures({ rowSortingFeature }),
 *     _rowModels: { coreRowModel: createCoreRowModel(), sortedRowModel: createSortedRowModel() },
 *     data,
 *     columns,
 *   },
 *   (s) => ({ sorting: s.sorting }),
 * )
 *
 * See the "Build a table" guide (help/headless/build-a-table) for a full one.
 */
export function createSvGrid<
  TFeatures extends TableFeatures,
  TData extends RowData,
  TSelected = {},
>(
  gridOptions: SvGridOptions<TFeatures, TData>,
  selector: (state: Record<string, any>) => TSelected = () => ({}) as TSelected,
): SvelteGrid<TFeatures, TData, TSelected> {
  const grid = createSvGridCore(gridOptions) as SvelteGrid<TFeatures, TData, TSelected>
  let selected = $state(selector(grid.store.state))
  grid.store.subscribe(() => {
    selected = selector(grid.store.state)
  })

  Object.defineProperty(grid, 'state', {
    get() {
      return selected
    },
    configurable: true,
    enumerable: true,
  })

  return grid
}

/** Alias of {@link createSvGrid}. */
export const createGrid = createSvGrid
