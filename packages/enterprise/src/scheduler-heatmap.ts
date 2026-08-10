/**
 * scheduler-heatmap - the pure core behind Scheduler Pro's *utilization heatmap*.
 * No Svelte, no DOM. Distinct from the histogram (a bar strip): the heatmap tints
 * a resource row's BACKGROUND per time-bucket by how loaded that resource is.
 *
 * The renderer computes each bucket's load (with `resourceLoad` / `overlapCount`
 * from the assignment / model helpers) and passes it here to get a normalized
 * intensity (0..1) + an over-capacity flag per cell; it then paints the cell with
 * a theme colour at that intensity.
 */

/** One background cell: its axis geometry + normalized load intensity. */
export type HeatCell = {
  leftPct: number
  widthPct: number
  /** 0..1, load scaled against `peak` (clamped). */
  intensity: number
  /** True when the raw load exceeds capacity. */
  over: boolean
}

/**
 * Build the per-tick heat cells for one resource row. `ticks` supply the axis
 * geometry, `loads` the load in each tick (same length/order), `capacity` the
 * resource's capacity (over that = `over`), and `peak` the normalization scale
 * (usually a global peak so rows are comparable). Zero-load ticks are still
 * emitted (intensity 0) so the caller can decide whether to paint them.
 */
export function heatCells(
  ticks: ReadonlyArray<{ leftPct: number; widthPct: number }>,
  loads: ReadonlyArray<number>,
  capacity: number,
  peak: number,
): HeatCell[] {
  const scale = Math.max(peak, capacity, 1)
  const out: HeatCell[] = []
  for (let i = 0; i < ticks.length; i++) {
    const t = ticks[i]!
    const load = loads[i] ?? 0
    out.push({
      leftPct: t.leftPct,
      widthPct: t.widthPct,
      intensity: Math.max(0, Math.min(1, load / scale)),
      over: load > capacity + 1e-9,
    })
  }
  return out
}

/** The peak load across a set of per-resource load rows (for a shared scale). */
export function heatPeak(loadRows: ReadonlyArray<ReadonlyArray<number>>, floor = 1): number {
  let peak = floor
  for (const row of loadRows) for (const v of row) if (v > peak) peak = v
  return peak
}
