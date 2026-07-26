<script lang="ts">
  /**
   * SvGridChart - renders a `ChartSpec` as inline SVG. Supports grouped +
   * stacked bars, line, area, pie / donut, combo charts (per-series type),
   * a secondary Y axis, signed Y domains, and axis titles. Interactive: a
   * unified crosshair tooltip (hover a category -> all series at once),
   * focus tooltips, a clickable legend that toggles series, optional data
   * labels, and an `onSelect` drill hook. No external charting dependency.
   */
  import { buildChart, DEFAULT_PALETTE, formatChartValue, type ChartSpec, type ChartSelection } from './chart'

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
        ? formatChartValue(v, spec.valueFormat)
        : Number.isFinite(v)
          ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
          : String(v)

  let hidden = $state(new Set<string>())
  // Isolate: double-clicking a legend chip shows ONLY that series/slice.
  let isolated = $state<string | null>(null)
  // Hover-dim: hovering a legend chip dims the other series (visual only).
  let dimmed = $state<string | null>(null)
  const palette = $derived(spec.palette ?? DEFAULT_PALETTE)
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
    series: coloredSeries.filter((s) => !effectiveHidden.has(s.label)),
  })
  const brushGeo = $derived(brushEligible ? buildChart(brushSpec) : null)
  /** The brush window in fractional [0..1] of the visible data range,
   *  derived from `zoom`. When not zoomed, the window covers everything. */
  const brushWindow = $derived.by(() => {
    const n = spec.categories.length
    if (!zoom || n === 0) return { t0: 0, t1: 1 }
    return { t0: zoom.i0 / n, t1: (zoom.i1 + 1) / n }
  })

  /** Map a brush-svg-local x to a category index in the FULL data range. */
  function brushXToIndex(localX: number): number {
    if (!brushGeo) return 0
    const w = brushGeo.plot.w
    const x = Math.max(0, Math.min(w, localX - brushGeo.plot.x))
    const n = spec.categories.length
    return Math.max(0, Math.min(n - 1, Math.floor((x / w) * n)))
  }
  type BrushDrag = { mode: 'move' | 'left' | 'right'; startX: number; startT0: number; startT1: number }
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
    // Slice categories + each series' values to the zoom window so
    // buildChart re-spreads the visible slice across the full plot.
    const lo = Math.max(0, zoom.i0)
    const hi = Math.min(spec.categories.length - 1, zoom.i1)
    const slice = <T,>(arr: T[]) => arr.slice(lo, hi + 1)
    return {
      ...spec,
      categories: slice(spec.categories),
      series: visibleSeries.map((s) => ({
        ...s,
        values: slice(s.values),
        rowIds: s.rowIds ? slice(s.rowIds) : undefined,
      })),
    }
  })

  // Heatmap / calendar cell fills are computed colors (not CSS), so they can't
  // inherit the theme. We detect the surface luminance (see the $effect near
  // chartEl) and hand buildChart a light/dark hint so low-value cells render as
  // "cold" rather than glaring white rectangles on a dark grid.
  let isDark = $state(false)
  const geo = $derived(
    buildChart(width || height ? { ...visibleSpec, width, height } : visibleSpec, isDark ? 'dark' : 'light'),
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
    return {
      cols: ['Category', ...coloredSeries.map((s) => s.label)],
      rows: spec.categories.map((c, i) => [c, ...coloredSeries.map((s) => fmt(s.values[i] ?? 0))]),
    }
  })
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
  $effect(() => {
    if (!chartEl || typeof window === 'undefined') return
    const el = chartEl
    const check = () => { isDark = surfaceIsDark(getComputedStyle(el).getPropertyValue('--sg-bg')) }
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
    return visibleSpec.series
      .map((s) => ({ label: s.label, color: (s as { color?: string }).color, value: s.values[i] }))
      .filter((r) => Number.isFinite(r.value))
      .map((r) => ({ label: r.label, color: r.color, value: fmt(r.value as number) }))
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
        {#each line.points as pt, pi (pi)}
          {#if pt.defined}
            <circle class="sv-grid-chart-dot" class:is-active={activeCat === pi} cx={pt.x} cy={pt.y} r={activeCat === pi ? 4 : 3} fill={line.color} />
            {#if dataLabels}
              <text class="sv-grid-chart-datalabel" x={pt.x} y={pt.y - 7} text-anchor="middle">{fmt(pt.value)}</text>
            {/if}
          {/if}
        {/each}
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
      {#each geo.radarRings as v, ri (ri)}
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
      <!-- Optional colored range bands (a thinner inner arc). -->
      {#each g.rangePaths as band, bi (bi)}
        <path d={band.path} fill="none" stroke={band.color} stroke-width="6" stroke-linecap="round" opacity="0.85" />
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

  <!-- Visually-hidden data table: the same data for assistive technology. -->
  <table id={`${uid}-table`} class="sv-grid-chart-sr-only">
    <caption>{spec.type} chart data</caption>
    <thead>
      <tr>{#each srTable.cols as c (c)}<th>{c}</th>{/each}</tr>
    </thead>
    <tbody>
      {#each srTable.rows as row, ri (ri)}
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
</style>
