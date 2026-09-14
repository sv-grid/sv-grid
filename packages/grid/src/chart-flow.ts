/**
 * Flow layouts: waterfall, funnel and sankey.
 */
import type { ChartBar, ChartLine, ChartAxisTick, ChartCategoryTick, ChartFunnelSegment, ChartSankeyNode, ChartSankeyLink, ChartGeometry, LayoutCtx } from './chart-types'
import { round, niceScale, formatChartValue, pickContrastText, DEFAULT_PALETTE } from './chart-scale'

// ---- Waterfall ----------------------------------------------------
// First series provides the values. Each non-total bar starts at the
// running cumulative sum; total bars (waterfallTotals[i]) span from 0 to
// that sum, and a total with a value of its own sets the sum to it first
// (the opening balance of a bridge, or a subtotal supplied by the caller).
// Color is derived from sign + total flag, with optional palette overrides
// via spec.waterfallColors.
/** @internal Lay out the waterfall family. Called by buildChart. */
export function layoutWaterfall(ctx: LayoutCtx): ChartGeometry {
  const { spec, series, width, height, empty, frame, axes } = ctx
  const src = series[0]
  if (!src) return { ...empty }
  const colors = spec.waterfallColors ?? {}
  const positive = colors.positive ?? '#16a34a'
  const negative = colors.negative ?? '#ef4444'
  const total    = colors.total    ?? '#475569'

  const maxLabel = spec.categories.reduce((m, c) => Math.max(m, c.length), 0)
  const padL = 48 + (axes.y.title ? 16 : 0)
  const padR = 12
  const padT = 10 + frame.top
  const plotW = Math.max(1, width - padL - padR)
  // The same rule as a bar chart: labels tilt when the widest does not fit
  // its slot. Judged by count alone, nine categories on a 900px chart were
  // flagged as rotated with no angle to go with it, and drew truncated.
  const xLabelRotated = typeof axes.x.labelRotation === 'number' ? axes.x.labelRotation !== 0 : maxLabel * 6.2 + 8 > plotW / Math.max(1, spec.categories.length)
  const xLabelAngle = typeof axes.x.labelRotation === 'number' ? axes.x.labelRotation : xLabelRotated ? -40 : 0
  const padB = (xLabelRotated ? 54 : 28) + (axes.x.title ? 16 : 0) + frame.bottom
  const plotH = Math.max(1, height - padT - padB)
  const plot = { x: padL, y: padT, w: plotW, h: plotH }

  // Compute the running cumulative + per-bar (from, to) pairs.
  const totals = spec.waterfallTotals ?? []
  const pairs: Array<{ from: number; to: number; value: number; isTotal: boolean }> = []
  let cum = 0
  spec.categories.forEach((_, i) => {
    const v = src.values[i] ?? 0
    const isTotal = !!totals[i]
    if (isTotal) {
      // An opening "Revenue 4300" is a total with a value: it anchors the
      // running sum. Read as a computed subtotal it drew as zero and every
      // bar after it hung below the axis.
      if (Number.isFinite(v) && v !== 0) cum = v
      pairs.push({ from: 0, to: cum, value: cum, isTotal: true })
    } else {
      pairs.push({ from: cum, to: cum + v, value: v, isTotal: false })
      cum += v
    }
  })
  // Y-axis domain spans every visited level (including 0).
  let dMin = 0, dMax = 0
  for (const p of pairs) {
    if (p.from < dMin) dMin = p.from
    if (p.to   < dMin) dMin = p.to
    if (p.from > dMax) dMax = p.from
    if (p.to   > dMax) dMax = p.to
  }
  const dom = niceScale(dMin, dMax)
  const yOfW = (v: number) => round(padT + plotH - ((v - dom.min) / (dom.max - dom.min || 1)) * plotH)

  const slotW = plotW / Math.max(1, spec.categories.length)
  const barPad = slotW * 0.2
  const barW = Math.max(1, slotW - barPad)
  const bars: ChartBar[] = pairs.map((p, i) => {
    const yTop = yOfW(Math.max(p.from, p.to))
    const yBot = yOfW(Math.min(p.from, p.to))
    const x = padL + slotW * i + barPad / 2
    const color = p.isTotal ? total : p.value >= 0 ? positive : negative
    return {
      x: round(x), y: yTop, w: round(barW), h: Math.max(1, yBot - yTop),
      color, label: spec.categories[i] ?? String(i), series: src.label, value: p.value, index: i,
    }
  })
  // Thin connector lines between bar tops -> running total reads cleanly.
  const connectors: ChartLine[] = [{
    path: pairs
      .map((p, i) => {
        const x0 = padL + slotW * i + barPad / 2 + barW
        const y  = yOfW(p.to)
        const x1 = padL + slotW * (i + 1) + barPad / 2
        // Skip the final connector beyond the last bar.
        return i < pairs.length - 1 ? `M${x0},${y} L${x1},${y}` : ''
      })
      .filter(Boolean)
      .join(' '),
    areaPath: '',
    color: 'var(--sg-muted, #94a3b8)',
    label: '',
    points: [],
  }]
  const xTicks: ChartCategoryTick[] = spec.categories.map((label, i) => ({
    label,
    x: round(padL + slotW * i + slotW / 2),
  }))
  const yTicks: ChartAxisTick[] = dom.ticks.map((value) => ({
    value, y: yOfW(value), label: formatChartValue(value, spec.valueFormat, spec),
  }))
  return {
    ...empty,
    plot,
    bars,
    lines: connectors,
    yTicks,
    xTicks,
    xLabelRotated,
    xLabelAngle,
  }
}

// ---- Funnel -------------------------------------------------------
// One series of strictly-decreasing values gets rendered as a stack
// of horizontal trapezoids: each level's width is proportional to its
// value relative to the largest, slope automatically links level N+1
// narrower than level N. Labels show value, conversion vs. top, and
// step drop-off.
/** @internal Lay out the funnel family. Called by buildChart. */
export function layoutFunnel(ctx: LayoutCtx): ChartGeometry {
  const { spec, series, width, height, empty, frame } = ctx
  const src = series[0]
  if (!src || !src.values.length) return { ...empty }
  const padL = 20, padR = 20, padT = 16 + frame.top, padB = 16 + frame.bottom
  const plotW = Math.max(1, width - padL - padR)
  const plotH = Math.max(1, height - padT - padB)
  const plot = { x: padL, y: padT, w: plotW, h: plotH }
  const n = src.values.length
  const stepH = plotH / n
  const valMax = Math.max(...src.values.map((v) => (Number.isFinite(v) ? v : 0)))
  const top = src.values[0] ?? 0
  const widthAt = (v: number) => (valMax > 0 ? (v / valMax) * plotW : 0)
  const cx = padL + plotW / 2
  const palette = spec.palette ?? DEFAULT_PALETTE
  const shape = spec.funnelShape ?? 'trapezoid'
  const segments: ChartFunnelSegment[] = src.values.map((v, i) => {
    const next = src.values[i + 1] ?? v * 0.8   // taper to a point on the last level
    const y0 = padT + stepH * i
    const y1 = y0 + stepH
    let path: string
    if (shape === 'pyramid') {
      // Widest at the bottom: a pyramid of levels, each a slice of one big
      // triangle. The top level is the point.
      const wTop = (plotW * i) / n
      const wBot = (plotW * (i + 1)) / n
      path = `M${cx - wTop / 2},${y0} L${cx + wTop / 2},${y0} L${cx + wBot / 2},${y1} L${cx - wBot / 2},${y1} Z`
    } else if (shape === 'cone') {
      // One triangle, sliced: the width at each level follows its share of
      // the height, so the whole funnel is a cone that tapers to a point.
      const wTop = plotW * (1 - i / n)
      const wBot = plotW * (1 - (i + 1) / n)
      path = `M${cx - wTop / 2},${y0} L${cx + wTop / 2},${y0} L${cx + wBot / 2},${y1} L${cx - wBot / 2},${y1} Z`
    } else {
      const w0 = widthAt(v)
      const w1 = widthAt(next)
      path = `M${cx - w0 / 2},${y0} L${cx + w0 / 2},${y0} L${cx + w1 / 2},${y1} L${cx - w1 / 2},${y1} Z`
    }
    const color = src.color ?? palette[i % palette.length]!
    return {
      path, color,
      label: spec.categories[i] ?? src.label,
      value: v,
      conversion: top > 0 ? v / top : 0,
      dropoff: i === 0 ? 0 : (src.values[i - 1] ?? v) > 0 ? 1 - v / (src.values[i - 1] ?? v) : 0,
      cx,
      cy: (y0 + y1) / 2,
      textColor: pickContrastText(color),
    }
  })
  return {
    ...empty,
    plot,
    funnelSegments: segments,
  }
}

// ---- Sankey -------------------------------------------------------
// Multi-column flow layout. Each node assigned to a column by longest
// path from any source. Within a column, nodes are stacked vertically;
// height proportional to max(totalIn, totalOut). Links render as
// bezier ribbons whose width is the link value (in pixels).
/** @internal Lay out the sankey family. Called by buildChart. */
export function layoutSankey(ctx: LayoutCtx): ChartGeometry {
  const { spec, width, height, empty, frame } = ctx
  const nodes = spec.sankeyNodes ?? []
  const links = spec.sankeyLinks ?? []
  if (!nodes.length || !links.length) return { ...empty }
  const padL = 10, padR = 10, padT = 14 + frame.top, padB = 14 + frame.bottom
  const plotW = Math.max(1, width - padL - padR)
  const plotH = Math.max(1, height - padT - padB)
  const plot = { x: padL, y: padT, w: plotW, h: plotH }
  const palette = spec.palette ?? DEFAULT_PALETTE
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  // Column = longest path from any node with no incoming edges.
  const targets = new Set(links.map((l) => l.target))
  const sources = nodes.filter((n) => !targets.has(n.id))
  const column = new Map<string, number>()
  function visit(id: string, depth: number, seen: Set<string>) {
    if (seen.has(id)) return
    seen.add(id)
    const cur = column.get(id) ?? 0
    if (depth > cur || !column.has(id)) column.set(id, depth)
    for (const l of links) if (l.source === id) visit(l.target, depth + 1, seen)
    seen.delete(id)
  }
  for (const s of sources) visit(s.id, 0, new Set())
  // Cover any nodes with no path from a source (orphan rings).
  for (const n of nodes) if (!column.has(n.id)) column.set(n.id, 0)
  const maxCol = Math.max(...column.values())
  const cols = maxCol + 1
  const nodeW = 14
  const gapBetweenColumns = cols > 1 ? (plotW - nodeW * cols) / (cols - 1) : 0
  // Totals per node.
  const totalIn = new Map<string, number>()
  const totalOut = new Map<string, number>()
  for (const l of links) {
    totalIn.set(l.target, (totalIn.get(l.target) ?? 0) + l.value)
    totalOut.set(l.source, (totalOut.get(l.source) ?? 0) + l.value)
  }
  // Per-column groups + max total in that column.
  const byCol: Map<number, string[]> = new Map()
  for (const n of nodes) {
    const c = column.get(n.id) ?? 0
    const arr = byCol.get(c) ?? []
    arr.push(n.id); byCol.set(c, arr)
  }
  // Per-column total height + node height scale.
  let maxColTotal = 0
  for (const ids of byCol.values()) {
    const t = ids.reduce((s, id) => s + Math.max(totalIn.get(id) ?? 0, totalOut.get(id) ?? 0), 0)
    if (t > maxColTotal) maxColTotal = t
  }
  if (maxColTotal === 0) return { ...empty, plot }
  const nodeGapPx = 8
  const heightScale = (plotH - nodeGapPx * 8) / maxColTotal  // leave gap room
  const placed: ChartSankeyNode[] = []
  for (const [c, ids] of byCol) {
    const heights = ids.map((id) => Math.max(8, Math.max(totalIn.get(id) ?? 0, totalOut.get(id) ?? 0) * heightScale))
    const totalH = heights.reduce((s, h) => s + h, 0) + nodeGapPx * (ids.length - 1)
    let yCursor = padT + (plotH - totalH) / 2
    const xCol = padL + c * (nodeW + gapBetweenColumns)
    ids.forEach((id, idx) => {
      const node = nodeById.get(id)!
      const h = heights[idx]!
      placed.push({
        id,
        label: node.label ?? id,
        color: node.color ?? palette[(placed.length) % palette.length]!,
        x: xCol, y: yCursor, w: nodeW, h,
        column: c,
        totalIn: totalIn.get(id) ?? 0,
        totalOut: totalOut.get(id) ?? 0,
      })
      yCursor += h + nodeGapPx
    })
  }
  const placedById = new Map(placed.map((n) => [n.id, n]))
  // Per-node sub-cursor so multiple links from one node stack vertically.
  const inCursor = new Map<string, number>()
  const outCursor = new Map<string, number>()
  const builtLinks: ChartSankeyLink[] = []
  // Sort links so wider ribbons render first (so thin ribbons stack on top).
  const sortedLinks = links.slice().sort((a, b) => b.value - a.value)
  for (const link of sortedLinks) {
    const a = placedById.get(link.source)
    const b = placedById.get(link.target)
    if (!a || !b) continue
    const linkH = Math.max(1, link.value * heightScale)
    const aY = a.y + (outCursor.get(a.id) ?? 0) + linkH / 2
    const bY = b.y + (inCursor.get(b.id) ?? 0) + linkH / 2
    outCursor.set(a.id, (outCursor.get(a.id) ?? 0) + linkH)
    inCursor.set(b.id, (inCursor.get(b.id) ?? 0) + linkH)
    const x0 = a.x + a.w
    const x1 = b.x
    const mid = (x0 + x1) / 2
    const path = `M${x0},${aY} C${mid},${aY} ${mid},${bY} ${x1},${bY}`
    builtLinks.push({
      path, color: link.color ?? a.color, width: linkH,
      source: link.source, target: link.target, value: link.value,
    })
  }
  return { ...empty, plot, sankeyNodes: placed, sankeyLinks: builtLinks }
}
