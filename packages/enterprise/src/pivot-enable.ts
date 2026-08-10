/**
 * In-grid pivot (Pro). `enablePivot()` registers the pivot ENGINE with the grid
 * so `<SvGrid pivot={...}>` renders a pivot table in place of the flat table -
 * the same grid, aggregated with nested column headers. The engine (which turns
 * rows into a pivot result) is `createPivotModel`; the grid ships the `pivot`
 * prop + config types for free and looks the engine up through the
 * `registerPivotEngine` seam.
 *
 * Soft-gated like the rest of Enterprise: it works without a license key but the
 * grid shows the unlicensed watermark + a one-time console nudge.
 *
 * ```ts
 * import { setLicenseKey, enablePivot } from '@svgrid/enterprise'
 * setLicenseKey('YOUR-KEY')
 * enablePivot()
 * // then: <SvGrid {data} {columns} pivot={{ rows: ['region'], cols: ['quarter'], values: [{ field: 'sales', agg: 'sum' }] }} />
 * ```
 */
import { registerPivotEngine, type PivotEngine } from '@svgrid/grid'
import { isLicenseKeySet } from './license'
import { emitUnlicensedNudge } from './watermark'
import { createPivotModel, type PivotConfig } from './pivot'

let enabled = false

// The grid's `PivotEngine` seam is generic over row type; `createPivotModel` is
// the concrete implementation. Bridge them with a single boundary cast.
const pivotEngine: PivotEngine = (data, config) =>
  createPivotModel(
    data as ReadonlyArray<Record<string, unknown>>,
    config as unknown as PivotConfig<Record<string, unknown>>,
  ) as never

/**
 * Register the Enterprise pivot engine. Idempotent - safe to call from every
 * component that uses `pivot`, or once at app start. Also invoked by
 * {@link installEnterprise} so wiring the Pro API turns pivot on too.
 */
export function enablePivot(): void {
  if (enabled) return
  enabled = true
  registerPivotEngine(pivotEngine)
  if (!isLicenseKeySet()) emitUnlicensedNudge()
}
