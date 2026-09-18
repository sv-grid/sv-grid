/**
 * timeline-arrows - the pure geometry behind dependency arrows, shared by the
 * Scheduler's timeline views and the Gantt chart. No Svelte, no DOM: bar
 * rectangles in, SVG path strings out.
 *
 * This lived inside SvGridScheduler.svelte until the Gantt needed the same
 * elbows. Two copies of a connector routine is how two views end up drawing
 * the same link differently, so it moved here and both call it.
 *
 * Coordinates are pixels in the lane area's own space (the caller offsets past
 * any resource gutter), y is the vertical centre of a bar.
 */
import type { DependencyType } from '../scheduler-dependencies'

/** Where one task's bar sits: its two horizontal edges and its vertical centre. */
export type BarRect = { left: number; right: number; midY: number }

/** One drawn arrow: the elbow path, plus the arrowhead's tip and whether the
 *  link is currently violated (drawn dashed / red by the caller). */
export type Arrow = {
  id: string
  /** The `d` of the connector path. */
  d: string
  bad: boolean
  /** Arrowhead tip x. */
  hx: number
  /** Arrowhead tip y. */
  hy: number
}

/** The minimum a connector stands off a bar's edge before it turns, in px. */
const STUB = 10

/**
 * Orthogonal elbow connector between two anchor points. The simple case leaves
 * the predecessor, turns once, and arrives at the successor. When the
 * successor sits to the LEFT of the predecessor (a backward, and usually
 * violated, link) a straight elbow would run back through the bar it came
 * from, so the path detours by `loopDy` px vertically and approaches from the
 * far side.
 */
export function elbowPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  loopDy: number,
): string {
  const p = x1 + STUB
  if (x2 >= p) return `M${x1},${y1} L${p},${y1} L${p},${y2} L${x2},${y2}`
  const q = x2 - STUB
  const midY = y2 >= y1 ? y1 + loopDy : y1 - loopDy
  return `M${x1},${y1} L${p},${y1} L${p},${midY} L${q},${midY} L${q},${y2} L${x2},${y2}`
}

/** The link shape a dependency needs, structurally shared by the scheduler's
 *  `SchedulerDependency` and the grid's `GanttDependency`. */
export type ArrowLink = {
  id: string
  from: string
  to: string
  type?: DependencyType
}

/**
 * One arrow per link whose BOTH ends have a rectangle in `rects`. A link
 * pointing at a row that is filtered out (or inside a collapsed subtree the
 * caller did not re-anchor) simply has no arrow - it is not an error.
 *
 * The link type picks which edges to join: the predecessor's start for `SS` /
 * `SF` and its finish otherwise, the successor's finish for `FF` / `SF` and
 * its start otherwise.
 */
export function dependencyArrows(
  rects: ReadonlyMap<string, BarRect>,
  links: ReadonlyArray<ArrowLink>,
  badIds: ReadonlySet<string>,
  loopDy: number,
): Arrow[] {
  const out: Arrow[] = []
  for (const dep of links) {
    const a = rects.get(dep.from)
    const b = rects.get(dep.to)
    if (!a || !b) continue
    const type = dep.type ?? 'FS'
    const x1 = type === 'SS' || type === 'SF' ? a.left : a.right
    const x2 = type === 'FF' || type === 'SF' ? b.right : b.left
    out.push({
      id: dep.id,
      d: elbowPath(x1, a.midY, x2, b.midY, loopDy),
      bad: badIds.has(dep.id),
      hx: x2,
      hy: b.midY,
    })
  }
  return out
}
