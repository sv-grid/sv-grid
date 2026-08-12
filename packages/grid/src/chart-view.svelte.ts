/**
 * chart-view registry - the injection seam for the *chart view of the grid*.
 * Setting the `chart` prop on `<SvGrid>` swaps the table for a chart driven by
 * the grid's filtered + sorted rows. Mirrors the `board-view` / `scheduler-view`
 * seam, with one difference: the chart renderer is NOT a paid feature. The chart
 * primitive (`SvChart` / `SvGridChart`) already ships in the free `@svgrid/grid`,
 * so the grid lazy-loads a built-in default renderer (`SvGridChartView`) out of
 * the box. This seam exists only so a host (or enterprise) can *override* that
 * default with a richer renderer - it is not required for the view to work.
 *
 * ```ts
 * // optional: replace the built-in chart view with your own renderer
 * import { registerChartView } from '@svgrid/grid'
 * import MyChartView from './MyChartView.svelte'
 * registerChartView(MyChartView)
 * ```
 */
import type { Component } from 'svelte'

let renderer = $state<Component<any> | null>(null)

/** Override the built-in chart-view renderer. Optional - the grid ships a
 *  free default, so this is only for hosts that want a custom renderer. */
export function registerChartView(component: Component<any>): void {
  renderer = component
}

/** The registered chart-view override, or null to use the built-in default. */
export function getChartView(): Component<any> | null {
  return renderer
}

/** Whether a chart-view override has been registered. */
export function hasChartView(): boolean {
  return renderer != null
}
