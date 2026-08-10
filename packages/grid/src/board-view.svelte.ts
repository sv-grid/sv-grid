/**
 * board-view registry - the injection seam for the Kanban *board view of the
 * grid*. Setting the `board` prop on `<SvGrid>` switches the table for lanes of
 * cards, but the renderer itself ships in `@svgrid/enterprise` (a paid feature).
 * This tiny reactive holder lets enterprise register that renderer at import
 * time; the grid looks it up and mounts it, or shows an upsell placeholder when
 * it is absent. Mirrors the `scheduler-view` / `editor-registry` pattern.
 *
 * ```ts
 * // in @svgrid/enterprise, at module load:
 * import { registerBoardView } from '@svgrid/grid'
 * import SvGridBoard from './SvGridBoard.svelte'
 * registerBoardView(SvGridBoard)
 * ```
 */
import type { Component } from 'svelte'

let renderer = $state<Component<any> | null>(null)

/** Register the component that renders `board` mode. Enterprise calls this. */
export function registerBoardView(component: Component<any>): void {
  renderer = component
}

/** The registered board renderer, or null when enterprise is not installed. */
export function getBoardView(): Component<any> | null {
  return renderer
}

/** Whether a board renderer has been registered. */
export function hasBoardView(): boolean {
  return renderer != null
}
