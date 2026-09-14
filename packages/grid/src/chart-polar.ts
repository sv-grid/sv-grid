/**
 * Polar layouts: pie / donut, radar, the gauge dial, and the arc family
 * (sunburst, radial bar / column, nightingale, chord).
 */
import type { ChartArc, ChartChordRibbon, ChartRadarAxis, ChartRadarSeries, ChartGaugeLayout, ChartPieSlice, ChartGeometry, LayoutCtx, TreeNode } from './chart-types'
import { round, DEFAULT_PALETTE, axisScale, pickContrastText, sampleGradient } from './chart-scale'

// ---- Radar --------------------------------------------------------
// Polar coordinates: each `category` is a spoke (axis); each `series`
// contributes a polygon connecting its values across the spokes. All
// series share the same scale (max across every value). Concentric
// ring count derived from data, capped at 5 for legibility.
/** @internal Lay out the radar family. Called by buildChart. */
export function layoutRadar(ctx: LayoutCtx): ChartGeometry {
  const { spec, series, width, height, empty, frame } = ctx
  if (!series.length || !spec.categories.length) return { ...empty }
  const padL = 30, padR = 30, padT = 24 + frame.top, padB = 24 + frame.bottom
  const plotW = Math.max(1, width - padL - padR)
  const plotH = Math.max(1, height - padT - padB)
  const plot = { x: padL, y: padT, w: plotW, h: plotH }
  const cx = padL + plotW / 2
  const cy = padT + plotH / 2
  const r = Math.max(20, Math.min(plotW, plotH) / 2 - 20)
  const axes = spec.categories
  const k = axes.length
  let vMax = 0
  for (const s of series) for (const v of s.values) {
    if (Number.isFinite(v) && v > vMax) vMax = v
  }
  if (vMax === 0) vMax = 1
  // The rim is the data maximum unless `yAxis.min` / `max` pin it, the way
  // every value axis is pinned: scores out of 100 then fill the dial to the
  // same rim on every chart, and a point past the rim sits on it.
  const vMin = spec.yAxis?.min ?? 0
  const vTop = spec.yAxis?.max ?? Math.max(vMax, vMin + 1)
  const span = vTop > vMin ? vTop - vMin : 1
  const ringCount = 5
  const ringValues = Array.from({ length: ringCount }, (_, i) => vMin + ((i + 1) / ringCount) * span)
  /** Convert (axis index, value) to (x, y). Angles start at 12 o'clock,
   *  proceed clockwise so axes lay out left-to-right when k <= 4. */
  const angleAt = (i: number) => -Math.PI / 2 + (i / k) * Math.PI * 2
  const pointAt = (i: number, v: number) => {
    const t = Math.max(0, Math.min(1, (v - vMin) / span))
    const a = angleAt(i)
    return { x: round(cx + r * t * Math.cos(a)), y: round(cy + r * t * Math.sin(a)) }
  }
  const radarAxes: ChartRadarAxis[] = axes.map((label, i) => {
    const p = pointAt(i, vTop)
    return { label, x: p.x, y: p.y }
  })
  const radarSeriesGeo: ChartRadarSeries[] = series.map((s, si) => {
    const pts = s.values.map((v, i) => {
      const safe = Number.isFinite(v) ? v : vMin
      const p = pointAt(i, safe)
      return { x: p.x, y: p.y, value: v, axis: axes[i] ?? '' }
    })
    const path = pts.length
      ? pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'
      : ''
    const palette = spec.palette ?? DEFAULT_PALETTE
    return { label: s.label, color: s.color ?? palette[si % palette.length]!, path, points: pts }
  })
  return {
    ...empty,
    plot,
    radarRings: ringValues,
    radarAxes,
    radarSeries: radarSeriesGeo,
    radarCenter: { cx, cy, r },
  }
}

// ---- Gauge --------------------------------------------------------
// Semicircle dial: track arc + value arc + optional colored range bands
// + optional target tick. Reads spec.gaugeValue / gaugeMin / gaugeMax.
/** @internal Lay out the gauge family. Called by buildChart. */
export function layoutGauge(ctx: LayoutCtx): ChartGeometry {
  const { spec, width, height, empty, frame } = ctx
  const min = spec.gaugeMin ?? 0
  const max = spec.gaugeMax ?? 100
  const value = Math.max(min, Math.min(max, spec.gaugeValue ?? 0))
  const target = spec.gaugeTarget
  const cx = width / 2
  const innerH = Math.max(1, height - frame.top - frame.bottom)
  const cy = frame.top + innerH * 0.78
  const r = Math.min(width * 0.42, innerH * 0.65)
  // Start angle 180deg, end 360deg (drawn clockwise from 9 o'clock to 3).
  const A0 = Math.PI
  const A1 = 2 * Math.PI
  const angleAt = (v: number) => A0 + ((v - min) / (max - min || 1)) * (A1 - A0)
  const arc = (a0: number, a1: number, radius: number): string => {
    const x1 = cx + radius * Math.cos(a0)
    const y1 = cy + radius * Math.sin(a0)
    const x2 = cx + radius * Math.cos(a1)
    const y2 = cy + radius * Math.sin(a1)
    const large = a1 - a0 > Math.PI ? 1 : 0
    return `M${x1},${y1} A${radius},${radius} 0 ${large} 1 ${x2},${y2}`
  }
  const trackPath = arc(A0, A1, r)
  const valuePath = arc(A0, angleAt(value), r)
  // Bands sit on their own inner ring, well clear of the value arc's 16px
  // stroke at `r`. They are context, not the reading: a band covering most
  // of the scale (an error-rate dial where anything above 0.45 is red) used
  // to out-shout the value arc completely, so the dial looked pegged at
  // maximum when the actual value was 9 percent.
  const rangePaths = (spec.gaugeRanges ?? []).map((band) => ({
    path: arc(angleAt(band.from), angleAt(band.to), r - 16),
    color: band.color, from: band.from, to: band.to,
  }))
  let targetPx: ChartGaugeLayout['target'] = null
  if (target != null && Number.isFinite(target)) {
    const a = angleAt(Math.max(min, Math.min(max, target)))
    const inner = r - 12
    const outer = r + 4
    targetPx = {
      x1: cx + inner * Math.cos(a), y1: cy + inner * Math.sin(a),
      x2: cx + outer * Math.cos(a), y2: cy + outer * Math.sin(a),
    }
  }
  // Tick marks just outside the track: a major tick every 1/4 of the scale,
  // with 4 minor ticks between each. Gives the dial a measured, instrument feel.
  const ticks: ChartGaugeLayout['ticks'] = []
  const TICK_MAJOR = 4, TICK_MINOR = 5, TICK_TOTAL = TICK_MAJOR * TICK_MINOR
  for (let i = 0; i <= TICK_TOTAL; i++) {
    const a = A0 + (i / TICK_TOTAL) * (A1 - A0)
    const major = i % TICK_MINOR === 0
    const inner = r + 9
    const outer = r + (major ? 17 : 13)
    ticks.push({
      x1: cx + inner * Math.cos(a), y1: cy + inner * Math.sin(a),
      x2: cx + outer * Math.cos(a), y2: cy + outer * Math.sin(a),
      major,
    })
  }
  // Pointer needle: a kite (long tip toward the value, short counterweight
  // tail) pivoting on a center hub.
  //
  // The proportions matter more than they look, and the counterweight was the
  // whole problem. A tail sticking out past the hub is a short, solid triangle;
  // the pointer is a 130px taper that thins to nothing. The compact shape wins
  // the eye, so on a near-full dial the needle read as an arrow pointing at the
  // MINIMUM. Keeping the tail inside the hub radius removes the competing
  // point without giving up the pivot, and the shoulders sit outside the hub so
  // the needle actually has a visible base to taper from.
  const aV = angleAt(value)
  const tipR = r - 14, tailR = 5, baseR = 9
  const aPerp = aV + Math.PI / 2
  const pt = (rad: number, ang: number) => `${round(cx + rad * Math.cos(ang))},${round(cy + rad * Math.sin(ang))}`
  const needlePath =
    `M${pt(baseR, aPerp)} L${pt(tipR, aV)} L${pt(baseR, aPerp + Math.PI)} L${pt(tailR, aV + Math.PI)} Z`
  // Color the value arc by the band the value currently sits in.
  // First match wins, and bands are half-open [from, to). Bands normally
  // share endpoints - green 0..0.3, amber 0.3..0.45, red 0.45..5 - and with
  // an inclusive `to` plus last-match-wins, a value sitting exactly ON a
  // boundary took the colour of the band ABOVE it. An error rate of 0.45
  // against a 0.45 amber ceiling read as red.
  let valueColor: string | null = null
  const bands = spec.gaugeRanges ?? []
  for (const band of bands) {
    if (value >= band.from && value < band.to) { valueColor = band.color; break }
  }
  // The very top of the scale belongs to the last band that reaches it,
  // which the half-open test above would otherwise exclude.
  if (valueColor == null) {
    for (const band of bands) if (value >= band.from && value <= band.to) valueColor = band.color
  }
  return {
    ...empty,
    plot: { x: 0, y: 0, w: width, h: height },
    gauge: {
      cx, cy, r, trackPath, valuePath, rangePaths, target: targetPx,
      ticks, needle: { path: needlePath, hubR: 6 }, valueColor,
      minLabel: { x: cx - r, y: cy + 20 },
      maxLabel: { x: cx + r, y: cy + 20 },
      value, min, max, unit: spec.gaugeUnit ?? '',
    },
  }
}

/** @internal Lay out the pie family. Called by buildChart. */
export function layoutPie(ctx: LayoutCtx): ChartGeometry {
  const { spec, series, empty, width, height, palette, frame } = ctx
  const s = series[0]
  if (!s) return empty
  const total = s.values.reduce((a, b) => a + Math.max(0, b), 0) || 1
  const innerH = Math.max(1, height - frame.top - frame.bottom)
  const cy = frame.top + innerH / 2
  // Callout labels need a margin round the pie for the leaders and the text:
  // 34px above and below, and on each side the leader's horizontal run plus
  // the widest label the callouts will write THERE (the label truncated to 18
  // characters, a space and the percentage, at about 6.3px a character). The
  // side is the slice's mid angle, which depends on the values alone. Sized
  // by the widest label on either side, a pie whose small slices all sat on
  // the left kept the same room on the right for a "Chrome 62%" and drew at
  // half the radius the pane had; the pie now sits centred in what the two
  // gutters leave. Without the text in the sum at all, a pie in a narrow
  // pane pushed its labels past the edge and the reader saw "%" and a letter.
  const callouts = spec.dataLabels?.placement === 'outside' && spec.dataLabels.show !== false
  let leftW = 0
  let rightW = 0
  if (callouts) {
    let a = -Math.PI / 2
    spec.categories.forEach((c, i) => {
      const frac = Math.max(0, s.values[i] ?? 0) / total
      const mid = a + (frac * Math.PI * 2) / 2
      a += frac * Math.PI * 2
      if (frac < 0.015) return
      const w = (Math.min(c.length, 18) + 4) * 6.3
      if (Math.cos(mid) >= 0) rightW = Math.max(rightW, w)
      else leftW = Math.max(leftW, w)
    })
  }
  const leftGutter = callouts ? 22 + 4 + leftW : 10
  const rightGutter = callouts ? 22 + 4 + rightW : 10
  // The pie keeps at least a quarter of the short side; when the labels want
  // more than that leaves, they are truncated to what fits instead.
  const minR = Math.max(12, Math.min(width, innerH) * 0.25)
  const room = (width - leftGutter - rightGutter) / 2
  const r = Math.max(minR, Math.min(innerH / 2 - (callouts ? 34 : 10), room))
  // Centred in the room the gutters leave. When even the floor radius does
  // not fit between them, the pie sits in the middle and both sides truncate
  // to what is left, rather than one side keeping its text and the other
  // running off the edge.
  const cx = callouts && room >= r ? leftGutter + room : width / 2
  const innerFrac = Math.min(0.9, Math.max(0, spec.innerRadius ?? 0))
  const ir = r * innerFrac
  let angle = -Math.PI / 2
  const slices: ChartPieSlice[] = s.values.map((v, i) => {
    const frac = Math.max(0, v) / total
    const a0 = angle
    const a1 = angle + frac * Math.PI * 2
    angle = a1
    const large = a1 - a0 > Math.PI ? 1 : 0
    const mid = (a0 + a1) / 2
    const labelR = (r + ir) / 2 || r * 0.6
    const ox0 = cx + r * Math.cos(a0)
    const oy0 = cy + r * Math.sin(a0)
    const ox1 = cx + r * Math.cos(a1)
    const oy1 = cy + r * Math.sin(a1)
    let path: string
    if (frac >= 0.999) {
      path = ir
        ? `M${round(cx - r)},${round(cy)} A${r},${r} 0 1 1 ${round(cx + r)},${round(cy)} A${r},${r} 0 1 1 ${round(cx - r)},${round(cy)} Z` +
          `M${round(cx - ir)},${round(cy)} A${ir},${ir} 0 1 0 ${round(cx + ir)},${round(cy)} A${ir},${ir} 0 1 0 ${round(cx - ir)},${round(cy)} Z`
        : `M${round(cx - r)},${round(cy)} A${r},${r} 0 1 1 ${round(cx + r)},${round(cy)} A${r},${r} 0 1 1 ${round(cx - r)},${round(cy)} Z`
    } else if (ir > 0) {
      const ix0 = cx + ir * Math.cos(a0)
      const iy0 = cy + ir * Math.sin(a0)
      const ix1 = cx + ir * Math.cos(a1)
      const iy1 = cy + ir * Math.sin(a1)
      path =
        `M${round(ox0)},${round(oy0)} A${r},${r} 0 ${large} 1 ${round(ox1)},${round(oy1)} ` +
        `L${round(ix1)},${round(iy1)} A${ir},${ir} 0 ${large} 0 ${round(ix0)},${round(iy0)} Z`
    } else {
      path = `M${round(cx)},${round(cy)} L${round(ox0)},${round(oy0)} A${r},${r} 0 ${large} 1 ${round(ox1)},${round(oy1)} Z`
    }
    const catLabel = spec.categories[i] ?? String(i)
    return {
      path,
      // The same precedence as a bar: a category colour, then the series'
      // per-point colour (a tree node's, say), then the palette.
      color: spec.categoryColors?.[catLabel] ?? s.colors?.[i] ?? palette[i % palette.length]!,
      label: catLabel,
      value: v,
      percent: frac * 100,
      cx: round(cx + labelR * Math.cos(mid)),
      cy: round(cy + labelR * Math.sin(mid)),
      arc: { a0, a1, r, ir, cx, cy },
    }
  })
  if (callouts) layoutPieCallouts(slices, cx, cy, r, frame.top, frame.top + innerH, width)
  return {
    ...empty,
    slices,
    legend: spec.categories.map((label, i) => ({ label, color: spec.categoryColors?.[label] ?? s.colors?.[i] ?? palette[i % palette.length]! })),
    donut: ir > 0 ? { cx: round(cx), cy: round(cy), r: round(ir), total: s.values.reduce((a, b) => a + Math.max(0, b), 0) } : null,
  }
}

/**
 * Callout labels round a pie: a short leader from the slice's edge along its
 * mid-angle, a horizontal run, then the text outside. Labels on each side are
 * pushed apart from the top down so they never overlap, and a sliver under
 * 1.5% gets no callout at all (its leader would land on a neighbour's).
 */
function layoutPieCallouts(slices: ChartPieSlice[], cx: number, cy: number, r: number, top: number, bottom: number, width: number): void {
  const GAP = 13
  // Characters of label that fit between the leader's run and the edge on
  // each side, less the " NN%" the renderer appends; at least four so a name
  // is recognisable.
  const charsFor = (room: number) => Math.max(4, Math.floor((room - r - 26) / 6.3) - 4)
  const maxCharsRight = charsFor(width - cx)
  const maxCharsLeft = charsFor(cx)
  const sides: Array<{ slice: ChartPieSlice; mid: number; ty: number; right: boolean }> = []
  for (const slice of slices) {
    if (!slice.arc || slice.percent < 1.5) continue
    const mid = (slice.arc.a0 + slice.arc.a1) / 2
    sides.push({ slice, mid, ty: cy + Math.sin(mid) * (r + 16), right: Math.cos(mid) >= 0 })
  }
  for (const right of [true, false]) {
    const list = sides.filter((c) => c.right === right).sort((a, b) => a.ty - b.ty)
    // Push down from the top, then back up from the bottom, so a crowded side
    // spreads out rather than piling below the plot.
    for (let k = 1; k < list.length; k += 1) list[k]!.ty = Math.max(list[k]!.ty, list[k - 1]!.ty + GAP)
    const floor = bottom - 6
    for (let k = list.length - 1; k >= 0; k -= 1) {
      const limit = k === list.length - 1 ? floor : list[k + 1]!.ty - GAP
      list[k]!.ty = Math.min(list[k]!.ty, limit)
    }
    for (const c of list) if (c.ty < top + 6) c.ty = top + 6
    for (const c of list) {
      const x1 = cx + Math.cos(c.mid) * (r + 2)
      const y1 = cy + Math.sin(c.mid) * (r + 2)
      const x2 = cx + Math.cos(c.mid) * (r + 12)
      const y2 = c.ty
      const x3 = right ? cx + r + 22 : cx - r - 22
      c.slice.callout = {
        x1: round(x1), y1: round(y1), x2: round(x2), y2: round(y2), x3: round(x3),
        tx: round(x3 + (right ? 4 : -4)), ty: round(c.ty), anchor: right ? 'start' : 'end',
        maxChars: right ? maxCharsRight : maxCharsLeft,
      }
    }
  }
}

// ---- Arcs ---------------------------------------------------------
// The one path builder every new polar type shares. Angles are radians,
// clockwise, with 12 o'clock at -PI/2 (the convention the pie already uses).

/**
 * An annular sector from angle `a0` to `a1` between radii `r0` and `r1`, as
 * an SVG path. `r0 = 0` gives a wedge; a span of a full turn gives a ring.
 * Exposed so a custom mark can match the built-in polar types exactly.
 */
export function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const TAU = Math.PI * 2
  const span = Math.max(0, Math.min(TAU, a1 - a0))
  if (span <= 0 || r1 <= 0) return ''
  const px = (r: number, a: number) => `${round(cx + r * Math.cos(a))},${round(cy + r * Math.sin(a))}`
  if (span >= TAU - 1e-6) {
    // Two half-arcs, because a single arc cannot describe a full circle.
    const outer = `M${px(r1, a0)} A${round(r1)},${round(r1)} 0 1 1 ${px(r1, a0 + Math.PI)} A${round(r1)},${round(r1)} 0 1 1 ${px(r1, a0)} Z`
    if (r0 <= 0) return outer
    return `${outer} M${px(r0, a0)} A${round(r0)},${round(r0)} 0 1 0 ${px(r0, a0 + Math.PI)} A${round(r0)},${round(r0)} 0 1 0 ${px(r0, a0)} Z`
  }
  const large = span > Math.PI ? 1 : 0
  if (r0 <= 0) {
    return `M${round(cx)},${round(cy)} L${px(r1, a0)} A${round(r1)},${round(r1)} 0 ${large} 1 ${px(r1, a1)} Z`
  }
  return (
    `M${px(r1, a0)} A${round(r1)},${round(r1)} 0 ${large} 1 ${px(r1, a1)} ` +
    `L${px(r0, a1)} A${round(r0)},${round(r0)} 0 ${large} 0 ${px(r0, a0)} Z`
  )
}

/** The centre of the plot and the largest radius that fits, after the frame. */
function polarBox(ctx: LayoutCtx, pad = 24) {
  const { width, height, frame } = ctx
  const innerH = Math.max(1, height - frame.top - frame.bottom)
  const cx = width / 2
  const cy = frame.top + innerH / 2
  const r = Math.max(10, Math.min(width, innerH) / 2 - pad)
  return { cx, cy, r, plot: { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r } }
}

/** A tint of `color` for a deeper ring: towards white on a light surface,
 *  towards the dark surface on a dark one. */
function tint(color: string, depth: number, theme: 'light' | 'dark'): string {
  if (depth <= 0) return color
  return sampleGradient([color, theme === 'dark' ? '#111827' : '#ffffff'], Math.min(0.6, depth * 0.22))
}

const START = -Math.PI / 2
const TAU = Math.PI * 2

// ---- Sunburst -----------------------------------------------------
// A radial treemap: the root's children share the first ring in proportion to
// their totals, each child's children share that child's angular span in the
// next ring out, and so on. Colour follows the top-level branch, tinted per
// depth, so a whole limb of the hierarchy reads as one hue.
/** @internal Lay out the sunburst family. Called by buildChart. */
export function layoutSunburst(ctx: LayoutCtx): ChartGeometry {
  const { spec, empty, palette, theme } = ctx
  const root = spec.tree ?? spec.treemap
  if (!root) return { ...empty }
  const { cx, cy, r, plot } = polarBox(ctx, 12)
  const totalOf = (n: TreeNode): number =>
    n.children?.length ? n.children.reduce((s, c) => s + totalOf(c), 0) : Math.max(0, n.value ?? 0)
  const depthOf = (n: TreeNode): number => (n.children?.length ? 1 + Math.max(...n.children.map(depthOf)) : 0)
  const seed = root.children ?? [root]
  const total = seed.reduce((s, c) => s + totalOf(c), 0)
  if (total <= 0) return { ...empty, plot }
  const depth = Math.max(1, depthOf({ name: '', children: seed }))
  const innerFrac = Math.min(0.6, Math.max(0, spec.innerRadius ?? 0.18))
  const r0 = r * innerFrac
  const ringW = (r - r0) / depth
  const arcs: ChartArc[] = []
  const walk = (nodes: TreeNode[], a0: number, a1: number, d: number, color: string | null, path: string[]) => {
    const sum = nodes.reduce((s, c) => s + totalOf(c), 0)
    if (sum <= 0) return
    let a = a0
    nodes.forEach((n, i) => {
      const v = totalOf(n)
      if (v <= 0) return
      const span = ((a1 - a0) * v) / sum
      const c = n.color ?? (d === 0 ? palette[i % palette.length]! : color!)
      const fill = d === 0 ? c : tint(c, d, theme)
      const ri = r0 + ringW * d
      const ro = ri + ringW - 1
      const mid = a + span / 2
      const lr = (ri + ro) / 2
      const nodePath = [...path, n.name]
      arcs.push({
        path: arcPath(cx, cy, ri, ro, a, a + span),
        color: fill,
        textColor: pickContrastText(fill),
        label: n.name,
        series: path[path.length - 1] ?? '',
        value: v,
        a0: a,
        a1: a + span,
        r0: ri,
        r1: ro,
        cx,
        cy,
        depth: d,
        nodePath,
        lx: round(cx + lr * Math.cos(mid)),
        ly: round(cy + lr * Math.sin(mid)),
      })
      if (n.children?.length) walk(n.children, a, a + span, d + 1, c, nodePath)
      a += span
    })
  }
  walk(seed, START, START + TAU, 0, null, [])
  return {
    ...empty,
    plot,
    arcs,
    legend: seed.map((n, i) => ({ label: n.name, color: n.color ?? palette[i % palette.length]! })),
    donut: r0 > 0 ? { cx: round(cx), cy: round(cy), r: round(r0), total } : null,
  }
}

// ---- Radial bar ---------------------------------------------------
// One ring per category (per series), sweeping clockwise from 12 o'clock by
// value over the largest value. A faint full track behind each ring shows
// the scale. The first category is the innermost ring.
/** @internal Lay out the radial bar family. Called by buildChart. */
export function layoutRadialBar(ctx: LayoutCtx): ChartGeometry {
  const { spec, series, empty, palette } = ctx
  if (!series.length || !spec.categories.length) return { ...empty }
  const { cx, cy, r, plot } = polarBox(ctx, 12)
  let vMax = 0
  for (const s of series) for (const v of s.values) if (Number.isFinite(v) && v > vMax) vMax = v
  if (vMax <= 0) vMax = 1
  const n = spec.categories.length
  const rings = n * series.length
  const innerFrac = Math.min(0.6, Math.max(0, spec.innerRadius ?? 0.2))
  const r0 = r * innerFrac
  const ringW = (r - r0) / Math.max(1, rings)
  const gap = Math.min(3, ringW * 0.2)
  const arcs: ChartArc[] = []
  for (let i = 0; i < n; i += 1) {
    series.forEach((s, si) => {
      const v = s.values[i]
      // A zero (a hidden category, or no data) draws nothing rather than an
      // empty path, so the ring simply disappears the way a pie slice does.
      if (!Number.isFinite(v) || (v as number) <= 0) return
      const k = i * series.length + si
      const ri = r0 + ringW * k + gap / 2
      const ro = ri + ringW - gap
      const span = Math.min(TAU * 0.9999, (Math.max(0, v as number) / vMax) * TAU)
      const color = series.length === 1 ? (spec.categoryColors?.[spec.categories[i]!] ?? s.colors?.[i] ?? palette[i % palette.length]!) : s.colors?.[i] ?? s.color
      const mid = START + span / 2
      const lr = (ri + ro) / 2
      arcs.push({
        path: arcPath(cx, cy, ri, ro, START, START + span),
        trackPath: arcPath(cx, cy, ri, ro, START, START + TAU),
        color,
        textColor: pickContrastText(color),
        label: spec.categories[i]!,
        series: s.label,
        value: v as number,
        a0: START,
        a1: START + span,
        r0: ri,
        r1: ro,
        cx,
        cy,
        lx: round(cx + lr * Math.cos(mid)),
        ly: round(cy + lr * Math.sin(mid)),
      })
    })
  }
  return {
    ...empty,
    plot,
    arcs,
    legend: series.length === 1
      ? spec.categories.map((label, i) => ({ label, color: spec.categoryColors?.[label] ?? palette[i % palette.length]! }))
      : empty.legend,
  }
}

// ---- Radial column / nightingale ----------------------------------
// Bars on a polar axis: each category owns an angular slot, each series a
// sub-slot (grouped) or a radial layer (stacked). Radius follows the value
// through nice rings, which the renderer draws as the axis. A nightingale
// (Florence's rose) is the same with area-proportional radii (sqrt of the
// value) and no gap between the petals, so a value twice as big looks twice
// as big rather than four times.
/** @internal Lay out the radial column and nightingale families. Called by buildChart. */
export function layoutRadialColumn(ctx: LayoutCtx): ChartGeometry {
  const { spec, series, empty, palette, stacked } = ctx
  if (!series.length || !spec.categories.length) return { ...empty }
  const rose = spec.type === 'nightingale'
  const { cx, cy, r, plot } = polarBox(ctx, 22)
  const n = spec.categories.length
  const stack = stacked || (rose && series.length > 1)
  // Domain over values, or stacked totals.
  let vMax = 0
  if (stack) {
    for (let i = 0; i < n; i += 1) {
      let t = 0
      for (const s of series) t += Number.isFinite(s.values[i]) ? Math.max(0, s.values[i]!) : 0
      if (t > vMax) vMax = t
    }
  } else {
    for (const s of series) for (const v of s.values) if (Number.isFinite(v) && v > vMax) vMax = v
  }
  const dom = axisScale(0, vMax > 0 ? vMax : 1, spec.yAxis ?? {})
  const innerFrac = Math.min(0.5, Math.max(0, spec.innerRadius ?? (rose ? 0 : 0.12)))
  const r0 = r * innerFrac
  const radiusOf = (v: number) => {
    const t = Math.max(0, Math.min(1, (v - dom.min) / (dom.max - dom.min || 1)))
    return r0 + (r - r0) * (rose ? Math.sqrt(t) : t)
  }
  const slot = TAU / n
  const pad = rose ? 0 : slot * 0.15
  const arcs: ChartArc[] = []
  for (let i = 0; i < n; i += 1) {
    const s0 = START + slot * i + pad / 2
    const s1 = START + slot * (i + 1) - pad / 2
    if (stack) {
      let cum = 0
      series.forEach((s) => {
        const v = s.values[i]
        if (!Number.isFinite(v) || (v as number) <= 0) return
        const ri = radiusOf(cum)
        cum += v as number
        const ro = radiusOf(cum)
        const color = series.length === 1 ? (spec.categoryColors?.[spec.categories[i]!] ?? s.colors?.[i] ?? palette[i % palette.length]!) : s.colors?.[i] ?? s.color
        const mid = (s0 + s1) / 2
        const lr = (ri + ro) / 2
        arcs.push({ path: arcPath(cx, cy, ri, ro, s0, s1), color, textColor: pickContrastText(color), label: spec.categories[i]!, series: s.label, value: v as number, a0: s0, a1: s1, r0: ri, r1: ro, cx, cy, lx: round(cx + lr * Math.cos(mid)), ly: round(cy + lr * Math.sin(mid)) })
      })
    } else {
      const sub = (s1 - s0) / series.length
      series.forEach((s, si) => {
        const v = s.values[i]
        if (!Number.isFinite(v) || (v as number) <= 0) return
        const a0 = s0 + sub * si
        const a1 = a0 + sub * (series.length > 1 ? 0.92 : 1)
        const ro = radiusOf(v as number)
        const color = series.length === 1 ? (spec.categoryColors?.[spec.categories[i]!] ?? s.colors?.[i] ?? palette[i % palette.length]!) : s.colors?.[i] ?? s.color
        const mid = (a0 + a1) / 2
        const lr = (r0 + ro) / 2
        arcs.push({ path: arcPath(cx, cy, r0, ro, a0, a1), color, textColor: pickContrastText(color), label: spec.categories[i]!, series: s.label, value: v as number, a0, a1, r0, r1: ro, cx, cy, lx: round(cx + lr * Math.cos(mid)), ly: round(cy + lr * Math.sin(mid)) })
      })
    }
  }
  const polarAxes: ChartRadarAxis[] = !ctx.axes.x.labels ? [] : spec.categories.map((label, i) => {
    const a = START + slot * i + slot / 2
    const lr = r + 10
    return { label, x: round(cx + lr * Math.cos(a)), y: round(cy + lr * Math.sin(a)) }
  })
  return {
    ...empty,
    plot,
    arcs,
    polarAxes,
    polarRings: dom.ticks.filter((t) => t > dom.min).map((t) => radiusOf(t)),
    radarCenter: { cx, cy, r },
    legend: series.length === 1
      ? spec.categories.map((label, i) => ({ label, color: spec.categoryColors?.[label] ?? palette[i % palette.length]! }))
      : empty.legend,
  }
}

// ---- Chord --------------------------------------------------------
// Flows between groups round a circle. Each node gets an arc proportional to
// everything flowing in or out of it; each link a ribbon from its sub-span on
// the source arc to its sub-span on the target arc, coloured by the source.
/** @internal Lay out the chord family. Called by buildChart. */
export function layoutChord(ctx: LayoutCtx): ChartGeometry {
  const { spec, empty, palette } = ctx
  const nodes = spec.sankeyNodes ?? []
  const links = (spec.sankeyLinks ?? []).filter((l) => Number.isFinite(l.value) && l.value > 0)
  if (!nodes.length || !links.length) return { ...empty }
  const { cx, cy, r, plot } = polarBox(ctx, 28)
  const totals = new Map<string, number>()
  for (const l of links) {
    totals.set(l.source, (totals.get(l.source) ?? 0) + l.value)
    if (l.target !== l.source) totals.set(l.target, (totals.get(l.target) ?? 0) + l.value)
  }
  const ordered = nodes.filter((n) => (totals.get(n.id) ?? 0) > 0)
  const grand = ordered.reduce((s, n) => s + (totals.get(n.id) ?? 0), 0)
  if (grand <= 0) return { ...empty, plot }
  const padAngle = Math.min(0.06, TAU / (ordered.length * 8))
  const usable = TAU - padAngle * ordered.length
  const ringW = Math.max(8, r * 0.09)
  const rInner = r - ringW
  const arcs: ChartArc[] = []
  const span = new Map<string, { a0: number; a1: number; cursor: number; color: string }>()
  let a = START
  ordered.forEach((n, i) => {
    const t = totals.get(n.id) ?? 0
    const s = (usable * t) / grand
    const color = n.color ?? palette[i % palette.length]!
    span.set(n.id, { a0: a, a1: a + s, cursor: a, color })
    const mid = a + s / 2
    const lr = r + 12
    arcs.push({
      path: arcPath(cx, cy, rInner, r, a, a + s),
      color,
      textColor: pickContrastText(color),
      label: n.label ?? n.id,
      series: '',
      value: t,
      a0: a,
      a1: a + s,
      r0: rInner,
      r1: r,
      cx,
      cy,
      lx: round(cx + lr * Math.cos(mid)),
      ly: round(cy + lr * Math.sin(mid)),
    })
    a += s + padAngle
  })
  // Sub-spans: outgoing links first on the source, then incoming on the target,
  // each consuming an angle proportional to its value.
  const px = (rad: number, ang: number) => `${round(cx + rad * Math.cos(ang))},${round(cy + rad * Math.sin(ang))}`
  const chordRibbons: ChartChordRibbon[] = []
  const take = (id: string, value: number) => {
    const g = span.get(id)
    if (!g) return null
    const w = ((g.a1 - g.a0) * value) / (totals.get(id) ?? 1)
    const out = { a0: g.cursor, a1: g.cursor + w }
    g.cursor += w
    return out
  }
  const sorted = links.slice().sort((x, y) => y.value - x.value)
  for (const l of sorted) {
    const s = take(l.source, l.value)
    const t = l.target === l.source ? s : take(l.target, l.value)
    if (!s || !t) continue
    const largeS = s.a1 - s.a0 > Math.PI ? 1 : 0
    const largeT = t.a1 - t.a0 > Math.PI ? 1 : 0
    const path =
      `M${px(rInner, s.a0)} A${round(rInner)},${round(rInner)} 0 ${largeS} 1 ${px(rInner, s.a1)} ` +
      `Q${round(cx)},${round(cy)} ${px(rInner, t.a0)} A${round(rInner)},${round(rInner)} 0 ${largeT} 1 ${px(rInner, t.a1)} ` +
      `Q${round(cx)},${round(cy)} ${px(rInner, s.a0)} Z`
    chordRibbons.push({ path, color: l.color ?? span.get(l.source)!.color, source: l.source, target: l.target, value: l.value })
  }
  return {
    ...empty,
    plot,
    arcs,
    chordRibbons,
    legend: ordered.map((n, i) => ({ label: n.label ?? n.id, color: n.color ?? palette[i % palette.length]! })),
  }
}
