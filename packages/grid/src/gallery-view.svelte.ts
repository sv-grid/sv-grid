/**
 * gallery-view registry - the injection seam for the *gallery view of the
 * grid*. Setting the `gallery` prop on `<SvGrid>` switches the table for a wall
 * of cards (a cover image, a title, a few fields), but the renderer ships in
 * `@svgrid/enterprise`. Enterprise registers it at import time; the grid looks
 * it up and mounts it, or shows an upsell note when it is absent. Same model as
 * `board-view` and `scheduler-view`.
 *
 * ```ts
 * // in @svgrid/enterprise, at module load:
 * import { registerGalleryView } from '@svgrid/grid'
 * import SvGridGallery from './SvGridGallery.svelte'
 * registerGalleryView(SvGridGallery)
 * ```
 */
import type { Component } from 'svelte'

let renderer = $state<Component<any> | null>(null)

/** Register the component that renders `gallery` mode. Enterprise calls this. */
export function registerGalleryView(component: Component<any>): void {
  renderer = component
}

/** The registered gallery renderer, or null when enterprise is not installed. */
export function getGalleryView(): Component<any> | null {
  return renderer
}

/** Whether a gallery renderer has been registered. */
export function hasGalleryView(): boolean {
  return renderer != null
}
