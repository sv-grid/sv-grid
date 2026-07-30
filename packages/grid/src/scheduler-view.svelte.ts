/**
 * scheduler-view registry - the injection seam for the calendar / scheduler
 * *view of the grid*. Setting the `scheduler` prop on `<SvGrid>` switches the
 * table for a calendar, but the renderer itself ships in `@svgrid/enterprise`
 * (a paid feature). This tiny reactive holder lets enterprise register that
 * renderer at import time; the grid looks it up and mounts it, or shows an
 * upsell placeholder when it is absent. Mirrors the `editor-registry` pattern.
 *
 * ```ts
 * // in @svgrid/enterprise, at module load:
 * import { registerSchedulerView } from '@svgrid/grid'
 * import SvGridScheduler from './SvGridScheduler.svelte'
 * registerSchedulerView(SvGridScheduler)
 * ```
 */
import type { Component } from 'svelte'

let renderer = $state<Component<any> | null>(null)

/** Register the component that renders `scheduler` mode. Enterprise calls this. */
export function registerSchedulerView(component: Component<any>): void {
  renderer = component
}

/** The registered scheduler renderer, or null when enterprise is not installed. */
export function getSchedulerView(): Component<any> | null {
  return renderer
}

/** Whether a scheduler renderer has been registered. */
export function hasSchedulerView(): boolean {
  return renderer != null
}
