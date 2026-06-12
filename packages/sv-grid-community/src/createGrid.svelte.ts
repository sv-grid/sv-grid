import { createSvGridCore } from './core'
import type {
  RowData,
  SvGrid,
  SvGridOptions,
  TableFeatures,
} from './core'

export type SvelteGrid<
  TFeatures extends TableFeatures,
  TData extends RowData,
  TSelected = {},
> = SvGrid<TData> & {
  readonly state: Readonly<TSelected>
}

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

export const createGrid = createSvGrid
