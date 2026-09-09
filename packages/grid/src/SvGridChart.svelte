<script lang="ts">
  /**
   * SvGridChart - renders a `ChartSpec` as inline SVG. Supports grouped +
   * stacked bars, line, area, pie / donut, combo charts (per-series type),
   * a secondary Y axis, signed Y domains, and axis titles. Interactive: a
   * unified crosshair tooltip (hover a category -> all series at once),
   * focus tooltips, a clickable legend that toggles series, optional data
   * labels, and an `onSelect` drill hook. No external charting dependency.
   */
  import { buildChart, DEFAULT_PALETTE, formatChartValue, sliceChartWindow, type ChartSpec, type ChartSelection } from './chart'

  type Props = {
    spec: ChartSpec
    /** Show the (clickable) legend. Default true. */
    legend?: boolean
    /** Enable tooltips + crosshair + legend toggling. Default true. */
    interactive?: boolean
    /** Draw the value on each bar / point / slice. Default false. */
    dataLabels?: boolean
    /** Format a value for tooltips, data labels, AND Y-axis ticks. */
    formatValue?: (value: number) => string
    /** Fired when a category / slice is clicked (drill into the grid). */
    onSelect?: (selection: ChartSelection) => void
    /** Like `onSelect`, but only fires when the spec carries `rowIds` and
     *  includes them in the payload. Use this to filter / highlight the
     *  source grid when the user clicks a chart element. */
    onDrill?: (selection: ChartSelection) => void
    /** Allow drag-to-zoom on the plot area. Double-click resets.
     *  Only meaningful for cartesian charts (not pie). Default false. */
    zoomable?: boolean
    /** Show a compact brush / mini-map under the main chart. A draggable
     *  window selects what the main chart shows. Pairs naturally with
     *  `zoomable`. Default false. */
    brush?: boolean
    /** Height of the brush strip in pixels. Default 88. */
    brushHeight?: number
    /** Show a small toolbar above the chart: reset-zoom (when zoomed) and
     *  export (PNG / SVG / copy). Default true when zoomable or onDrill is
     *  set, otherwise false. Set to `false` to hide explicitly. */
    toolbar?: boolean
    /** Explicit chart pixel size (viewBox). When set, the chart lays out to
     *  fit exactly - used by the docked panel to size the chart to its body. */
    width?: number
    height?: number
  }
  let {
    spec,
    legend = true,
    interactive = true,
    dataLabels = false,
    formatValue,
    onSelect,
    onDrill,
    zoomable = false,
    brush = false,
    brushHeight = 88,
    toolbar,
    width,
    height,
  }: Props = $props()
  const showToolbar = $derived(toolbar ?? (zoomable || !!onDrill))

  const fmt = (v: number) =>
    formatValue
      ? formatValue(v)
      : spec.valueFormat
        ? formatChartValue(v, spec.valueFormat, spec)
        : Number.isFinite(v)
          ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
          : String(v)

  let hidden = $state(new Set<string>())
  // Isolate: double-clicking a legend chip shows ONLY that series/slice.
  let isolated = $state<string | null>(null)
  // Series colours read from --sg-chart-1..8. Declared here because the
  // palette derivation below reads it, and a rune used above its declaration
  // is an error rather than a hoist. Filled by the theme effect further down.
  let tokenPalette = $state<string[] | null>(null)

  // Hover-dim: hovering a legend chip dims the other series (visual only).
  let dimmed = $state<string | null>(null)
  // An explicit `spec.palette` is the author speaking about THIS chart, so it
  // outranks the theme's tokens, which in turn outrank the built-in colours.
  const palette = $derived(spec.palette ?? tokenPalette ?? DEFAULT_PALETTE)
  const uid = `svgc-${Math.random().toString(36).slice(2, 8)}`

  const coloredSeries = $derived(
    spec.series.map((s, i) => ({ ...s, color: s.color ?? palette[i % palette.length]! })),
  )
  /** Resolve effective pattern per series: explicit > cycle (when
   *  patternFallback is on) > 'solid'. Cycle skips 'solid' so every series
   *  ends up with a distinct texture. */
  const seriesPatterns = $derived(
    spec.series.map((s, i): string => {
      if (s.pattern) return s.pattern
      if (spec.patternFallback) return ['stripe', 'crosshatch', 'dots', 'diagonal'][i % 4]!
      return 'solid'
    }),
  )
  /** Map from series label to fill string used in SVG (either the plain
   *  color or `url(#pattern-id)`). */
  const seriesFill = $derived.by<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    coloredSeries.forEach((s, i) => {
      const p = seriesPatterns[i]
      out[s.label] = p === 'solid' || !p ? s.color : `url(#${uid}-pat-${i})`
    })
    return out
  })
  /** Pattern <defs> to emit. Each entry pairs a unique id with the series
   *  color so the pattern carries the right hue baked in. */
  const patternDefs = $derived(
    coloredSeries
      .map((s, i) => ({ id: `${uid}-pat-${i}`, color: s.color, kind: seriesPatterns[i] ?? 'solid' }))
      .filter((d) => d.kind !== 'solid'),
  )

  // Effective hidden set = manual toggles, unless a series is isolated (then
  // everything else is hidden).
  const effectiveHidden = $derived.by(() => {
    if (isolated == null) return hidden
    const labels = spec.type === 'pie' ? spec.categories : spec.series.map((s) => s.label)
    return new Set(labels.filter((l) => l !== isolated))
  })

  // ---- Zoom state ------------------------------------------------------
  // `zoom` holds inclusive integer category indices [i0, i1] of the visible
  // window. null = no zoom (show everything). Pie charts don't support
  // zoom; their pseudo-categories are slices, not an axis.
  let zoom = $state<{ i0: number; i1: number } | null>(null)
  const isZoomed = $derived(zoom !== null)
  function resetZoom() { zoom = null }

  // Drag-to-zoom: track pointer in SVG-local coordinates so the overlay
  // rect aligns with what the user is actually selecting on screen.
  let svgEl: SVGSVGElement | null = $state(null)
  let dragStart = $state<{ x: number; y: number } | null>(null)
  let dragEnd   = $state<{ x: number; y: number } | null>(null)
  const dragRect = $derived.by(() => {
    if (!dragStart || !dragEnd) return null
    const x = Math.min(dragStart.x, dragEnd.x)
    const y = Math.min(dragStart.y, dragEnd.y)
    const w = Math.abs(dragEnd.x - dragStart.x)
    const h = Math.abs(dragEnd.y - dragStart.y)
    return w > 4 && h > 4 ? { x, y, w, h } : null
  })

  function svgPoint(e: PointerEvent): { x: number; y: number } | null {
    if (!svgEl) return null
    const r = svgEl.getBoundingClientRect()
    return {
      x: ((e.clientX - r.left) / r.width)  * geo.width,
      y: ((e.clientY - r.top)  / r.height) * geo.height,
    }
  }
  /** Clamp a point's main-axis coordinate to an integer category index. */
  function pointToCatIndex(p: { x: number; y: number }): number {
    const coord = isHorizontal ? (p.y - geo.plot.y) : (p.x - geo.plot.x)
    const idx = Math.floor(coord / slot)
    return Math.max(0, Math.min(visibleSpec.categories.length - 1, idx))
  }
  function onZoomDown(e: PointerEvent) {
    if (!zoomable || !isCartesian) return
    const p = svgPoint(e)
    if (!p) return
    // Only start a drag inside the plot rect.
    if (p.x < geo.plot.x || p.x > geo.plot.x + geo.plot.w ||
        p.y < geo.plot.y || p.y > geo.plot.y + geo.plot.h) return
    dragStart = p
    dragEnd = p
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  function onZoomMove(e: PointerEvent) {
    if (!dragStart) return
    dragEnd = svgPoint(e)
  }
  function onZoomUp() {
    if (!dragStart || !dragEnd) { dragStart = null; dragEnd = null; return }
    const r = dragRect
    if (r) {
      // Map the drag's main-axis bounds to category indices. When already
      // zoomed, these indices are relative to the visible slice, so
      // translate back to the original `spec.categories` indexing.
      const i0v = pointToCatIndex({ x: r.x, y: r.y })
      const i1v = pointToCatIndex({ x: r.x + r.w, y: r.y + r.h })
      const offset = zoom ? zoom.i0 : 0
      const lo = offset + Math.min(i0v, i1v)
      const hi = offset + Math.max(i0v, i1v)
      if (hi > lo) zoom = { i0: lo, i1: hi }
    }
    dragStart = null
    dragEnd = null
  }
  function onPlotDblClick() {
    if (zoomable && isZoomed) resetZoom()
  }

  // Candles are cartesian, and the `isCartesian` negative list below already
  // covers them, so they inherit gridlines, the crosshair, category hit bands,
  // keyboard nav, drag-zoom and double-click reset with no new wiring.
  // Declared up here because the brush spec reads it, and a `$derived` used
  // above its declaration is an error rather than a hoist.
  const isCandle = $derived(spec.type === 'candlestick' || spec.type === 'ohlc')
  /** OHLC draws ticks off a vertical; candlestick draws a body and a wick. */
  const isOhlcBars = $derived(spec.type === 'ohlc')

  // ---- Brush state -----------------------------------------------------
  // The brush is a compact second chart showing the FULL data range with
  // a translucent window over the visible slice. Dragging the body pans
  // the window; dragging either edge resizes one side. Eligible for
  // cartesian charts only (heatmap / pie don't have a single x-axis).
  const brushEligible = $derived(brush && spec.type !== 'pie' && spec.type !== 'heatmap')
  // Build a separate geometry from the un-zoomed spec at brushHeight.
  const brushSpec = $derived<ChartSpec>({
    ...spec,
    height: brushHeight,
    // Mute axes in the brush by clearing titles + reference lines.
    yAxisTitle: undefined, y2AxisTitle: undefined, xAxisTitle: undefined,
    referenceLines: undefined,
    annotations: undefined,
    // The mini-map draws candles as a close-price line: at brush scale a
    // candle is a couple of pixels wide and reads as noise, while a close line
    // is the shape a reader actually navigates by.
    // A box gets the same treatment for the same reason: at brush scale it is
    // a smear, while the median line is a shape you can navigate by.
    type: isCandle ? 'line' : spec.type === 'boxplot' ? 'line' : spec.type,
    series: coloredSeries
      .filter((s) => !effectiveHidden.has(s.label))
      .map((s) =>
        s.ohlc || s.boxes
          ? { ...s, ohlc: undefined, boxes: undefined, errors: undefined, type: 'line' as const }
          : s.errors
            ? { ...s, errors: undefined }
            : s,
      ),
  })
  const brushGeo = $derived(brushEligible ? buildChart(brushSpec) : null)
  /** The brush window in fractional [0..1] of the visible data range,
   *  derived from `zoom`. When not zoomed, the window covers everything. */
  const brushWindow = $derived.by(() => {
    const n = spec.categories.length
    if (!zoom || n === 0) return { t0: 0, t1: 1 }
    return { t0: zoom.i0 / n, t1: (zoom.i1 + 1) / n }
  })

  type BrushDrag ={ mode: 'move' | 'left' | 'right'; startX: number; startT0: number; startT1: number }
  let brushDrag = $state<BrushDrag | null>(null)
  function brushSvgX(e: PointerEvent, svg: SVGSVGElement): number {
    const r = svg.getBoundingClientRect()
    if (!brushGeo) return 0
    return ((e.clientX - r.left) / r.width) * brushGeo.width
  }
  function onBrushDown(e: PointerEvent, mode: BrushDrag['mode']) {
    if (!brushGeo) return
    const svg = e.currentTarget as SVGSVGElement
    const x = brushSvgX(e, svg.ownerSVGElement ?? svg)
    brushDrag = { mode, startX: x, startT0: brushWindow.t0, startT1: brushWindow.t1 }
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    e.stopPropagation()
  }
  function onBrushMove(e: PointerEvent) {
    if (!brushDrag || !brushGeo) return
    const svg = (e.currentTarget as SVGSVGElement).ownerSVGElement ?? (e.currentTarget as SVGSVGElement)
    const x = brushSvgX(e, svg)
    const dx = x - brushDrag.startX
    const tw = brushGeo.plot.w
    const dt = dx / tw
    const n = spec.categories.length
    if (n === 0) return
    let t0 = brushDrag.startT0
    let t1 = brushDrag.startT1
    if (brushDrag.mode === 'move') {
      const w = t1 - t0
      t0 = Math.max(0, Math.min(1 - w, t0 + dt))
      t1 = t0 + w
    } else if (brushDrag.mode === 'left') {
      // Keep at least 1 category visible.
      t0 = Math.max(0, Math.min(t1 - 1 / n, t0 + dt))
    } else {
      t1 = Math.min(1, Math.max(t0 + 1 / n, t1 + dt))
    }
    // Translate back to integer category indices.
    const i0 = Math.max(0, Math.floor(t0 * n))
    const i1 = Math.min(n - 1, Math.ceil(t1 * n) - 1)
    if (i0 === 0 && i1 === n - 1) zoom = null
    else zoom = { i0, i1: Math.max(i0, i1) }
  }
  function onBrushUp(e: PointerEvent) {
    brushDrag = null
    ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
  }

  const visibleSpec = $derived.by<ChartSpec>(() => {
    if (spec.type === 'pie') {
      const s = coloredSeries[0]
      if (!s) return spec
      const values = s.values.map((v, i) => (effectiveHidden.has(spec.categories[i] ?? String(i)) ? 0 : v))
      return { ...spec, series: [{ ...s, values }] }
    }
    const visibleSeries = coloredSeries.filter((s) => !effectiveHidden.has(s.label))
    if (!zoom) return { ...spec, series: visibleSeries }
    // Narrow to the zoom window so buildChart re-spreads the visible slice
    // across the full plot. The slicing itself lives in chart.ts: this used to
    // be done by hand here and only covered categories / values / rowIds, so
    // the confidence-band envelopes kept their full length and the band
    // silently vanished as soon as anyone zoomed.
    return sliceChartWindow({ ...spec, series: visibleSeries }, zoom.i0, zoom.i1)
  })

  // Heatmap / calendar cell fills are computed colors (not CSS), so they can't
  // inherit the theme. We detect the surface luminance (see the $effect near
  // chartEl) and hand buildChart a light/dark hint so low-value cells render as
  // "cold" rather than glaring white rectangles on a dark grid.
  let isDark = $state(false)
  // Hand the RESOLVED palette down here rather than relying on per-series
  // colours alone: buildChart also picks from `spec.palette` for the marks
  // that have no series of their own (pie slices, treemap cells), and those
  // should follow the theme tokens too.
  const geo = $derived(
    buildChart(
      { ...visibleSpec, palette, ...(width || height ? { width, height } : {}) },
      isDark ? 'dark' : 'light',
    ),
  )
  const isCartesian = $derived(
    spec.type !== 'pie' && spec.type !== 'heatmap' &&
    spec.type !== 'funnel' && spec.type !== 'radar' &&
    spec.type !== 'calendar' && spec.type !== 'gauge' &&
    spec.type !== 'treemap' && spec.type !== 'sankey',
  )
  const isScatter = $derived(spec.type === 'scatter')
  const isHeatmap = $derived(spec.type === 'heatmap')
  const isFunnel = $derived(spec.type === 'funnel')
  const isRadar = $derived(spec.type === 'radar')
  const isCalendar = $derived(spec.type === 'calendar')
  const isGauge = $derived(spec.type === 'gauge')
  const isTreemap = $derived(spec.type === 'treemap')
  const isSankey = $derived(spec.type === 'sankey')
  const isHorizontal = $derived(geo.orientation === 'horizontal')
  // Per-category band size along the main (category) axis: width when vertical,
  // height when horizontal.
  const slot = $derived(
    (isHorizontal ? geo.plot.h : geo.plot.w) / Math.max(1, visibleSpec.categories.length),
  )

  /**
   * A chart with more categories than the plot has room for.
   *
   * `buildChart` itself scales fine - 100k line points is about 140ms of pure
   * maths. What does not scale is what the DOM is asked to hold: one `<circle>`
   * per point, one hit `<rect>` per category whose `aria-label` costs a
   * `catRows()` call AT RENDER TIME, and one screen-reader table row per
   * category. That is roughly 300k nodes for a 100k-point series, and the chart
   * stops responding long before the engine breaks a sweat.
   *
   * Below ~4px per category none of that machinery is buying anything anyway:
   * the dots overlap into a smear that hides the line they are meant to mark,
   * and a hit rect thinner than the pointer cannot be aimed at. So under the
   * threshold the marks collapse to the line path, the hit rects collapse to one
   * surface that computes the index from the cursor, and the table is capped.
   */
  const DENSE_SLOT_PX = 4
  const dense = $derived(
    isCartesian && !isScatter && !isHorizontal && slot < DENSE_SLOT_PX && visibleSpec.categories.length > 1,
  )

  /** Rows the screen-reader table will actually render before it is capped. */
  const SR_ROW_CAP = 1000

  /** Which category the cursor is over, in dense mode. Binary search over the
   *  first series' point x's, so a non-uniform (time) axis is handled too;
   *  uniform slot maths when there are no line points to search. */
  function catAtClientX(clientX: number, target: Element): number | null {
    const svg = (target as SVGGraphicsElement).ownerSVGElement
    if (!svg) return null
    const box = svg.getBoundingClientRect()
    if (!box.width) return null
    // Client px -> viewBox px. The svg scales to its container, so the two
    // differ whenever the chart is not rendered at its natural size.
    const vb = svg.viewBox.baseVal
    const scale = vb && vb.width ? vb.width / box.width : 1
    const x = (clientX - box.left) * scale + (vb ? vb.x : 0)
    const pts = geo.lines[0]?.points
    const n = visibleSpec.categories.length
    if (!pts || pts.length !== n) {
      const i = Math.floor((x - geo.plot.x) / slot)
      return i >= 0 && i < n ? i : null
    }
    let lo = 0
    let hi = pts.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (pts[mid]!.x < x) lo = mid + 1
      else hi = mid
    }
    // Land on the nearer of the two neighbours rather than always rounding up.
    if (lo > 0 && Math.abs(pts[lo - 1]!.x - x) <= Math.abs(pts[lo]!.x - x)) lo -= 1
    return lo
  }

  /** Focused category in dense mode, where there is one rect rather than n. */
  let denseIndex = $state(0)
  function onDenseKey(e: KeyboardEvent) {
    const max = visibleSpec.categories.length - 1
    const step = Math.max(1, Math.floor(max / 10))
    let next = denseIndex
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': next = Math.min(max, denseIndex + 1); break
      case 'ArrowLeft': case 'ArrowUp': next = Math.max(0, denseIndex - 1); break
      case 'Home': next = 0; break
      case 'End': next = max; break
      case 'PageDown': next = Math.min(max, denseIndex + step); break
      case 'PageUp': next = Math.max(0, denseIndex - step); break
      case 'Enter': case ' ':
        e.preventDefault()
        select(visibleSpec.categories[denseIndex] ?? '', '', 0, denseIndex)
        return
      default: return
    }
    e.preventDefault()
    denseIndex = next
    focusCat(e.currentTarget as Element, next)
  }

  // Opacity for a series when another legend chip is being hovered.
  const dimOf = (seriesLabel: string) => (dimmed && dimmed !== seriesLabel ? 0.18 : 1)

  const legendItems = $derived(
    spec.type === 'pie'
      ? spec.categories.map((label, i) => ({ label, color: palette[i % palette.length]!, off: hidden.has(label) }))
      : coloredSeries.map((s) => ({ label: s.label, color: s.color, off: hidden.has(s.label) })),
  )
  // Legend overflow: collapse to the first N chips with a "+N more" toggle so a
  // wide pivot (many series) doesn't flood the chart with legend rows.
  const LEGEND_MAX = 10
  let legendExpanded = $state(false)
  const legendOverflow = $derived(legendItems.length > LEGEND_MAX)
  const shownLegend = $derived(
    legendOverflow && !legendExpanded ? legendItems.slice(0, LEGEND_MAX) : legendItems,
  )

  const isEmpty = $derived.by(() => {
    if (spec.type === 'pie') return geo.slices.every((s) => s.value <= 0)
    if (spec.type === 'scatter') return geo.scatterPoints.length === 0
    if (spec.type === 'heatmap') return geo.heatmapCells.length === 0
    if (spec.type === 'funnel') return geo.funnelSegments.length === 0
    if (spec.type === 'radar') return geo.radarSeries.length === 0
    if (spec.type === 'calendar') return geo.calendarCells.length === 0
    if (spec.type === 'gauge') return !geo.gauge
    if (spec.type === 'treemap') return geo.treemapCells.length === 0
    if (spec.type === 'sankey') return geo.sankeyNodes.length === 0
    if (isCandle) return geo.candles.length === 0
    if (spec.type === 'boxplot') return geo.boxes.length === 0
    return geo.bars.length === 0 && geo.lines.every((l) => l.points.every((p) => !p.defined))
  })

  function toggle(label: string) {
    if (!interactive) return
    if (isolated != null) { isolated = null; return }
    const next = new Set(hidden)
    if (next.has(label)) next.delete(label)
    else next.add(label)
    hidden = next
  }
  // Double-click a legend chip to isolate it (show only that one); double-click
  // again (or the same chip) to clear the isolation.
  function isolate(label: string) {
    if (!interactive) return
    isolated = isolated === label ? null : label
  }

  // ---- Screen-reader data table -----------------------------------------
  // A visually-hidden table that conveys the same data to assistive tech.
  const srTable = $derived.by(() => {
    if (spec.type === 'pie') {
      const s = coloredSeries[0]
      return {
        cols: ['Category', 'Value'],
        rows: spec.categories.map((c, i) => [c, fmt(s?.values[i] ?? 0)]),
      }
    }
    if (isScatter) {
      const rows: string[][] = []
      for (const s of coloredSeries) for (const p of s.points ?? []) rows.push([s.label, fmt(p.x), fmt(p.y), p.r != null ? fmt(p.r) : ''])
      return { cols: ['Series', 'X', 'Y', 'Size'], rows }
    }
    if (isCandle) {
      // This IS the accessible version of the chart, so it carries the four
      // real numbers rather than the closes `values` happens to hold.
      const rows: string[][] = []
      for (const s of coloredSeries) {
        ;(s.ohlc ?? []).forEach((k, i) => {
          if (!k) return
          rows.push([spec.categories[i] ?? String(i), s.label, fmt(k.o), fmt(k.h), fmt(k.l), fmt(k.c)])
        })
      }
      return { cols: ['Date', 'Series', 'Open', 'High', 'Low', 'Close'], rows }
    }
    return {
      cols: ['Category', ...coloredSeries.map((s) => s.label)],
      rows: spec.categories.map((c, i) => [c, ...coloredSeries.map((s) => fmt(s.values[i] ?? 0))]),
    }
  })
  /** Declared here rather than in the markup: `{@const}` is only legal as the
   *  immediate child of a block, and the table sits at the template top level.
   *  Below `srTable` because a `$derived` used above its declaration is an
   *  error, not a hoist. */
  const srCapped = $derived(srTable.rows.length > SR_ROW_CAP)
  const srRows = $derived(srCapped ? srTable.rows.slice(0, SR_ROW_CAP) : srTable.rows)

  function truncate(s: string, n = 12): string {
    return s.length > n ? s.slice(0, n - 1) + '…' : s
  }
  const yTickLabel = (value: number, fallback: string) => (formatValue ? formatValue(value) : fallback)

  // ---- Tooltip + crosshair ----------------------------------------------
  let chartEl: HTMLElement | null = $state(null)

  // Resolve whether the chart sits on a dark surface by reading the --sg-bg
  // token's luminance. Re-checks on theme toggles (data-theme / class / style
  // changes on the document root) so the heatmap ramp follows light<->dark.
  function surfaceIsDark(color: string): boolean {
    if (!color) return false
    let r = 0, g = 0, b = 0
    const hex = color.trim().startsWith('#') ? color.trim().slice(1) : ''
    if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16); g = parseInt(hex.slice(2, 4), 16); b = parseInt(hex.slice(4, 6), 16)
    } else {
      const m = /rgba?\(([^)]+)\)/.exec(color)
      if (!m) return false
      const p = m[1]!.split(',').map((s) => parseFloat(s))
      r = p[0] ?? 0; g = p[1] ?? 0; b = p[2] ?? 0
    }
    // Perceived luminance (0..255); below the midpoint reads as a dark surface.
    return 0.299 * r + 0.587 * g + 0.114 * b < 128
  }
  /**
   * Series colours declared as `--sg-chart-1` .. `--sg-chart-8`.
   *
   * The palette used to be a hard-coded array in `chart.ts`, which meant a
   * theme could restyle every part of a chart except the data - the one part
   * a brand actually cares about. It stays out of `chart.ts` because that
   * module is deliberately DOM-free and SSR-safe, so the tokens are read here
   * and handed down as an ordinary `palette`.
   *
   * Partial sets are honoured: declare two tokens and the rest fall back, so a
   * theme can set a brand primary and secondary without inventing six more.
   */
  $effect(() => {
    if (!chartEl || typeof window === 'undefined') return
    const el = chartEl
    const check = () => {
      const cs = getComputedStyle(el)
      isDark = surfaceIsDark(cs.getPropertyValue('--sg-bg'))
      const next: string[] = []
      for (let i = 1; i <= 8; i += 1) {
        const v = cs.getPropertyValue(`--sg-chart-${i}`).trim()
        next.push(v || DEFAULT_PALETTE[i - 1]!)
      }
      const changed = !tokenPalette || next.some((c, i) => c !== tokenPalette![i])
      if (changed) tokenPalette = next.some((c, i) => c !== DEFAULT_PALETTE[i]) ? next : null
    }
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] })
    return () => obs.disconnect()
  })
  type TipRow = { label?: string; color?: string; value: string }
  let tip = $state<{ left: number; top: number; below: boolean; title: string; rows: TipRow[] } | null>(null)
  let activeCat = $state<number | null>(null)

  function showTip(clientX: number, clientY: number, title: string, rows: TipRow[]) {
    if (!interactive || !chartEl || rows.length === 0) return
    const r = chartEl.getBoundingClientRect()
    const left = Math.max(70, Math.min(r.width - 70, clientX - r.left))
    const top = clientY - r.top
    tip = { left, top, below: top < 44, title, rows }
  }

  // Unified tooltip: every visible series' value at one category.
  function catRows(i: number): TipRow[] {
    const rows: TipRow[] = []
    for (const s of visibleSpec.series) {
      const color = (s as { color?: string }).color
      // A candle carries four numbers, so it gets four rows. Doing it here
      // rather than in a parallel tooltip path means the crosshair, the
      // keyboard focus tooltip and the hit rect's aria-label all follow, and a
      // volume series on the right axis still lists itself underneath.
      const k = s.ohlc?.[i]
      if (k) {
        rows.push({ label: `${s.label} O`, color, value: fmt(k.o) })
        rows.push({ label: `${s.label} H`, value: fmt(k.h) })
        rows.push({ label: `${s.label} L`, value: fmt(k.l) })
        rows.push({ label: `${s.label} C`, value: fmt(k.c) })
        continue
      }
      // A box is a five-number summary, and reading it off the picture is
      // exactly what a tooltip is for. Same reasoning as the candle above:
      // one place, so crosshair / keyboard / aria-label all agree.
      const b = s.boxes?.[i]
      if (b) {
        rows.push({ label: `${s.label} max`, color, value: fmt(b.max) })
        rows.push({ label: `${s.label} Q3`, value: fmt(b.q3) })
        rows.push({ label: `${s.label} median`, value: fmt(b.median) })
        rows.push({ label: `${s.label} Q1`, value: fmt(b.q1) })
        rows.push({ label: `${s.label} min`, value: fmt(b.min) })
        if (b.outliers?.length) {
          rows.push({ label: `${s.label} outliers`, value: String(b.outliers.length) })
        }
        continue
      }
      const v = s.values[i]
      if (Number.isFinite(v)) {
        rows.push({ label: s.label, color, value: fmt(v as number) })
        // An error bar is only worth drawing if you can read what it means.
        const e = s.errors?.[i]
        if (e != null) {
          const lo = typeof e === 'number' ? (v as number) - Math.abs(e) : Math.min(e.lo, e.hi)
          const hi = typeof e === 'number' ? (v as number) + Math.abs(e) : Math.max(e.lo, e.hi)
          if (Number.isFinite(lo) && Number.isFinite(hi)) {
            rows.push({ label: `${s.label} range`, value: `${fmt(lo)} - ${fmt(hi)}` })
          }
        }
      }
    }
    return rows
  }
  function hoverCat(clientX: number, clientY: number, i: number) {
    activeCat = i
    showTip(clientX, clientY, visibleSpec.categories[i] ?? '', catRows(i))
  }
  function focusCat(el: Element, i: number) {
    const b = el.getBoundingClientRect()
    hoverCat(b.left + b.width / 2, b.top + 12, i)
  }
  function clearActive() {
    activeCat = null
    tip = null
  }
  function hoverSlice(clientX: number, clientY: number, label: string, value: number, pct: number) {
    showTip(clientX, clientY, label, [{ value: `${fmt(value)} · ${pct.toFixed(1)}%` }])
  }
  function hoverDot(clientX: number, clientY: number, d: (typeof geo.scatterPoints)[number]) {
    const rows: TipRow[] = [
      { label: 'x', value: fmt(d.x) },
      { label: 'y', value: fmt(d.y) },
    ]
    showTip(clientX, clientY, d.label || d.series, rows)
  }
  function hoverCell(clientX: number, clientY: number, cell: (typeof geo.heatmapCells)[number]) {
    showTip(clientX, clientY, `${cell.rowLabel} · ${cell.colLabel}`, [
      { color: cell.color, value: fmt(cell.value) },
    ])
  }
  function hoverFunnel(clientX: number, clientY: number, seg: (typeof geo.funnelSegments)[number]) {
    const rows: TipRow[] = [
      { value: fmt(seg.value) },
      { label: 'conversion', value: `${(seg.conversion * 100).toFixed(1)}%` },
    ]
    if (seg.dropoff > 0) rows.push({ label: 'drop-off', value: `${(seg.dropoff * 100).toFixed(1)}%` })
    showTip(clientX, clientY, seg.label, rows)
  }
  function hoverRadarPoint(clientX: number, clientY: number, label: string, axis: string, value: number, color: string) {
    showTip(clientX, clientY, `${label} · ${axis}`, [{ color, value: fmt(value) }])
  }

  function select(category: string, series: string, value: number, catIndex?: number) {
    // Collect contributing row ids when the spec carries them. For a
    // category click (series === ''), flatten across every series; for a
    // single-series click, return just that series' bucket.
    let rowIds: Array<string | number> | undefined
    if (catIndex !== undefined) {
      const buckets: Array<Array<string | number>> = []
      for (const s of visibleSpec.series) {
        if (!s.rowIds) continue
        if (series && s.label !== series) continue
        const ids = s.rowIds[catIndex]
        if (ids?.length) buckets.push(ids)
      }
      if (buckets.length) rowIds = buckets.flat()
    }
    const sel: ChartSelection = { category, series, value, rowIds }
    onSelect?.(sel)
    if (rowIds && rowIds.length) onDrill?.(sel)
  }
  /** Move keyboard focus to the cat-hit rect at index `next`, snapping
   *  back to the source element via the same `data-cat-index` attribute. */
  function focusCatIndex(source: Element, next: number) {
    const root = (source as SVGElement).ownerSVGElement ?? source.closest('svg')
    if (!root) return
    const target = root.querySelector<SVGElement>(`[data-cat-index="${next}"]`)
    if (!target) return
    target.focus?.()
    // Mirror the tooltip / crosshair to the new focused category.
    focusCat(target, next)
  }
  function onCatKey(e: KeyboardEvent, i: number) {
    const max = visibleSpec.categories.length - 1
    const src = e.currentTarget as Element
    // Arrow keys + Home / End navigate; Enter / Space select. PageUp/Down
    // jump a tenth of the range at a time for long datasets.
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault(); focusCatIndex(src, Math.min(max, i + 1)); return
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault(); focusCatIndex(src, Math.max(0, i - 1));   return
      case 'Home':
        e.preventDefault(); focusCatIndex(src, 0);   return
      case 'End':
        e.preventDefault(); focusCatIndex(src, max); return
      case 'PageDown':
        e.preventDefault(); focusCatIndex(src, Math.min(max, i + Math.max(1, Math.floor(max / 10)))); return
      case 'PageUp':
        e.preventDefault(); focusCatIndex(src, Math.max(0, i - Math.max(1, Math.floor(max / 10)))); return
      case 'Enter':
      case ' ':
        if (!onSelect) return
        e.preventDefault()
        select(visibleSpec.categories[i] ?? '', '', 0, i)
        return
    }
  }
  function onSliceKey(e: KeyboardEvent, label: string, value: number) {
    if (!onSelect) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      select(label, label, value)
    }
  }

  // ---- Export ----------------------------------------------------------
  // PNG / SVG download + copy-as-image. Serialize the live SVG element so
  // the exported file matches the user's current zoom / visibility state.
  let copyStatus = $state<'idle' | 'ok' | 'err'>('idle')
  function serializeSvg(): string | null {
    if (!svgEl) return null
    const clone = svgEl.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    // Drop our interaction-only classes from the export.
    clone.removeAttribute('class')
    // Inline the computed sizes so the standalone SVG renders at the
    // same pixel dimensions when opened directly.
    const rect = svgEl.getBoundingClientRect()
    if (rect.width)  clone.setAttribute('width',  String(Math.round(rect.width)))
    if (rect.height) clone.setAttribute('height', String(Math.round(rect.height)))
    // Pull the chart's stylesheet so the standalone SVG is self-contained.
    const styleTag = document.createElement('style')
    const sheets = Array.from(document.styleSheets)
    const rules: string[] = []
    for (const sheet of sheets) {
      try {
        for (const rule of Array.from(sheet.cssRules ?? [])) {
          const t = rule.cssText
          if (t.includes('.sv-grid-chart')) rules.push(t)
        }
      } catch { /* cross-origin sheets - skip */ }
    }
    styleTag.textContent = rules.join('\n')
    clone.insertBefore(styleTag, clone.firstChild)
    return new XMLSerializer().serializeToString(clone)
  }
  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function rasterizeSvg(svgText: string): Promise<Blob | null> {
    return new Promise((resolve) => {
      const rect = svgEl?.getBoundingClientRect()
      const w = Math.max(1, Math.round(rect?.width  ?? geo.width))
      const h = Math.max(1, Math.round(rect?.height ?? geo.height))
      const dpr = window.devicePixelRatio || 1
      const canvas = document.createElement('canvas')
      canvas.width  = w * dpr
      canvas.height = h * dpr
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(null); return }
      const img = new Image()
      img.onload = () => {
        ctx.scale(dpr, dpr)
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob((b) => resolve(b), 'image/png')
      }
      img.onerror = () => resolve(null)
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText)
    })
  }
  async function downloadImage(format: 'png' | 'svg') {
    const text = serializeSvg()
    if (!text) return
    const stamp = new Date().toISOString().slice(0, 10)
    if (format === 'svg') {
      triggerDownload(new Blob([text], { type: 'image/svg+xml' }), `chart-${stamp}.svg`)
      return
    }
    const png = await rasterizeSvg(text)
    if (png) triggerDownload(png, `chart-${stamp}.png`)
  }
  async function copyAsImage() {
    const text = serializeSvg()
    if (!text) { copyStatus = 'err'; return }
    try {
      const png = await rasterizeSvg(text)
      if (!png) throw new Error('rasterize failed')
      const Clip = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
      if (Clip && navigator.clipboard?.write) {
        await navigator.clipboard.write([new Clip({ 'image/png': png })])
      } else {
        // Fallback: copy SVG markup as text so the user can paste somewhere.
        await navigator.clipboard.writeText(text)
      }
      copyStatus = 'ok'
    } catch {
      copyStatus = 'err'
    }
    setTimeout(() => (copyStatus = 'idle'), 1500)
  }
</script>

<div class="sv-grid-chart" bind:this={chartEl}>
  {#if showToolbar}
    <div class="sv-grid-chart-toolbar">
      {#if zoomable && isZoomed}
        <button type="button" class="sv-grid-chart-tool" onclick={resetZoom} title="Reset zoom (or double-click the plot)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>
          Reset zoom
        </button>
      {/if}
      <button type="button" class="sv-grid-chart-tool" onclick={() => downloadImage('png')} title="Download PNG">PNG</button>
      <button type="button" class="sv-grid-chart-tool" onclick={() => downloadImage('svg')} title="Download SVG">SVG</button>
      <button type="button" class="sv-grid-chart-tool" onclick={copyAsImage} title="Copy chart as image">
        {copyStatus === 'ok' ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  {/if}
  <svg
    bind:this={svgEl}
    class="sv-grid-chart-svg"
    class:is-interactive={interactive}
    class:is-clickable={!!onSelect || !!onDrill}
    class:is-zoomable={zoomable && isCartesian}
    class:is-dragging={!!dragStart}
    viewBox={`0 0 ${geo.width} ${geo.height}`}
    width="100%"
    role="img"
    aria-label={`${spec.type} chart`}
    aria-describedby={`${uid}-table`}
    onpointerdown={onZoomDown}
    onpointermove={onZoomMove}
    onpointerup={onZoomUp}
    onpointercancel={onZoomUp}
    ondblclick={onPlotDblClick}
  >
    <!-- Pattern defs: emitted once per series when patternFallback is on
         or a series sets `pattern`. Color is baked into the pattern so
         each series gets a hue-tinted texture without dynamic CSS. -->
    {#if patternDefs.length}
      <defs>
        {#each patternDefs as p (p.id)}
          {#if p.kind === 'stripe'}
            <pattern id={p.id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={p.color} />
              <rect width="3" height="6" fill="rgba(255,255,255,0.35)" />
            </pattern>
          {:else if p.kind === 'crosshatch'}
            <pattern id={p.id} width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill={p.color} />
              <path d="M0 0L6 6 M6 0L0 6" stroke="rgba(255,255,255,0.45)" stroke-width="1" />
            </pattern>
          {:else if p.kind === 'dots'}
            <pattern id={p.id} width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill={p.color} />
              <circle cx="3" cy="3" r="1.2" fill="rgba(255,255,255,0.55)" />
            </pattern>
          {:else if p.kind === 'diagonal'}
            <pattern id={p.id} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
              <rect width="8" height="8" fill={p.color} />
              <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(0,0,0,0.18)" stroke-width="2" />
            </pattern>
          {/if}
        {/each}
      </defs>
    {/if}
    {#if isHorizontal}
      <!-- Value axis (vertical gridlines + bottom labels) -->
      {#each geo.valueTicks as t (t.label + t.x)}
        <line class="sv-grid-chart-gridline" x1={t.x} y1={geo.plot.y} x2={t.x} y2={geo.plot.y + geo.plot.h} />
        <text class="sv-grid-chart-axis" x={t.x} y={geo.plot.y + geo.plot.h + 14} text-anchor="middle">{t.label}</text>
      {/each}
      <!-- Category labels down the left -->
      {#each geo.catTicks as t (t.value)}
        <text class="sv-grid-chart-axis" x={geo.plot.x - 6} y={t.y + 3} text-anchor="end">{truncate(t.label, 18)}</text>
      {/each}
      {#if spec.yAxisTitle}
        <text class="sv-grid-chart-axis-title" x={13} y={geo.plot.y + geo.plot.h / 2} text-anchor="middle" transform={`rotate(-90 13 ${geo.plot.y + geo.plot.h / 2})`}>{spec.yAxisTitle}</text>
      {/if}
      {#if spec.xAxisTitle}
        <text class="sv-grid-chart-axis-title" x={geo.plot.x + geo.plot.w / 2} y={geo.height - 3} text-anchor="middle">{spec.xAxisTitle}</text>
      {/if}
    {:else if isCartesian}
      {#each geo.yTicks as t (t.value)}
        <line class="sv-grid-chart-gridline" class:is-zero={t.value === 0} x1={geo.plot.x} y1={t.y} x2={geo.plot.x + geo.plot.w} y2={t.y} />
        <text class="sv-grid-chart-axis" x={geo.plot.x - 6} y={t.y + 3} text-anchor="end">{yTickLabel(t.value, t.label)}</text>
      {/each}
      {#if geo.hasRightAxis}
        {#each geo.y2Ticks as t (t.value)}
          <text class="sv-grid-chart-axis" x={geo.plot.x + geo.plot.w + 6} y={t.y + 3} text-anchor="start">{yTickLabel(t.value, t.label)}</text>
        {/each}
      {/if}
      {#each geo.xTicks as t (t.label + t.x)}
        {#if geo.xLabelRotated}
          <text class="sv-grid-chart-axis" x={t.x} y={geo.plot.y + geo.plot.h + 12} text-anchor="end" transform={`rotate(-40 ${t.x} ${geo.plot.y + geo.plot.h + 12})`}>{truncate(t.label)}</text>
        {:else}
          <text class="sv-grid-chart-axis" x={t.x} y={geo.plot.y + geo.plot.h + 16} text-anchor="middle">{truncate(t.label, 16)}</text>
        {/if}
      {/each}
      <!-- Grouped (nested) category axis: parent tier under the leaf labels. -->
      {#each geo.categoryGroupTicks as g (g.label + g.x0)}
        {@const gy = geo.plot.y + geo.plot.h + (geo.xLabelRotated ? 46 : 32)}
        <line class="sv-grid-chart-gridline" x1={g.x0 + 3} y1={gy - 9} x2={g.x1 - 3} y2={gy - 9} />
        {#if g.x0 > geo.plot.x + 1}
          <line class="sv-grid-chart-gridline" x1={g.x0} y1={geo.plot.y + geo.plot.h} x2={g.x0} y2={gy - 9} opacity="0.5" />
        {/if}
        <text class="sv-grid-chart-axis sv-grid-chart-group-label" x={g.xCenter} y={gy} text-anchor="middle">{truncate(g.label, Math.max(4, Math.floor((g.x1 - g.x0) / 7)))}</text>
      {/each}
      {#if spec.yAxisTitle}
        <text class="sv-grid-chart-axis-title" x={13} y={geo.plot.y + geo.plot.h / 2} text-anchor="middle" transform={`rotate(-90 13 ${geo.plot.y + geo.plot.h / 2})`}>{spec.yAxisTitle}</text>
      {/if}
      {#if spec.y2AxisTitle}
        <text class="sv-grid-chart-axis-title" x={geo.width - 5} y={geo.plot.y + geo.plot.h / 2} text-anchor="middle" transform={`rotate(90 ${geo.width - 5} ${geo.plot.y + geo.plot.h / 2})`}>{spec.y2AxisTitle}</text>
      {/if}
      {#if spec.xAxisTitle}
        <text class="sv-grid-chart-axis-title" x={geo.plot.x + geo.plot.w / 2} y={geo.height - 3} text-anchor="middle">{spec.xAxisTitle}</text>
      {/if}
    {/if}

    {#each geo.lines as line, li (line.label + li)}
      <g style={`opacity:${dimOf(line.label)}`}>
        {#if line.bandPath}
          <!-- Confidence band: shaded envelope between upperValues / lowerValues. -->
          <path class="sv-grid-chart-band" d={line.bandPath} fill={line.color} fill-opacity="0.12" stroke="none" />
        {/if}
        {#if line.areaPath}
          <path class="sv-grid-chart-area" d={line.areaPath} fill={seriesFill[line.label] ?? line.color} fill-opacity="0.15" stroke="none" />
        {/if}
        <path class="sv-grid-chart-linepath" d={line.path} fill="none" stroke={line.color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        {#if dense}
          <!-- Below ~4px a category the dots touch, so they stop marking the
               points and start hiding the line. Only the hovered one is drawn,
               which is the one a reader is actually asking about. -->
          {@const pt = line.points[activeCat ?? -1]}
          {#if pt?.defined}
            <circle class="sv-grid-chart-dot is-active" cx={pt.x} cy={pt.y} r="4" fill={line.color} />
          {/if}
        {:else}
          {#each line.points as pt, pi (pi)}
            {#if pt.defined}
              <circle class="sv-grid-chart-dot" class:is-active={activeCat === pi} cx={pt.x} cy={pt.y} r={activeCat === pi ? 4 : 3} fill={line.color} />
              {#if dataLabels}
                <text class="sv-grid-chart-datalabel" x={pt.x} y={pt.y - 7} text-anchor="middle">{fmt(pt.value)}</text>
              {/if}
            {/if}
          {/each}
        {/if}
      </g>
    {/each}

    {#each geo.bars as bar, bi (bi)}
      <rect class="sv-grid-chart-bar" x={bar.x} y={bar.y} width={bar.w} height={bar.h} rx="1" fill={seriesFill[bar.series] ?? bar.color} style={`opacity:${dimOf(bar.series)}`} />
      {#if dataLabels && isHorizontal && bar.w > 18}
        <text class="sv-grid-chart-datalabel" class:on-bar={spec.stacked || spec.stacked100} x={spec.stacked || spec.stacked100 ? bar.x + bar.w / 2 : bar.value >= 0 ? bar.x + bar.w + 3 : bar.x - 3} y={bar.y + bar.h / 2 + 3} text-anchor={spec.stacked || spec.stacked100 ? 'middle' : bar.value >= 0 ? 'start' : 'end'}>{fmt(bar.value)}</text>
      {:else if dataLabels && !isHorizontal && bar.h > 13}
        <text class="sv-grid-chart-datalabel" class:on-bar={spec.stacked || spec.stacked100} x={bar.x + bar.w / 2} y={spec.stacked || spec.stacked100 ? bar.y + bar.h / 2 + 3 : bar.value >= 0 ? bar.y - 3 : bar.y + bar.h + 11} text-anchor="middle">{fmt(bar.value)}</text>
      {/if}
    {/each}

    <!-- Candles paint above gridlines and any volume bars, below the reference
         lines, annotations, crosshair and hit layer. Hollow-up / filled-down
         rather than two fills: direction then reads from the shape as well as
         the hue, which is the same reason this chart ships pattern fills. -->
    {#each geo.candles as k, ki (ki)}
      {#if isOhlcBars}
        <line class="sv-grid-chart-ohlc" x1={k.xCenter} y1={k.yHigh} x2={k.xCenter} y2={k.yLow} stroke={k.color} style={`opacity:${dimOf(k.series)}`} />
        <line class="sv-grid-chart-ohlc" x1={k.x} y1={k.yOpen} x2={k.xCenter} y2={k.yOpen} stroke={k.color} style={`opacity:${dimOf(k.series)}`} />
        <line class="sv-grid-chart-ohlc" x1={k.xCenter} y1={k.yClose} x2={k.x + k.w} y2={k.yClose} stroke={k.color} style={`opacity:${dimOf(k.series)}`} />
      {:else}
        <line class="sv-grid-chart-wick" x1={k.xCenter} y1={k.yHigh} x2={k.xCenter} y2={k.yLow} stroke={k.color} style={`opacity:${dimOf(k.series)}`} />
        <rect class="sv-grid-chart-candle" x={k.x} y={k.bodyY} width={k.w} height={k.bodyH} fill={k.up ? 'none' : k.color} stroke={k.color} style={`opacity:${dimOf(k.series)}`} />
      {/if}
    {/each}

    <!-- Box plots. The median is a heavier rule than the box outline because it
         is the number people actually read; the whisker caps are drawn at the
         box width so the shape stays legible when the slot is narrow. -->
    {#each geo.boxes as b, bi (bi)}
      <line class="sv-grid-chart-whisker" x1={b.xCenter} y1={b.yMax} x2={b.xCenter} y2={b.yMin} stroke={b.color} style={`opacity:${dimOf(b.series)}`} />
      <line class="sv-grid-chart-whisker" x1={b.x + b.w * 0.25} y1={b.yMax} x2={b.x + b.w * 0.75} y2={b.yMax} stroke={b.color} style={`opacity:${dimOf(b.series)}`} />
      <line class="sv-grid-chart-whisker" x1={b.x + b.w * 0.25} y1={b.yMin} x2={b.x + b.w * 0.75} y2={b.yMin} stroke={b.color} style={`opacity:${dimOf(b.series)}`} />
      <rect class="sv-grid-chart-box" x={b.x} y={b.boxY} width={b.w} height={b.boxH} fill={b.color} fill-opacity="0.25" stroke={b.color} style={`opacity:${dimOf(b.series)}`} />
      <line class="sv-grid-chart-median" x1={b.x} y1={b.yMedian} x2={b.x + b.w} y2={b.yMedian} stroke={b.color} style={`opacity:${dimOf(b.series)}`} />
      {#each b.outliers as o, oi (oi)}
        <circle class="sv-grid-chart-outlier" cx={b.xCenter} cy={o.y} r="2" fill="none" stroke={b.color} style={`opacity:${dimOf(b.series)}`} />
      {/each}
    {/each}

    <!-- Error bars, on top of the mark they annotate. -->
    {#each geo.errorBars as eb, ei (ei)}
      <line class="sv-grid-chart-errorbar" x1={eb.xCenter} y1={eb.yHi} x2={eb.xCenter} y2={eb.yLo} stroke={eb.color} style={`opacity:${dimOf(eb.series)}`} />
      <line class="sv-grid-chart-errorbar" x1={eb.xCenter - eb.cap} y1={eb.yHi} x2={eb.xCenter + eb.cap} y2={eb.yHi} stroke={eb.color} style={`opacity:${dimOf(eb.series)}`} />
      <line class="sv-grid-chart-errorbar" x1={eb.xCenter - eb.cap} y1={eb.yLo} x2={eb.xCenter + eb.cap} y2={eb.yLo} stroke={eb.color} style={`opacity:${dimOf(eb.series)}`} />
    {/each}

    {#each geo.scatterPoints as dot, di (di)}
      <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events -->
      <circle
        class="sv-grid-chart-scatter"
        cx={dot.cx}
        cy={dot.cy}
        r={dot.r}
        fill={dot.color}
        fill-opacity="0.7"
        stroke={dot.color}
        style={`opacity:${dimOf(dot.series)}`}
        onmousemove={(e) => hoverDot(e.clientX, e.clientY, dot)}
        onmouseleave={clearActive}
      />
    {/each}

    <!-- Reference / target lines paint on top so they read over the bars/areas. -->
    {#each geo.referenceLines as ref, ri (ri)}
      <line class="sv-grid-chart-refline" x1={geo.plot.x} y1={ref.y} x2={geo.plot.x + geo.plot.w} y2={ref.y} stroke={ref.color} stroke-dasharray={ref.dashed ? '5 4' : undefined} />
      <text class="sv-grid-chart-reflabel" x={geo.plot.x + geo.plot.w - 3} y={ref.y - 3} text-anchor="end" fill={ref.color}>{ref.label}</text>
    {/each}
    {#each geo.referenceLinesV as ref, ri (ri)}
      <line class="sv-grid-chart-refline" x1={ref.x} y1={geo.plot.y} x2={ref.x} y2={geo.plot.y + geo.plot.h} stroke={ref.color} stroke-dasharray={ref.dashed ? '5 4' : undefined} />
      <text class="sv-grid-chart-reflabel" x={ref.x + 3} y={geo.plot.y + 9} text-anchor="start" fill={ref.color}>{ref.label}</text>
    {/each}

    <!-- Trend / moving-average overlays. Dashed so they read distinctly
         from the source series, drawn on top of bars + lines. -->
    {#each geo.overlays as ovl, oi (ovl.label + oi)}
      <path class="sv-grid-chart-overlay" d={ovl.path} fill="none" stroke={ovl.color} stroke-width="2" stroke-dasharray="6 4" stroke-linejoin="round" stroke-linecap="round" />
    {/each}

    <!-- Pinned annotations: small marker + label. Placement nudges the
         label position so it sits clear of the data point. -->
    {#each geo.annotations as ann, ai (ann.label + ai)}
      {@const dx = ann.placement === 'left' ? -8 : ann.placement === 'right' ? 8 : 0}
      {@const dy = ann.placement === 'bottom' ? 14 : ann.placement === 'top' ? -8 : 0}
      {@const anchor = ann.placement === 'left' ? 'end' : ann.placement === 'right' ? 'start' : 'middle'}
      <circle class="sv-grid-chart-annotation-marker" cx={ann.x} cy={ann.y} r="4" fill={ann.color} stroke="var(--sg-bg, #fff)" stroke-width="1.5" />
      <text class="sv-grid-chart-annotation-label" x={ann.x + dx} y={ann.y + dy} text-anchor={anchor} fill={ann.color}>{ann.label}</text>
    {/each}

    {#if isCartesian && activeCat !== null}
      {#if isHorizontal}
        {@const cy = geo.plot.y + slot * activeCat + slot / 2}
        <line class="sv-grid-chart-crosshair" x1={geo.plot.x} y1={cy} x2={geo.plot.x + geo.plot.w} y2={cy} />
      {:else}
        <!-- Read the actual point x from the first line series when one
             exists (line / area / combo charts) so the crosshair lines up
             with the dots even on a time x-axis (where slot-based math is
             wrong because points are spaced by time, not index). Fall back
             to the slot midpoint for pure bar charts. -->
        {@const linePt = geo.lines[0]?.points[activeCat]}
        {@const cx = linePt && Number.isFinite(linePt.x)
          ? linePt.x
          : geo.plot.x + slot * activeCat + slot / 2}
        <line class="sv-grid-chart-crosshair" x1={cx} y1={geo.plot.y} x2={cx} y2={geo.plot.y + geo.plot.h} />
      {/if}
    {/if}

    {#if isHeatmap}
      <!-- Row labels in the left gutter -->
      {#each geo.heatmapRowTicks as t (t.value)}
        <text class="sv-grid-chart-axis" x={geo.plot.x - 8} y={t.y + 3} text-anchor="end">{truncate(t.label, 22)}</text>
      {/each}
      <!-- Column labels along the bottom -->
      {#each geo.heatmapColTicks as t, i (t.label + i)}
        <text class="sv-grid-chart-axis" x={t.x} y={geo.plot.y + geo.plot.h + 14} text-anchor="middle">{truncate(t.label, 14)}</text>
      {/each}
      <!-- Cells -->
      {#each geo.heatmapCells as cell, ci (ci)}
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events a11y_no_noninteractive_tabindex -->
        <rect
          class="sv-grid-chart-heatcell"
          x={cell.x} y={cell.y} width={cell.w} height={cell.h}
          fill={cell.color}
          role={onSelect ? 'button' : 'presentation'}
          tabindex={onSelect ? 0 : undefined}
          aria-label={`${cell.rowLabel} ${cell.colLabel}: ${fmt(cell.value)}`}
          onmousemove={(e) => hoverCell(e.clientX, e.clientY, cell)}
          onmouseleave={clearActive}
          onclick={() => select(cell.colLabel, cell.rowLabel, cell.value)}
          onkeydown={(e) => { if (onSelect && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(cell.colLabel, cell.rowLabel, cell.value) } }}
        />
        {#if dataLabels && cell.w > 22 && cell.h > 14}
          <text class="sv-grid-chart-heatlabel" x={cell.x + cell.w / 2} y={cell.y + cell.h / 2 + 3} text-anchor="middle" fill={cell.textColor}>{fmt(cell.value)}</text>
        {/if}
      {/each}
      <!-- Color-scale legend bar on the right -->
      {#if geo.heatmapLegend.length}
        {@const lx = geo.plot.x + geo.plot.w + 14}
        {@const lh = geo.plot.h - 20}
        {@const stops = geo.heatmapLegend}
        <defs>
          <linearGradient id={`${uid}-heatscale`} x1="0" y1="1" x2="0" y2="0">
            {#each stops as s, i (i)}
              <stop offset={`${(i / (stops.length - 1)) * 100}%`} stop-color={s.color} />
            {/each}
          </linearGradient>
        </defs>
        <rect class="sv-grid-chart-heatlegend" x={lx} y={geo.plot.y + 10} width="10" height={lh} fill={`url(#${uid}-heatscale)`} />
        <text class="sv-grid-chart-axis" x={lx + 14} y={geo.plot.y + 14} text-anchor="start">{stops[stops.length - 1]!.label}</text>
        <text class="sv-grid-chart-axis" x={lx + 14} y={geo.plot.y + 10 + lh} text-anchor="start">{stops[0]!.label}</text>
      {/if}
    {/if}

    {#if isFunnel}
      <!-- Trapezoid stack with inline label inside each segment. -->
      {#each geo.funnelSegments as seg, fi (fi)}
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events a11y_no_noninteractive_tabindex -->
        <path
          class="sv-grid-chart-funnel-seg"
          d={seg.path}
          fill={seg.color}
          role={onSelect ? 'button' : 'presentation'}
          tabindex={onSelect ? 0 : undefined}
          aria-label={`${seg.label}: ${fmt(seg.value)}`}
          onmousemove={(e) => hoverFunnel(e.clientX, e.clientY, seg)}
          onmouseleave={clearActive}
          onclick={() => select(seg.label, seg.label, seg.value, fi)}
          onkeydown={(e) => { if (onSelect && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(seg.label, seg.label, seg.value, fi) } }}
        />
        <text class="sv-grid-chart-funnel-label" x={seg.cx} y={seg.cy - 3} text-anchor="middle" fill={seg.textColor}>{truncate(seg.label, 24)}</text>
        <text class="sv-grid-chart-funnel-value" x={seg.cx} y={seg.cy + 11} text-anchor="middle" fill={seg.textColor}>
          {fmt(seg.value)} · {(seg.conversion * 100).toFixed(0)}%
        </text>
      {/each}
    {/if}

    {#if isRadar && geo.radarCenter}
      {@const c = geo.radarCenter}
      <!-- Concentric grid rings -->
      {#each geo.radarRings as _v, ri (ri)}
        {@const ringR = c.r * ((ri + 1) / geo.radarRings.length)}
        <circle class="sv-grid-chart-radar-ring" cx={c.cx} cy={c.cy} r={ringR} />
      {/each}
      <!-- Axis spokes + outer labels -->
      {#each geo.radarAxes as axis, ai (ai)}
        <line class="sv-grid-chart-radar-spoke" x1={c.cx} y1={c.cy} x2={axis.x} y2={axis.y} />
        {@const dx = axis.x - c.cx}
        {@const dy = axis.y - c.cy}
        {@const lx = c.cx + dx * 1.08}
        {@const ly = c.cy + dy * 1.08}
        <text class="sv-grid-chart-axis" x={lx} y={ly + 3}
          text-anchor={Math.abs(dx) < 1 ? 'middle' : dx > 0 ? 'start' : 'end'}>{axis.label}</text>
      {/each}
      <!-- One translucent polygon per series + dot per vertex. -->
      {#each geo.radarSeries as rs, si (si)}
        <path class="sv-grid-chart-radar-poly" d={rs.path} fill={rs.color} fill-opacity="0.18" stroke={rs.color} stroke-width="2" style={`opacity:${dimOf(rs.label)}`} />
        {#each rs.points as pt, pi (pi)}
          <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events -->
          <circle class="sv-grid-chart-radar-dot" cx={pt.x} cy={pt.y} r="3" fill={rs.color}
            onmousemove={(e) => hoverRadarPoint(e.clientX, e.clientY, rs.label, pt.axis, pt.value, rs.color)}
            onmouseleave={clearActive} />
        {/each}
      {/each}
    {/if}

    {#if isCalendar}
      <!-- Month labels along the top -->
      {#each geo.calendarMonthTicks as t, ti (ti)}
        <text class="sv-grid-chart-axis" x={t.x} y={geo.plot.y - 8} text-anchor="start">{t.label}</text>
      {/each}
      <!-- Day-of-week labels on the left (Mon/Wed/Fri only to save space) -->
      {#each ['Mon','Wed','Fri'] as dayLabel, di (di)}
        {@const rowIdx = [1, 3, 5][di]!}
        {@const cell = geo.calendarCells[rowIdx]}
        {#if cell}
          <text class="sv-grid-chart-axis" x={geo.plot.x - 6} y={cell.y + cell.size / 2 + 3} text-anchor="end">{dayLabel}</text>
        {/if}
      {/each}
      <!-- Cells -->
      {#each geo.calendarCells as cell, ci (ci)}
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events -->
        <rect
          class="sv-grid-chart-calendar-cell"
          class:is-blank={!cell.defined}
          x={cell.x + 1} y={cell.y + 1}
          width={cell.size - 2} height={cell.size - 2}
          fill={cell.defined ? cell.color : 'transparent'}
          rx="2"
          aria-label={`${cell.date}: ${cell.defined ? fmt(cell.value) : 'no data'}`}
          onmousemove={(e) => cell.defined && showTip(e.clientX, e.clientY, cell.date, [{ color: cell.color, value: fmt(cell.value) }])}
          onmouseleave={clearActive}
        />
      {/each}
      <!-- Legend strip on the right -->
      {#if geo.calendarLegend.length}
        {@const lx = geo.plot.x + geo.plot.w + 12}
        {@const ly = geo.plot.y + 4}
        <text class="sv-grid-chart-axis" x={lx} y={ly} text-anchor="start">Less</text>
        {#each geo.calendarLegend as s, i (i)}
          <rect class="sv-grid-chart-calendar-legend" x={lx} y={ly + 6 + i * 13} width="10" height="10" rx="2" fill={s.color} />
          <text class="sv-grid-chart-axis" x={lx + 14} y={ly + 14 + i * 13} text-anchor="start">{s.label}</text>
        {/each}
        <text class="sv-grid-chart-axis" x={lx} y={ly + 12 + geo.calendarLegend.length * 13} text-anchor="start">More</text>
      {/if}
    {/if}

    {#if isGauge && geo.gauge}
      {@const g = geo.gauge}
      <!-- Tick marks around the dial (major ticks longer). -->
      {#each g.ticks as tk, ti (ti)}
        <line class="sv-grid-chart-gauge-tick" class:is-major={tk.major}
          x1={tk.x1} y1={tk.y1} x2={tk.x2} y2={tk.y2} />
      {/each}
      <!-- Track (grey full arc) -->
      <path d={g.trackPath} fill="none" stroke="var(--sg-border, #e2e8f0)" stroke-width="16" stroke-linecap="round" />
      <!-- Range bands: a thin inner reference ring. Deliberately quieter than
           the value arc - they say what the scale MEANS, while the value arc
           is what the dial is actually reading. Butt caps so adjacent bands
           meet cleanly instead of overlapping into each other's colour. -->
      {#each g.rangePaths as band, bi (bi)}
        <path d={band.path} fill="none" stroke={band.color} stroke-width="4" stroke-linecap="butt" opacity="0.7" />
      {/each}
      <!-- Value arc, colored by the band the value sits in. -->
      <path d={g.valuePath} fill="none" stroke={g.valueColor ?? 'var(--sg-accent, #2563eb)'} stroke-width="16" stroke-linecap="round" />
      <!-- Target tick (when set) -->
      {#if g.target}
        <line x1={g.target.x1} y1={g.target.y1} x2={g.target.x2} y2={g.target.y2}
          stroke="var(--sg-fg, #0f172a)" stroke-width="2.5" stroke-linecap="round" />
      {/if}
      <!-- Pointer needle + center hub. -->
      <path class="sv-grid-chart-gauge-needle" d={g.needle.path} fill={g.valueColor ?? 'var(--sg-accent, #2563eb)'} />
      <circle class="sv-grid-chart-gauge-hub" cx={g.cx} cy={g.cy} r={g.needle.hubR} />
      <circle class="sv-grid-chart-gauge-hub-dot" cx={g.cx} cy={g.cy} r="2.5" />
      <!-- Scale end labels + center readout. -->
      <text class="sv-grid-chart-axis" x={g.minLabel.x} y={g.minLabel.y} text-anchor="middle">{fmt(g.min)}</text>
      <text class="sv-grid-chart-axis" x={g.maxLabel.x} y={g.maxLabel.y} text-anchor="middle">{fmt(g.max)}</text>
      <text class="sv-grid-chart-gauge-value" x={g.cx} y={g.cy + 38} text-anchor="middle">{fmt(g.value)}{g.unit ? ` ${g.unit}` : ''}</text>
    {/if}

    {#if isTreemap}
      {#each geo.treemapCells as cell, ti (ti)}
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events a11y_no_noninteractive_tabindex -->
        <rect
          class="sv-grid-chart-treemap-cell"
          x={cell.x} y={cell.y} width={cell.w} height={cell.h}
          fill={cell.color}
          role={onSelect ? 'button' : 'presentation'}
          tabindex={onSelect ? 0 : undefined}
          aria-label={`${cell.name}: ${fmt(cell.value)}`}
          onmousemove={(e) => showTip(e.clientX, e.clientY, cell.name, [{ color: cell.color, value: fmt(cell.value) }])}
          onmouseleave={clearActive}
          onclick={() => select(cell.name, '', cell.value)}
          onkeydown={(e) => { if (onSelect && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(cell.name, '', cell.value) } }}
        />
        {#if cell.w > 36 && cell.h > 18}
          <text class="sv-grid-chart-treemap-label" x={cell.x + 4} y={cell.y + 12} fill={cell.textColor}>{truncate(cell.name, Math.max(3, Math.floor(cell.w / 7)))}</text>
        {/if}
        {#if cell.w > 60 && cell.h > 30}
          <text class="sv-grid-chart-treemap-value" x={cell.x + 4} y={cell.y + 24} fill={cell.textColor} opacity="0.85">{fmt(cell.value)}</text>
        {/if}
      {/each}
    {/if}

    {#if isSankey}
      <!-- Ribbon links (drawn first so node rects sit on top). -->
      {#each geo.sankeyLinks as link, li (li)}
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events -->
        <path
          class="sv-grid-chart-sankey-link"
          d={link.path}
          fill="none"
          stroke={link.color}
          stroke-width={link.width}
          stroke-opacity="0.35"
          aria-label={`${link.source} -> ${link.target}: ${fmt(link.value)}`}
          onmousemove={(e) => showTip(e.clientX, e.clientY, `${link.source} -> ${link.target}`, [{ color: link.color, value: fmt(link.value) }])}
          onmouseleave={clearActive}
        />
      {/each}
      <!-- Node rectangles + labels. -->
      {#each geo.sankeyNodes as node, ni (ni)}
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events a11y_no_noninteractive_tabindex -->
        <rect
          class="sv-grid-chart-sankey-node"
          x={node.x} y={node.y} width={node.w} height={node.h}
          fill={node.color}
          tabindex={0}
          aria-label={`${node.label}: in ${fmt(node.totalIn)}, out ${fmt(node.totalOut)}`}
          onmousemove={(e) => showTip(e.clientX, e.clientY, node.label, [
            { label: 'in',  value: fmt(node.totalIn) },
            { label: 'out', value: fmt(node.totalOut) },
          ])}
          onmouseleave={clearActive}
          onfocus={(e) => { const b = e.currentTarget.getBoundingClientRect(); showTip(b.left + b.width / 2, b.top, node.label, [
            { label: 'in',  value: fmt(node.totalIn) },
            { label: 'out', value: fmt(node.totalOut) },
          ]) }}
          onblur={clearActive}
        />
        <text class="sv-grid-chart-sankey-label"
          x={node.column === 0 ? node.x + node.w + 4 : node.x - 4}
          y={node.y + node.h / 2 + 3}
          text-anchor={node.column === 0 ? 'start' : 'end'}>{node.label}</text>
      {/each}
    {/if}

    {#each geo.slices as slice, si (si)}
      <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events a11y_no_noninteractive_tabindex -->
      <path
        class="sv-grid-chart-slice"
        d={slice.path}
        fill={slice.color}
        stroke="var(--sg-bg, #fff)"
        stroke-width="1"
        role={onSelect ? 'button' : 'presentation'}
        tabindex={onSelect ? 0 : undefined}
        aria-label={`${slice.label}: ${fmt(slice.value)}, ${slice.percent.toFixed(1)}%`}
        onmousemove={(e) => hoverSlice(e.clientX, e.clientY, slice.label, slice.value, slice.percent)}
        onmouseleave={clearActive}
        onfocus={(e) => { const b = e.currentTarget.getBoundingClientRect(); hoverSlice(b.left + b.width / 2, b.top, slice.label, slice.value, slice.percent) }}
        onblur={clearActive}
        onclick={() => select(slice.label, slice.label, slice.value, si)}
        onkeydown={(e) => onSliceKey(e, slice.label, slice.value)}
      />
      {#if dataLabels && slice.percent >= 6}
        <text class="sv-grid-chart-datalabel on-bar" x={slice.cx} y={slice.cy} text-anchor="middle" dominant-baseline="middle">{slice.percent.toFixed(0)}%</text>
      {/if}
    {/each}

    {#if geo.donut}
      <text class="sv-grid-chart-donut-total" x={geo.donut.cx} y={geo.donut.cy - 4} text-anchor="middle">{fmt(geo.donut.total)}</text>
      <text class="sv-grid-chart-donut-label" x={geo.donut.cx} y={geo.donut.cy + 11} text-anchor="middle">Total</text>
    {/if}

    {#if isCartesian && !isScatter}
      <!-- Per-category hover/focus zones drive the unified crosshair
           tooltip + arrow-key navigation. tabindex=0 on the first rect
           and -1 on the rest implements roving tabindex: Tab enters the
           group, arrow keys move within it, Tab leaves.
           Vertical bands centre on the ACTUAL point x (which differs from
           slot math when xType is 'time'); their widths bisect the gap to
           neighbouring points so a mouse over a dot always selects it. -->
      {#if dense}
        <!-- One surface instead of n rects. At this density a per-category
             rect is thinner than the pointer, and each one costs a catRows()
             call for its aria-label at render time - so 100k categories meant
             100k tooltip-row computations before anything was even hovered. -->
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events a11y_no_noninteractive_tabindex -->
        <rect
          class="sv-grid-chart-cat-hit"
          x={geo.plot.x}
          y={geo.plot.y}
          width={geo.plot.w}
          height={geo.plot.h}
          role={onSelect ? 'button' : 'img'}
          tabindex={interactive ? 0 : undefined}
          data-cat-index={denseIndex}
          data-dense="true"
          aria-label={`${visibleSpec.categories.length} points, ${visibleSpec.categories[0] ?? ''} to ${visibleSpec.categories[visibleSpec.categories.length - 1] ?? ''}. Arrow keys step through values.`}
          onmousemove={(e) => {
            const i = catAtClientX(e.clientX, e.currentTarget)
            if (i != null) { denseIndex = i; hoverCat(e.clientX, e.clientY, i) }
          }}
          onmouseleave={clearActive}
          onfocus={(e) => focusCat(e.currentTarget, denseIndex)}
          onblur={clearActive}
          onclick={() => select(visibleSpec.categories[denseIndex] ?? '', '', 0, denseIndex)}
          onkeydown={onDenseKey}
        />
      {:else}
      {#each visibleSpec.categories as cat, i (cat + i)}
        {@const pts = geo.lines[0]?.points}
        {@const px = pts?.[i]?.x}
        {@const useTimeBands = !isHorizontal && pts && pts.length === visibleSpec.categories.length && Number.isFinite(px)}
        {@const prevX = useTimeBands && i > 0 ? pts![i - 1]!.x : null}
        {@const nextX = useTimeBands && i < pts!.length - 1 ? pts![i + 1]!.x : null}
        {@const bandL = !useTimeBands ? geo.plot.x + slot * i
                       : prevX != null ? (prevX + (px as number)) / 2 : geo.plot.x}
        {@const bandR = !useTimeBands ? geo.plot.x + slot * (i + 1)
                       : nextX != null ? ((px as number) + nextX) / 2 : geo.plot.x + geo.plot.w}
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events a11y_no_noninteractive_tabindex -->
        <rect
          class="sv-grid-chart-cat-hit"
          x={isHorizontal ? geo.plot.x : bandL}
          y={isHorizontal ? geo.plot.y + slot * i : geo.plot.y}
          width={isHorizontal ? geo.plot.w : Math.max(0, bandR - bandL)}
          height={isHorizontal ? slot : geo.plot.h}
          role={onSelect ? 'button' : 'img'}
          tabindex={interactive ? (i === 0 ? 0 : -1) : undefined}
          data-cat-index={i}
          aria-label={`${cat}: ${catRows(i).map((r) => `${r.label} ${r.value}`).join(', ')}`}
          onmousemove={(e) => hoverCat(e.clientX, e.clientY, i)}
          onmouseleave={clearActive}
          onfocus={(e) => focusCat(e.currentTarget, i)}
          onblur={clearActive}
          onclick={() => select(cat, '', 0, i)}
          onkeydown={(e) => onCatKey(e, i)}
        />
      {/each}
      {/if}
    {/if}

    {#if dragRect}
      <rect class="sv-grid-chart-zoom-rect"
        x={dragRect.x} y={dragRect.y} width={dragRect.w} height={dragRect.h} />
    {/if}
  </svg>

  {#if brushEligible && brushGeo}
    {@const bx = brushGeo.plot.x + brushWindow.t0 * brushGeo.plot.w}
    {@const bw = (brushWindow.t1 - brushWindow.t0) * brushGeo.plot.w}
    <svg
      class="sv-grid-chart-brush"
      viewBox={`0 0 ${brushGeo.width} ${brushGeo.height}`}
      width="100%"
      role="img"
      aria-label="Range brush"
      onpointermove={onBrushMove}
    >
      <!-- Mini chart: paint a faint version of the lines / area / bars
           so the user sees what region they're picking from. -->
      {#each brushGeo.lines as line, li (li)}
        {#if line.areaPath}
          <path d={line.areaPath} fill={line.color} fill-opacity="0.10" stroke="none" />
        {/if}
        <path d={line.path} fill="none" stroke={line.color} stroke-width="1.2" opacity="0.75" />
      {/each}
      {#each brushGeo.bars as bar, bi (bi)}
        <rect x={bar.x} y={bar.y} width={bar.w} height={bar.h} fill={bar.color} opacity="0.55" />
      {/each}
      <!-- Faded overlay on the parts NOT in the window. -->
      <rect class="sv-grid-chart-brush-mask"
        x={brushGeo.plot.x} y={brushGeo.plot.y}
        width={bx - brushGeo.plot.x} height={brushGeo.plot.h} />
      <rect class="sv-grid-chart-brush-mask"
        x={bx + bw} y={brushGeo.plot.y}
        width={brushGeo.plot.x + brushGeo.plot.w - (bx + bw)} height={brushGeo.plot.h} />
      <!-- The window body: pointerdown moves the whole window. -->
      <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events -->
      <rect class="sv-grid-chart-brush-window"
        x={bx} y={brushGeo.plot.y} width={bw} height={brushGeo.plot.h}
        onpointerdown={(e) => onBrushDown(e, 'move')}
        onpointerup={onBrushUp}
        onpointercancel={onBrushUp} />
      <!-- Left + right handles: pointerdown resizes that edge. -->
      <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events -->
      <rect class="sv-grid-chart-brush-handle"
        x={bx - 4} y={brushGeo.plot.y} width="8" height={brushGeo.plot.h}
        onpointerdown={(e) => onBrushDown(e, 'left')}
        onpointerup={onBrushUp}
        onpointercancel={onBrushUp} />
      <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events -->
      <rect class="sv-grid-chart-brush-handle"
        x={bx + bw - 4} y={brushGeo.plot.y} width="8" height={brushGeo.plot.h}
        onpointerdown={(e) => onBrushDown(e, 'right')}
        onpointerup={onBrushUp}
        onpointercancel={onBrushUp} />
    </svg>
  {/if}

  {#if isEmpty}
    <div class="sv-grid-chart-empty">No data</div>
  {/if}

  {#if tip}
    <div class="sv-grid-chart-tooltip" class:is-below={tip.below} style={`left:${tip.left}px; top:${tip.top}px;`}>
      <span class="sv-grid-chart-tooltip-title">{tip.title}</span>
      {#each tip.rows as r, ri (ri)}
        <span class="sv-grid-chart-tooltip-row">
          {#if r.color}<span class="sv-grid-chart-tooltip-dot" style={`background:${r.color}`}></span>{/if}
          {#if r.label}<span class="sv-grid-chart-tooltip-row-label">{r.label}</span>{/if}
          <span class="sv-grid-chart-tooltip-row-value">{r.value}</span>
        </span>
      {/each}
    </div>
  {/if}

  {#if legend && legendItems.length}
    <div class="sv-grid-chart-legend">
      {#each shownLegend as item (item.label)}
        <button
          type="button"
          class="sv-grid-chart-legend-item"
          class:is-off={item.off}
          class:is-isolated={isolated === item.label}
          disabled={!interactive}
          aria-pressed={!item.off}
          onclick={() => toggle(item.label)}
          ondblclick={() => isolate(item.label)}
          onpointerenter={() => interactive && (dimmed = item.label)}
          onpointerleave={() => (dimmed = null)}
          title={interactive ? `${item.off ? 'Show' : 'Hide'} ${item.label} · double-click to isolate` : item.label}
        >
          <span class="sv-grid-chart-swatch" style={`background:${item.off ? 'transparent' : item.color}; border-color:${item.color}`}></span>
          {item.label}
        </button>
      {/each}
      {#if legendOverflow}
        <button type="button" class="sv-grid-chart-legend-more" onclick={() => (legendExpanded = !legendExpanded)}>
          {legendExpanded ? 'Show less' : `+${legendItems.length - LEGEND_MAX} more`}
        </button>
      {/if}
    </div>
  {/if}

  <!-- Visually-hidden data table: the same data for assistive technology.
       Capped, and the caption says so. A table with 100k rows is not an
       accessible version of anything - nobody traverses that with a screen
       reader, and rendering it was a third of the DOM cost of a large chart.
       Saying "first 1000 of 100000" is more use than silently truncating, and
       more honest than pretending the whole set is readable here. -->
  <table id={`${uid}-table`} class="sv-grid-chart-sr-only">
    <caption>
      {spec.type} chart data{#if srCapped}, first {SR_ROW_CAP} of {srTable.rows.length} rows{/if}
    </caption>
    <thead>
      <tr>{#each srTable.cols as c (c)}<th>{c}</th>{/each}</tr>
    </thead>
    <tbody>
      {#each srRows as row, ri (ri)}
        <tr>{#each row as cell, ci (ci)}<td>{cell}</td>{/each}</tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .sv-grid-chart {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }
  .sv-grid-chart-svg {
    display: block;
    width: 100%;
    height: auto;
  }
  .sv-grid-chart-gridline {
    stroke: var(--sg-border, #e2e8f0);
    stroke-width: 1;
    opacity: 0.6;
  }
  .sv-grid-chart-gridline.is-zero {
    stroke: var(--sg-muted, #94a3b8);
    opacity: 0.9;
  }
  .sv-grid-chart-axis {
    fill: var(--sg-muted, #64748b);
    font-size: 10px;
    font-family: inherit;
  }
  .sv-grid-chart-axis-title {
    fill: var(--sg-muted, #64748b);
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
  }
  .sv-grid-chart-group-label {
    fill: var(--sg-fg, #0f172a);
    font-weight: 600;
  }
  .sv-grid-chart-crosshair {
    stroke: var(--sg-accent, #2563eb);
    stroke-width: 1;
    stroke-dasharray: 3 3;
    opacity: 0.65;
    pointer-events: none;
  }
  .sv-grid-chart-refline {
    stroke-width: 1.5;
    opacity: 0.9;
    pointer-events: none;
  }
  .sv-grid-chart-reflabel {
    font-size: 9.5px;
    font-weight: 700;
    font-family: inherit;
    pointer-events: none;
  }
  .sv-grid-chart-overlay {
    opacity: 0.85;
    pointer-events: none;
  }
  .sv-grid-chart-annotation-marker {
    pointer-events: none;
  }
  .sv-grid-chart-annotation-label {
    font-size: 10px;
    font-weight: 700;
    font-family: inherit;
    pointer-events: none;
  }
  /* Heatmap cells. Stroke uses the border token (not bg) so the cell
     separators stay visible in BOTH light and dark themes - on dark mode
     a bg-colored stroke disappeared into the navy cells. */
  .sv-grid-chart-heatcell {
    stroke: var(--sg-border, #cbd5e1);
    stroke-width: 1;
    transition: opacity 100ms ease;
    cursor: default;
  }
  .sv-grid-chart-svg.is-clickable .sv-grid-chart-heatcell { cursor: pointer; }
  .sv-grid-chart-heatcell:hover { opacity: 0.85; }
  .sv-grid-chart-heatlabel {
    font-size: 10px;
    font-weight: 600;
    font-family: inherit;
    pointer-events: none;
    user-select: none;
  }
  /* Legend gradient bar gets a visible outline + axis labels next to it
     pull from the regular axis class so they follow the theme. */
  .sv-grid-chart-heatlegend {
    stroke: var(--sg-border, #cbd5e1);
    stroke-width: 1;
  }
  /* Funnel segments + labels. */
  .sv-grid-chart-funnel-seg {
    stroke: var(--sg-bg, #ffffff);
    stroke-width: 2;
    transition: opacity 100ms ease;
    cursor: default;
  }
  .sv-grid-chart-svg.is-clickable .sv-grid-chart-funnel-seg { cursor: pointer; }
  .sv-grid-chart-funnel-seg:hover { opacity: 0.88; }
  .sv-grid-chart-funnel-label {
    font-size: 11px;
    font-weight: 700;
    font-family: inherit;
    pointer-events: none;
  }
  .sv-grid-chart-funnel-value {
    font-size: 10px;
    font-family: inherit;
    opacity: 0.85;
    pointer-events: none;
  }
  /* Radar grid + polygons. */
  .sv-grid-chart-radar-ring {
    fill: none;
    stroke: var(--sg-border, #e2e8f0);
    stroke-width: 1;
    opacity: 0.6;
  }
  .sv-grid-chart-radar-spoke {
    stroke: var(--sg-border, #e2e8f0);
    stroke-width: 1;
    opacity: 0.6;
  }
  .sv-grid-chart-radar-poly {
    transition: opacity 100ms ease;
    pointer-events: none;
  }
  .sv-grid-chart-radar-dot {
    transition: r 100ms ease;
    cursor: default;
  }
  .sv-grid-chart-radar-dot:hover { r: 4.5; }
  /* Calendar heatmap cells. Blank cells get a faint outline so the grid
     still reads on days with no data. */
  .sv-grid-chart-calendar-cell {
    stroke: var(--sg-border, #e2e8f0);
    stroke-width: 0.5;
    transition: opacity 100ms ease;
    cursor: default;
  }
  .sv-grid-chart-calendar-cell.is-blank { stroke-opacity: 0.5; }
  .sv-grid-chart-calendar-cell:hover { opacity: 0.85; }
  .sv-grid-chart-calendar-legend {
    stroke: var(--sg-border, #cbd5e1);
    stroke-width: 0.5;
  }
  /* Gauge centre readout. */
  .sv-grid-chart-gauge-value {
    fill: var(--sg-fg, #0f172a);
    font-size: 22px;
    font-weight: 800;
    font-family: inherit;
    pointer-events: none;
  }
  /* Gauge tick marks: faint minors, stronger majors. */
  .sv-grid-chart-gauge-tick {
    stroke: var(--sg-muted, #94a3b8);
    stroke-width: 1;
    opacity: 0.4;
  }
  .sv-grid-chart-gauge-tick.is-major {
    stroke-width: 2;
    opacity: 0.7;
  }
  /* Pointer needle + hub. */
  .sv-grid-chart-gauge-needle {
    stroke: var(--sg-bg, #ffffff);
    stroke-width: 0.75;
    stroke-linejoin: round;
  }
  .sv-grid-chart-gauge-hub {
    fill: var(--sg-fg, #0f172a);
    stroke: var(--sg-bg, #ffffff);
    stroke-width: 2;
  }
  .sv-grid-chart-gauge-hub-dot {
    fill: var(--sg-bg, #ffffff);
  }
  /* Tree-map cells. White separators give the squarified rects breathing
     room without distracting from the data. */
  .sv-grid-chart-treemap-cell {
    stroke: var(--sg-bg, #ffffff);
    stroke-width: 1;
    transition: opacity 100ms ease;
    cursor: default;
  }
  .sv-grid-chart-svg.is-clickable .sv-grid-chart-treemap-cell { cursor: pointer; }
  .sv-grid-chart-treemap-cell:hover { opacity: 0.88; }
  .sv-grid-chart-treemap-label {
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    pointer-events: none;
  }
  .sv-grid-chart-treemap-value {
    font-size: 10px;
    font-family: inherit;
    pointer-events: none;
  }
  /* Sankey nodes + links. Links use stroke not fill so per-ribbon width
     comes from stroke-width directly. */
  .sv-grid-chart-sankey-node {
    transition: opacity 100ms ease;
    cursor: default;
  }
  .sv-grid-chart-sankey-node:hover { opacity: 0.88; }
  .sv-grid-chart-sankey-link {
    transition: stroke-opacity 100ms ease;
    cursor: default;
  }
  .sv-grid-chart-sankey-link:hover { stroke-opacity: 0.6; }
  .sv-grid-chart-sankey-label {
    fill: var(--sg-fg, #0f172a);
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    pointer-events: none;
  }
  /* Brush mini-map: a compact secondary chart with a draggable window. */
  .sv-grid-chart-brush {
    display: block;
    width: 100%;
    height: auto;
    margin-top: 4px;
    border-top: 1px solid var(--sg-border, #e2e8f0);
    user-select: none;
    touch-action: none;
  }
  .sv-grid-chart-brush-mask {
    fill: var(--sg-bg, #ffffff);
    fill-opacity: 0.65;
    pointer-events: none;
  }
  .sv-grid-chart-brush-window {
    fill: var(--sg-accent, #2563eb);
    fill-opacity: 0.10;
    stroke: var(--sg-accent, #2563eb);
    stroke-width: 1;
    cursor: grab;
  }
  .sv-grid-chart-brush-window:active { cursor: grabbing; }
  .sv-grid-chart-brush-handle {
    fill: var(--sg-accent, #2563eb);
    fill-opacity: 0.4;
    cursor: ew-resize;
  }
  .sv-grid-chart-brush-handle:hover { fill-opacity: 0.7; }
  .sv-grid-chart-scatter {
    transition: opacity 0.2s ease;
    stroke-width: 1;
  }
  .is-clickable .sv-grid-chart-scatter,
  .sv-grid-chart-scatter:hover {
    cursor: pointer;
  }
  .sv-grid-chart-cat-hit {
    fill: transparent;
  }
  .sv-grid-chart-cat-hit:focus-visible,
  .sv-grid-chart-slice:focus-visible {
    outline: 2px solid var(--sg-accent, #2563eb);
    outline-offset: 1px;
  }
  .sv-grid-chart-datalabel {
    fill: var(--sg-fg, #0f172a);
    font-size: 9.5px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    pointer-events: none;
  }
  .sv-grid-chart-datalabel.on-bar {
    fill: #fff;
  }
  .sv-grid-chart-donut-total {
    fill: var(--sg-fg, #0f172a);
    font-size: 16px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .sv-grid-chart-donut-label {
    fill: var(--sg-muted, #64748b);
    font-size: 10px;
  }
  .sv-grid-chart-bar {
    transition: x 0.3s ease, y 0.3s ease, width 0.3s ease, height 0.3s ease;
  }
  .sv-grid-chart-dot {
    transition: cx 0.3s ease, cy 0.3s ease;
  }
  .sv-grid-chart-candle {
    stroke-width: 1;
    transition: x 0.3s ease, y 0.3s ease, width 0.3s ease, height 0.3s ease;
  }
  .sv-grid-chart-wick,
  .sv-grid-chart-ohlc {
    stroke-width: 1;
    shape-rendering: crispEdges;
  }
  .sv-grid-chart-box {
    stroke-width: 1;
    transition: x 0.3s ease, y 0.3s ease, width 0.3s ease, height 0.3s ease;
  }
  .sv-grid-chart-whisker,
  .sv-grid-chart-errorbar {
    stroke-width: 1;
    shape-rendering: crispEdges;
  }
  /* The median is the number people read off a box plot, so it gets the
     weight. Everything else on the mark is 1px. */
  .sv-grid-chart-median {
    stroke-width: 2;
    shape-rendering: crispEdges;
  }
  .sv-grid-chart-outlier {
    stroke-width: 1;
  }
  .is-clickable .sv-grid-chart-cat-hit,
  .is-clickable .sv-grid-chart-slice {
    cursor: pointer;
  }

  .sv-grid-chart-empty {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--sg-muted, #94a3b8);
    font-size: 13px;
    pointer-events: none;
  }

  /* Toolbar above the chart: reset-zoom, PNG / SVG / Copy. */
  .sv-grid-chart-toolbar {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
    flex-wrap: wrap;
  }
  .sv-grid-chart-tool {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    font-size: 11px;
    font-weight: 500;
    padding: 3px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 100ms ease, border-color 100ms ease;
  }
  .sv-grid-chart-tool:hover {
    background: var(--sg-row-hover-bg, #f1f5f9);
    border-color: var(--sg-accent, #2563eb);
  }

  /* Drag-to-zoom: translucent accent rectangle over the plot. */
  .sv-grid-chart-svg.is-zoomable { cursor: crosshair; }
  .sv-grid-chart-svg.is-dragging { cursor: crosshair; user-select: none; }
  .sv-grid-chart-zoom-rect {
    fill: var(--sg-accent, #2563eb);
    fill-opacity: 0.12;
    stroke: var(--sg-accent, #2563eb);
    stroke-width: 1;
    stroke-dasharray: 3 3;
    pointer-events: none;
  }

  .sv-grid-chart-tooltip {
    position: absolute;
    z-index: 10;
    transform: translate(-50%, calc(-100% - 12px));
    pointer-events: none;
    white-space: nowrap;
    padding: 6px 9px;
    border-radius: 6px;
    background: var(--sg-fg, #0f172a);
    color: var(--sg-bg, #fff);
    font-size: 11.5px;
    line-height: 1.4;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .sv-grid-chart-tooltip.is-below {
    transform: translate(-50%, 16px);
  }
  .sv-grid-chart-tooltip-title {
    opacity: 0.75;
    font-size: 10.5px;
    margin-bottom: 1px;
  }
  .sv-grid-chart-tooltip-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .sv-grid-chart-tooltip-dot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    flex-shrink: 0;
  }
  .sv-grid-chart-tooltip-row-label {
    opacity: 0.85;
  }
  .sv-grid-chart-tooltip-row-value {
    margin-left: auto;
    padding-left: 10px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .sv-grid-chart-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 12px;
    font-size: 12px;
    color: var(--sg-fg, #0f172a);
  }
  .sv-grid-chart-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    padding: 1px 2px;
    border-radius: 4px;
    cursor: pointer;
  }
  .sv-grid-chart-legend-item:disabled {
    cursor: default;
  }
  .sv-grid-chart-legend-item.is-off {
    color: var(--sg-muted, #94a3b8);
    text-decoration: line-through;
  }
  .sv-grid-chart-legend-item.is-isolated {
    background: var(--sg-header-bg, #f1f5f9);
    font-weight: 700;
  }
  .sv-grid-chart-legend-more {
    border: 1px dashed var(--sg-border, #cbd5e1);
    background: transparent;
    color: var(--sg-muted, #64748b);
    font: inherit;
    font-size: 11px;
    padding: 1px 7px;
    border-radius: 999px;
    cursor: pointer;
  }
  .sv-grid-chart-legend-more:hover {
    color: var(--sg-fg, #0f172a);
    border-color: var(--sg-accent, #2563eb);
  }
  .sv-grid-chart-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
  .sv-grid-chart-swatch {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    border: 1.5px solid transparent;
    display: inline-block;
    box-sizing: border-box;
  }

  /* Reduced motion. Every other animated component in the kit honours this
     (SvCard, SvCircularProgress, SvCollapsible); the chart never did, so a
     reader who has asked the OS for less movement still got every bar, dot,
     candle and box sliding on each re-aggregation - and a chart re-aggregates
     on every filter keystroke, which is the worst case for it. */
  @media (prefers-reduced-motion: reduce) {
    .sv-grid-chart-bar,
    .sv-grid-chart-dot,
    .sv-grid-chart-candle,
    .sv-grid-chart-box {
      transition: none;
    }
  }
</style>
