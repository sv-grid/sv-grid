/**
 * Hierarchy layouts: the squarified tree-map.
 */
import type { ChartTreemapCell, TreeNode, ChartGeometry, LayoutCtx } from './chart-types'
import { round, pickContrastText, DEFAULT_PALETTE } from './chart-scale'

// ---- Tree-map -----------------------------------------------------
// Squarified tree-map (Bruls et al. 2000): each level recursively
// partitions its rectangle in proportion to its children, picking the
// split orientation that keeps aspect ratios closest to 1.
/** @internal Lay out the treemap family. Called by buildChart. */
export function layoutTreemap(ctx: LayoutCtx): ChartGeometry {
  const { spec, width, height, empty, frame } = ctx
  const root = spec.treemap ?? spec.tree
  if (!root) return { ...empty }
  const padL = 4, padR = 4, padT = 4 + frame.top, padB = 4 + frame.bottom
  const plotW = Math.max(1, width - padL - padR)
  const plotH = Math.max(1, height - padT - padB)
  const plot = { x: padL, y: padT, w: plotW, h: plotH }
  const palette = spec.palette ?? DEFAULT_PALETTE
  const cells: ChartTreemapCell[] = []
  function totalOf(n: TreeNode): number {
    if (n.children?.length) return n.children.reduce((s, c) => s + totalOf(c), 0)
    return Math.max(0, n.value ?? 0)
  }
  function squarify(items: TreeNode[], x: number, y: number, w: number, h: number, depth: number) {
    if (!items.length || w <= 0 || h <= 0) return
    const totals = items.map(totalOf)
    const sum = totals.reduce((a, b) => a + b, 0)
    if (sum <= 0) return
    // Process largest-first so big items dominate the first row.
    const ordered = items
      .map((n, i) => ({ node: n, value: totals[i]! }))
      .sort((a, b) => b.value - a.value)
    let cx = x, cy = y, cw = w, ch = h, remaining = sum
    let row: typeof ordered = []
    const worstRatio = (vals: number[], shortSide: number, rowSum: number, scale: number): number => {
      if (rowSum <= 0) return Infinity
      const rowArea = rowSum * scale
      const rowSide = rowArea / shortSide
      let worst = 0
      for (const v of vals) {
        const cell = v * scale
        const long = cell / rowSide
        const r = Math.max(shortSide / long, long / shortSide)
        if (r > worst) worst = r
      }
      return worst
    }
    function flushRow() {
      if (!row.length) return
      const rowSum = row.reduce((a, b) => a + b.value, 0)
      const scale = (cw * ch) / remaining
      const horizontal = cw >= ch
      const shortSide = horizontal ? ch : cw
      const rowSide = (rowSum * scale) / shortSide
      let offset = 0
      for (const it of row) {
        const cellSize = (it.value * scale) / rowSide
        const cx2 = horizontal ? cx : cx + offset
        const cy2 = horizontal ? cy + offset : cy
        const ww  = horizontal ? rowSide : cellSize
        const hh  = horizontal ? cellSize : rowSide
        const color = it.node.color ?? palette[(depth + cells.length) % palette.length]!
        // Leaf: emit a cell. Branch: recurse into the rect minus a label gutter.
        if (it.node.children?.length) {
          cells.push({
            x: round(cx2), y: round(cy2), w: round(ww), h: round(hh),
            color, textColor: pickContrastText(color),
            name: it.node.name, value: it.value, depth,
          })
          const labelH = Math.min(18, hh * 0.25)
          squarify(it.node.children, cx2 + 1, cy2 + labelH, ww - 2, hh - labelH - 1, depth + 1)
        } else {
          cells.push({
            x: round(cx2), y: round(cy2), w: round(ww), h: round(hh),
            color, textColor: pickContrastText(color),
            name: it.node.name, value: it.value, depth,
          })
        }
        offset += cellSize
      }
      // Shrink the remaining strip.
      if (horizontal) { cx += rowSide; cw -= rowSide } else { cy += rowSide; ch -= rowSide }
      remaining -= rowSum
      row = []
    }
    for (const it of ordered) {
      const scale = (cw * ch) / remaining
      const shortSide = Math.min(cw, ch)
      const rowSum = row.reduce((a, b) => a + b.value, 0)
      const currWorst = worstRatio(row.map((r) => r.value), shortSide, rowSum, scale)
      const nextWorst = worstRatio([...row.map((r) => r.value), it.value], shortSide, rowSum + it.value, scale)
      if (row.length && nextWorst > currWorst) {
        flushRow()
      }
      row.push(it)
    }
    flushRow()
  }
  const seedItems = root.children ?? [root]
  squarify(seedItems, padL, padT, plotW, plotH, 0)
  return { ...empty, plot, treemapCells: cells }
}

/**
 * The subtree at `path` (a list of node names from the root's children down),
 * or the tree itself for an empty path. What a drilldown shows after each
 * click: the clicked node becomes the root. Null when the path does not exist.
 */
export function drillTree(tree: TreeNode, path: ReadonlyArray<string>): TreeNode | null {
  let node: TreeNode | undefined = tree
  for (const name of path) {
    node = node?.children?.find((c) => c.name === name)
    if (!node) return null
  }
  return node ?? null
}

/**
 * The path (node names from the root's children) to the first node called
 * `name`, depth first, or null. What a click on a leaf's label needs.
 */
export function pathTo(tree: TreeNode, name: string): string[] | null {
  const walk = (n: TreeNode, acc: string[]): string[] | null => {
    for (const c of n.children ?? []) {
      const next = [...acc, c.name]
      if (c.name === name) return next
      const deeper = walk(c, next)
      if (deeper) return deeper
    }
    return null
  }
  return walk(tree, [])
}
