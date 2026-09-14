/**
 * Shared hover and zoom between charts in the same `syncGroup`.
 *
 * A registry of groups whose entries are `$state`, so every chart that reads
 * its group's entry re-renders when another chart in the group writes to it. Each write
 * carries the writer's token so a chart can ignore its own echoes.
 */
import type { ChartZoomWindow } from './chart-types'

/** What one chart publishes for the others: the hovered category (its label,
 *  index and, when the category parses as a date, its time) and the window. */
export type ChartSyncState = {
  hover: { label: string; index: number; time: number | null; from: symbol } | null
  zoom: { window: ChartZoomWindow | null; count: number; from: symbol; labels: [string, string] | null } | null
}

// A plain map of reactive entries: looking a group up (which a chart does
// inside a $derived) must not itself be a state mutation, so the map is not
// reactive and each entry is.
const groups = new Map<string, ChartSyncState>()

/** The live entry for a group, created on first use. */
export function syncGroupState(name: string): ChartSyncState {
  const existing = groups.get(name)
  if (existing) return existing
  const fresh = $state<ChartSyncState>({ hover: null, zoom: null })
  groups.set(name, fresh)
  return fresh
}

/** Publish a hover (or clear it with null). */
export function publishSyncHover(name: string, hover: ChartSyncState['hover']): void {
  syncGroupState(name).hover = hover
}

/** Publish a zoom window (null = the whole axis) with the axis length it
 *  was made against and the category labels at its two ends, so a chart with
 *  a different axis can map it by date. */
export function publishSyncZoom(name: string, window: ChartZoomWindow | null, count: number, from: symbol, labels: [string, string] | null = null): void {
  syncGroupState(name).zoom = { window, count, from, labels }
}
