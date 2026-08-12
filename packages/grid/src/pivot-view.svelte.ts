/**
 * pivot-engine registry - the injection seam for in-grid pivot mode. Setting the
 * `pivot` prop on `<SvGrid>` turns the live grid into a pivot table in place, but
 * the pivot ENGINE (which aggregates rows into a pivot result with nested column
 * headers) ships in `@svgrid/enterprise`. This tiny reactive holder lets
 * enterprise register that engine at import time; the grid looks it up and runs
 * it over its filtered + sorted rows, or shows an upsell placeholder when the
 * engine is absent. Mirrors the `scheduler-view` / `editor-registry` pattern.
 *
 * Unlike the scheduler (which swaps in a whole renderer component), the pivot
 * engine is a PURE function - the pivot result renders through the grid's normal
 * table + grouped-column-header path.
 *
 * ONE ENGINE, two entry points: the engine registered here is enterprise's
 * `createPivotModel`. The `pivot` prop on `<SvGrid>` (declarative, no UI) reaches
 * it through this seam; the visual `<SvPivotDesigner>` component calls the same
 * `createPivotModel` directly and adds a drag-drop field designer, heat-tinting,
 * expand/collapse and a chart view on top. Pick the prop for code-defined
 * pivots, the designer for an end-user field picker - both aggregate identically.
 *
 * ```ts
 * // in @svgrid/enterprise, at module load (via enablePivot()):
 * import { registerPivotEngine } from '@svgrid/grid'
 * import { createPivotModel } from './pivot'
 * registerPivotEngine((data, config) => createPivotModel(data, config))
 * ```
 */
import type { ColumnDef, RowData, TableFeatures } from './index'

/** One value measure in a pivot: which field, how to aggregate, how to label. */
export type GridPivotValue<TData = RowData> = {
  field: keyof TData & string
  agg?: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'countDistinct' | 'first' | 'last'
  label?: string
  format?: unknown
}

/**
 * Free-grid pivot config. Structurally compatible with enterprise `PivotConfig`
 * so the free package carries zero dependency on enterprise; the enterprise
 * config remains assignable to this.
 */
export type GridPivotConfig<TData = RowData> = {
  /** Row-axis dimensions, outer-most first. */
  rows: ReadonlyArray<keyof TData & string>
  /** Column-axis dimensions, outer-most first. */
  cols: ReadonlyArray<keyof TData & string>
  /** One or more measures aggregated under each column-axis leaf. */
  values: ReadonlyArray<GridPivotValue<TData>>
  grandTotalRow?: boolean
  grandTotalCol?: boolean
  rowSubtotals?: boolean
  colSort?: (a: unknown, b: unknown, level: number) => number
  rowSort?: (a: unknown, b: unknown, level: number) => number
}

/** A pivot row as emitted by the engine (plain object, keyed by leaf column id). */
export type GridPivotRow = Record<string, unknown> & {
  __pivotId: string
  __pivotDepth: number
  __pivotLabel: string
  __pivotParentId: string | null
  __pivotExpandable: boolean
}

/** The registered pivot engine: pure `(data, config) => { rows, columns }`. */
export type PivotEngine = <
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
>(
  data: ReadonlyArray<TData>,
  config: GridPivotConfig<TData>,
) => { rows: GridPivotRow[]; columns: Array<ColumnDef<TFeatures, GridPivotRow>> }

let engine = $state<PivotEngine | null>(null)

/** Register the pivot engine. Enterprise calls this from `enablePivot()`. */
export function registerPivotEngine(fn: PivotEngine): void {
  engine = fn
}

/** The registered pivot engine, or null when enterprise is not installed. */
export function getPivotEngine(): PivotEngine | null {
  return engine
}

/** Whether a pivot engine has been registered. */
export function hasPivotEngine(): boolean {
  return engine != null
}
