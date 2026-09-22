/**
 * gantt (view) - registers the Enterprise Gantt renderer with the grid so
 * `<SvGrid gantt={...}>` renders a task table beside a time chart instead of
 * the table. The grid ships the `gantt` prop and its config types for free; the
 * *renderer* (SvGridGantt) is Pro and plugs in through the grid's
 * `registerGanttView` seam.
 *
 * Like the rest of Enterprise it runs without a license key during the
 * evaluation; the grid shows the watermark and a one-time console notice.
 *
 * ```ts
 * import { setLicenseKey, enableGanttView } from '@svgrid/enterprise'
 * setLicenseKey('YOUR-KEY')
 * enableGanttView()
 * // then: <SvGrid {data} {columns} gantt={{ startField: 'start', endField: 'end' }} />
 * ```
 */
import { registerGanttView } from '@svgrid/grid'
import { isLicenseKeySet } from '../license'
import { emitUnlicensedNudge } from '../watermark'
import SvGridGantt from './SvGridGantt.svelte'

let enabled = false

/**
 * Register the Enterprise Gantt view. Idempotent - safe to call from every
 * component that uses `gantt`, or once at app start. Also invoked by
 * {@link installEnterprise} so wiring the Pro API turns the view on too.
 */
export function enableGanttView(): void {
  if (enabled) return
  enabled = true
  registerGanttView(SvGridGantt as never)
  if (!isLicenseKeySet()) emitUnlicensedNudge()
}

export { default as SvGridGantt } from './SvGridGantt.svelte'
