/**
 * selection-bar-view registry - the injection seam for the bulk-action bar that
 * floats over the grid while rows are selected. `<SvGrid selectionBar={...}>`
 * and its config types ship in the free grid, but the BAR itself is a paid
 * feature in `@svgrid/enterprise`. This tiny reactive holder lets enterprise
 * register the renderer at import time; the grid looks it up and mounts it, or
 * shows an upsell placeholder when it is absent.
 *
 * Same shape as `scheduler-view` and `board-view`, deliberately: three seams
 * that behave differently would be three things to learn.
 *
 * ```ts
 * // in @svgrid/enterprise, at module load:
 * import { registerSelectionBarView } from '@svgrid/grid'
 * import SvGridSelectionBar from './SvGridSelectionBar.svelte'
 * registerSelectionBarView(SvGridSelectionBar)
 * ```
 */
import type { Component } from 'svelte'

let renderer = $state<Component<any> | null>(null)

/** Register the component that renders the selection bar. Enterprise calls this. */
export function registerSelectionBarView(component: Component<any>): void {
  renderer = component
}

/** The registered selection-bar renderer, or null when enterprise is not installed. */
export function getSelectionBarView(): Component<any> | null {
  return renderer
}

/** Whether a selection-bar renderer has been registered. */
export function hasSelectionBarView(): boolean {
  return renderer != null
}
