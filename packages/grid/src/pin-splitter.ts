/**
 * The arithmetic behind the pin splitter (`pinSplitter`): where the column
 * edges are, which edge a drag lands on, and the column order that keeps
 * every column where it is on screen when the pinned set changes.
 */

/** The x of each column edge a drag can stop on: `start`, then after each column. */
export function pinEdges(start: number, widths: ReadonlyArray<number>): number[] {
  const edges = [start]
  let x = start
  for (const w of widths) edges.push((x += w))
  return edges
}

/**
 * How many columns to pin for a drag at `x`: the nearest edge, at most
 * `maxCount` columns, and never an edge past `limit` (the room the
 * unpinned columns need) unless it is the first.
 */
export function pinCountAt(edges: ReadonlyArray<number>, x: number, maxCount: number, limit: number): number {
  let best = 0
  let bestDist = Math.abs((edges[0] ?? 0) - x)
  for (let k = 1; k < edges.length && k <= maxCount; k++) {
    const e = edges[k] ?? Infinity
    if (e > limit) break
    if (Math.abs(e - x) < bestDist) {
      best = k
      bestDist = Math.abs(e - x)
    }
  }
  return best
}

/**
 * The full column order with the shown columns in `visual` order and every
 * other column (hidden ones) left in its slot, so a column that is pinned
 * or unpinned stays where it was drawn.
 */
export function orderKeepingScreen(base: ReadonlyArray<string>, visual: ReadonlyArray<string>): string[] {
  const inBase = new Set(base)
  const shown = visual.filter((id) => inBase.has(id))
  const shownSet = new Set(shown)
  let i = 0
  return base.map((id) => (shownSet.has(id) ? (shown[i++] ?? id) : id))
}
