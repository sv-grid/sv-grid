/**
 * gantt-view registry - the injection seam for the *Gantt view of the grid*.
 * Setting the `gantt` prop on `<SvGrid>` switches the table for a task table
 * beside a time chart (bars by start / end, a work-breakdown tree, dependency
 * arrows), but the renderer itself ships in `@svgrid/enterprise` (a paid
 * feature). This tiny reactive holder lets enterprise register that renderer at
 * import time; the grid looks it up and mounts it, or shows an upsell
 * placeholder when it is absent. Mirrors the `scheduler-view` / `board-view`
 * pattern.
 *
 * ```ts
 * // in @svgrid/enterprise, at module load:
 * import { registerGanttView } from '@svgrid/grid'
 * import SvGridGantt from './gantt/SvGridGantt.svelte'
 * registerGanttView(SvGridGantt)
 * ```
 */
import type { Component } from 'svelte'

let renderer = $state<Component<any> | null>(null)

/** Register the component that renders `gantt` mode. Enterprise calls this. */
export function registerGanttView(component: Component<any>): void {
  renderer = component
}

/** The registered Gantt renderer, or null when enterprise is not installed. */
export function getGanttView(): Component<any> | null {
  return renderer
}

/** Whether a Gantt renderer has been registered. */
export function hasGanttView(): boolean {
  return renderer != null
}
