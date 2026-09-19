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

/**
 * Where one task's bar sits: its two horizontal edges and its vertical centre.
 * `halfH` is half the bar's height; give it for a bar an arrow may enter
 * from above or below (a plain task bar), leave it out for one that must be
 * entered from the side (a milestone's diamond, a summary's thin spine).
 */
export type BarRect = {
  left: number
  right: number
  midY: number
  halfH?: number
  /** A milestone's diamond: `left` / `right` are its side corners. */
  kind?: 'milestone'
}

/** Which way the arrowhead points. */
export type ArrowDir = 'right' | 'left' | 'down' | 'up'

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
  /** Which way the head points: `right` / `left` into a side, `down` / `up` into an edge. */
  dir: ArrowDir
}

/** The minimum a connector stands off a bar's edge before it turns, in px. */
const STUB = 10

/**
 * Orthogonal elbow connector between two anchor points. The simple case leaves
 * the predecessor, turns once, and arrives at the successor. When the
 * successor's start is less than a stub past the predecessor's finish - a
 * backward link, or simply two tasks scheduled back to back at a coarse zoom -
 * a straight elbow would run back through a bar, so the path steps down (or
 * up) to the boundary between the two rows, runs back along it, and approaches
 * the successor from its left.
 *
 * `rowDy` is the caller's row (lane) pitch. The detour runs half of it, which
 * is the gap between the bars of two adjacent rows: a full row would land the
 * backward segment on the successor's own centre line and draw it straight
 * across the bar it is meant to point at.
 */
export function elbowPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rowDy: number,
): string {
  const p = x1 + STUB
  if (x2 >= p) return `M${x1},${y1} L${p},${y1} L${p},${y2} L${x2},${y2}`
  const q = x2 - STUB
  const half = rowDy / 2
  const midY = y2 >= y1 ? y1 + half : y1 - half
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
 *
 * Two tasks scheduled back to back - the successor starting where the
 * predecessor finishes, the everyday case in a plan - put the successor's
 * start under the stub the arrow leaves by. An elbow there has to hook back
 * on itself to reach the start edge from the left, which at a coarse zoom is
 * a scribble beside every bar. So a finish-anchored link whose successor bar
 * runs under the stub is drawn the way planners draw it: out of the
 * predecessor, across the stub, straight down (or up) into the successor's
 * edge, head pointing at the bar. The successor needs a `halfH` for that; a
 * milestone or a summary is always entered from the side.
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
    const bad = badIds.has(dep.id)
    const y1 = a.midY
    const y2 = b.midY

    if (type === 'SS') {
      // Out of the predecessor's START, leftwards, so the stub never runs
      // through its own bar; down; and into the successor's start from the
      // left. The stub stands off whichever start is further left.
      const x1 = a.left
      const x2 = b.left
      const q = Math.min(x1, x2) - STUB
      out.push({ id: dep.id, d: `M${x1},${y1} L${q},${y1} L${q},${y2} L${x2},${y2}`, bad, hx: x2, hy: y2, dir: 'right' })
      continue
    }
    if (type === 'FF') {
      // Out of the predecessor's finish, rightwards past whichever finish is
      // further right, down, and into the successor's finish from the RIGHT -
      // arriving from the left would run the length of the successor's bar.
      const x1 = a.right
      const x2 = b.right
      const p = Math.max(x1, x2) + STUB
      out.push({ id: dep.id, d: `M${x1},${y1} L${p},${y1} L${p},${y2} L${x2},${y2}`, bad, hx: x2, hy: y2, dir: 'left' })
      continue
    }
    if (type === 'SF') {
      // Out of the predecessor's start leftwards, into the successor's
      // finish from the right. Legal, the successor ends before the
      // predecessor starts and one turn does it; when it does not, step to
      // the row boundary and round.
      const x1 = a.left
      const x2 = b.right
      const q = x1 - STUB
      if (x2 + STUB <= q) {
        out.push({ id: dep.id, d: `M${x1},${y1} L${q},${y1} L${q},${y2} L${x2},${y2}`, bad, hx: x2, hy: y2, dir: 'left' })
      } else {
        const midY = y2 >= y1 ? y1 + loopDy / 2 : y1 - loopDy / 2
        const r = x2 + STUB
        out.push({
          id: dep.id,
          d: `M${x1},${y1} L${q},${y1} L${q},${midY} L${r},${midY} L${r},${y2} L${x2},${y2}`,
          bad, hx: x2, hy: y2, dir: 'left',
        })
      }
      continue
    }

    // FS, the everyday link: out of the finish, into the start.
    const x1 = a.right
    const x2 = b.left
    const p = x1 + STUB
    // A milestone that follows its predecessor: its diamond sits under the
    // stub, so the arrow drops onto the apex nearest the predecessor - a
    // straight line down from the finish - rather than hooking round to a
    // side corner.
    if (b.kind === 'milestone' && y1 !== y2) {
      const cx = (b.left + b.right) / 2
      const r = (b.right - b.left) / 2
      if (cx >= x1 - 0.5 && cx < p) {
        const below = y2 > y1
        const yApex = below ? y2 - r : y2 + r
        out.push({ id: dep.id, d: `M${x1},${y1} L${cx},${y1} L${cx},${yApex}`, bad, hx: cx, hy: yApex, dir: below ? 'down' : 'up' })
        continue
      }
    }
    // Back to back: the successor's start is under the stub, so drop into
    // its top (or rise into its bottom) rather than hook back to the start.
    if (b.halfH != null && x2 < p && y1 !== y2 && b.left <= p && p <= b.right - 3) {
      const below = y2 > y1
      const yEdge = below ? y2 - b.halfH : y2 + b.halfH
      out.push({ id: dep.id, d: `M${x1},${y1} L${p},${y1} L${p},${yEdge}`, bad, hx: p, hy: yEdge, dir: below ? 'down' : 'up' })
      continue
    }
    out.push({ id: dep.id, d: elbowPath(x1, y1, x2, y2, loopDy), bad, hx: x2, hy: y2, dir: 'right' })
  }
  return out
}

/** The arrowhead's `d` for a tip at (hx, hy) pointing `dir`: 6px long, 7px wide. */
export function arrowHeadPath(hx: number, hy: number, dir: ArrowDir): string {
  if (dir === 'down') return `M${hx},${hy} l-3.5,-6 l7,0 z`
  if (dir === 'up') return `M${hx},${hy} l-3.5,6 l7,0 z`
  if (dir === 'left') return `M${hx},${hy} l6,-3.5 l0,7 z`
  return `M${hx},${hy} l-6,-3.5 l0,7 z`
}

/** The vertices of a connector path, as `elbowPath` writes them. */
export function pathPoints(d: string): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (const m of d.matchAll(/[ML]\s*(-?[\d.]+),(-?[\d.]+)/g)) {
    out.push([Number(m[1]), Number(m[2])])
  }
  return out
}

/** Distance from a point to a polyline, in the same units. */
export function distanceToPath(points: ReadonlyArray<readonly [number, number]>, x: number, y: number): number {
  let best = Infinity
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]!
    const [bx, by] = points[i]!
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    // Where the perpendicular from the point lands on the segment, clamped to it.
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2))
    const px = ax + t * dx
    const py = ay + t * dy
    best = Math.min(best, Math.hypot(x - px, y - py))
  }
  return best
}

/**
 * The arrow under a point, if any is within `tolerance` px - how a right-click
 * on the chart body finds the link it landed on. The arrows layer takes no
 * pointer events of its own (bars have to stay draggable underneath it), so
 * the hit test is done here, on the geometry. The nearest wins when arrows
 * overlap.
 */
export function nearestArrow<T extends { d: string }>(
  arrows: ReadonlyArray<T>,
  x: number,
  y: number,
  tolerance: number,
): T | null {
  let hit: T | null = null
  let best = tolerance
  for (const a of arrows) {
    const dist = distanceToPath(pathPoints(a.d), x, y)
    if (dist <= best) {
      best = dist
      hit = a
    }
  }
  return hit
}
