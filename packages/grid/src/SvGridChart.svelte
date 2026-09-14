<script lang="ts">
  /**
   * SvGridChart - renders a `ChartSpec` as inline SVG. Supports grouped +
   * stacked bars, line, area, pie / donut, combo charts (per-series type),
   * a secondary Y axis, signed Y domains, and axis titles. Interactive: a
   * unified crosshair tooltip (hover a category -> all series at once),
   * focus tooltips, a clickable legend that toggles series, optional data
   * labels, and an `onSelect` drill hook. No external charting dependency.
   */
  import { buildChart, chartScales, chartStyleVars, DEFAULT_PALETTE, formatChartValue, sliceChartWindow, decimateSpec, matchResponsiveRules, resolveResponsive, type ChartSpec, type ChartSelection } from './chart'
  import { dateGrain, fmtDateFull } from './chart-scale'
  import { layoutDataLabels, markerPath } from './chart-cartesian'
  import { nearestIndexByTime, panWindow, pinchWindow, presetWindow, wheelWindow, type ChartRangePreset } from './chart-zoom'
  import { publishSyncHover, publishSyncZoom, syncGroupState } from './chart-sync.svelte'
  import { interpolateGeometry } from './chart-motion'
  import { drillTree, pathTo } from './chart-hierarchy'
  import type { ChartDataLabelConfig, ChartDrawing, ChartDrawingKind, ChartGeometry, ChartPointRef, TreeNode } from './chart-types'
  import { downloadChartCsv, chartCsvExportable } from './chart-export'
  import type { MenuItem } from './menu-item'
  import { tick, untrack } from 'svelte'
  import type { ChartZoomWindow } from './chart-types'
  import { chartMessage as msg, resolveChartMessages } from './chart-messages'
  import { DEV } from 'esm-env'
  import { overlayName } from './chart-indicators'
  import type { ChartAnimateConfig, ChartContextTarget, ChartHoverPoint, ChartRenderContext, ChartTooltipContext, ChartTooltipRow, ChartZoomConfig, SvChartProps } from './SvGridChart.types'
  let {
    spec: specProp,
    legend = true,
    legendItem,
    interactive = true,
    dataLabels,
    formatValue,
    tooltip,
    tooltipFormat,
    tooltipMode = 'shared',
    tooltipPosition = 'follow',
    tooltipSticky = false,
    onSelect,
    onDrill,
    zoomable = false,
    zoom = $bindable(null),
    onZoom,
    rangePresets = false,
    syncGroup,
    contextMenu = false,
    animate = false,
    drillable = false,
    drillPath = $bindable([]),
    selectable = false,
    selected = $bindable([]),
    onSelectionChange,
    announce = true,
    describe = true,
    live = false,
    onHover,
    hoverHighlight = true,
    localeText,
    crosshairLabels = true,
    brush = false,
    brushHeight = 88,
    toolbar,
    width,
    height,
    autosize = false,
    underlay,
    overlay,
    annotatable = false,
    onAnnotate,
    onAnnotationRemove,
    drawable = false,
    onDrawingsChange,
  }: SvChartProps = $props()
  /** The chart's own strings, `localeText` merged over the English defaults. */
  const t = $derived(resolveChartMessages(localeText))
  /** The chart in a sentence, for the SVG's description and the menu. */
  let summary = $state('')
  $effect(() => {
    if (!describe) { summary = ''; return }
    const s = visibleSpec
    let live = true
    void import('./chart-summary').then(({ chartSummary }) => { if (live) summary = chartSummary(s) })
    return () => { live = false }
  })
  async function copySummary() {
    if (!summary) return
    try { await navigator.clipboard?.writeText(summary) } catch { /* no clipboard: the live region still reads it */ }
    liveText = `${t.describeCopied}. ${summary}`
  }
  // In development, say what is off about a spec: a misspelt key, a values
  // array one short of the categories, a log axis pinned at zero. Once per
  // spec object, from the lazily loaded validator, so production and the
  // chart chunk pay nothing for it.
  if (DEV) {
    $effect(() => {
      const s = specProp
      void import('./chart-validate').then(({ warnChartSpec }) => warnChartSpec(s))
    })
  }
  /**
   * The size the responsive rules are judged at: the `width` / `height`
   * props, else the host's box under `autosize`, else the spec's own size.
   * The component's size, not the plot's, on purpose: the plot is narrower
   * when the legend sits beside it, and a rule that moves the legend would
   * otherwise change the very width it was matched on.
   */
  /** The host's box (a ResizeObserver underneath; 0 in jsdom). */
  let hostW = $state(0)
  let hostH = $state(0)
  const ruleW = $derived(width ?? (autosize && hostW > 24 ? hostW : specProp.width ?? 520))
  const ruleH = $derived(height ?? (autosize && hostH > 24 ? hostH : specProp.height ?? 300))
  /** The legend a responsive rule asks for at that size. */
  const responsiveLegend = $derived.by(() => {
    if (!specProp.responsive?.length) return undefined
    let out: boolean | 'top' | 'bottom' | 'left' | 'right' | undefined
    for (const r of matchResponsiveRules(specProp.responsive, ruleW, ruleH)) if (r.legend !== undefined) out = r.legend
    return out
  })
  /**
   * The spec with its responsive rules applied at that size. Resolved here,
   * once, so everything the component reads off the spec (axis titles, the
   * legend's series, the label config) agrees with what the engine draws, and
   * the rules are dropped from what goes on to the engine: it would judge
   * them again at the plot's size, and the brush at its own.
   */
  const spec = $derived.by<ChartSpec>(() => {
    if (!specProp.responsive?.length) return specProp
    const { responsive: _rules, ...resolved } = resolveResponsive(specProp, ruleW, ruleH)
    return resolved
  })
  const legendWanted = $derived(responsiveLegend ?? legend)
  /** Where the legend goes; `true` keeps the historical spot under the plot. */
  const legendPos = $derived(legendWanted === true ? 'bottom' : legendWanted === false ? null : legendWanted)
  const legendSide = $derived(legendPos === 'left' || legendPos === 'right')

  // ---- Autosize --------------------------------------------------------
  // The host box and the chrome inside it, measured by Svelte's dimension
  // bindings (a ResizeObserver underneath). The SVG is laid out at whatever is
  // left once the toolbar, the legend and the brush have taken their share, so
  // its labels and gutters are computed for the pixels it actually gets rather
  // than scaled down from a default viewBox. jsdom reports 0 for all of these,
  // which falls straight through to the spec size.
  let toolbarH = $state(0)
  let legendW = $state(0)
  let legendH = $state(0)
  let brushH = $state(0)
  const GAP = 8
  const autoSize = $derived.by(() => {
    if (!autosize || hostW <= 24) return null
    // A dimension binding keeps its last value after its element is removed,
    // so a legend hidden at runtime (a responsive rule, `legend={false}`)
    // would go on being subtracted. In a plain block that is a ratchet: the
    // host shrinks by the phantom legend, the plot follows, and again, down
    // to the floor. Read each measurement only while its element is mounted,
    // judged off the raw prop: the resolved spec depends on this size.
    const tb = showToolbar ? toolbarH : 0
    const lgH = legendPos ? legendH : 0
    const lgW = legendPos ? legendW : 0
    const br = brush && !NO_AXIS_TYPES.has(specProp.type) ? brushH : 0
    const w = Math.max(120, Math.round(hostW - (legendSide ? lgW + GAP : 0)))
    const chrome = tb + (legendSide ? 0 : lgH) + br
    // The column is a flex box, so only the chrome that exists adds a gap. A
    // side legend is a three-row grid (toolbar, plot, brush) with a gap
    // between every track, empty or not: two gaps, always. Counting one when
    // the brush was absent left 8px unaccounted for, and in a plain block the
    // host grew by that much every measurement, without end.
    const gaps = legendSide ? 2 * GAP : (tb ? GAP : 0) + (lgH ? GAP : 0) + (br ? GAP : 0)
    const h = hostH > 24 ? Math.max(120, Math.round(hostH - chrome - gaps)) : undefined
    return { width: w, height: h }
  })
  const layoutW = $derived(width ?? autoSize?.width)
  const layoutH = $derived(height ?? autoSize?.height)

  /** Data-label config with `true` expanded to the defaults. */
  const labelCfg = $derived<ChartDataLabelConfig & { show: boolean }>(
    typeof dataLabels === 'object'
      ? { show: true, ...dataLabels }
      : dataLabels !== undefined
        ? { show: !!dataLabels }
        : spec.dataLabels
          ? { show: spec.dataLabels.show !== false, ...spec.dataLabels }
          : { show: false },
  )
  /** The zoom gestures, with `true` meaning the drag rubber band alone. */
  const zoomCfg = $derived<Required<ChartZoomConfig> | null>(
    !zoomable
      ? null
      : zoomable === true
        ? { drag: true, wheel: false, pinch: false, pan: false, axis: 'x' }
        : {
            drag: zoomable.drag !== false,
            wheel: zoomable.wheel ?? false,
            pinch: zoomable.pinch ?? !!zoomable.wheel,
            pan: zoomable.pan ?? false,
            axis: zoomable.axis ?? 'x',
          },
  )
  /** Pan mode toggled from the toolbar (`pan: 'mode'` or `true`). */
  let panMode = $state(false)
  const showToolbar = $derived(toolbar ?? (!!zoomable || !!onDrill || annotatable || !!rangePresets || drillable || !!drawable))
  /** Annotate mode is off until the reader asks for it: it takes over the plot
   *  click, which is the drill gesture the rest of the time. */
  let annotating = $state(false)

  const fmt = (v: number) =>
    formatValue
      ? formatValue(v)
      : spec.valueFormat
        ? formatChartValue(v, spec.valueFormat, spec)
        : Number.isFinite(v)
          ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
          : String(v)
  // A series on the right axis reads in that axis's format: a margin of 0.29
  // beside a revenue in dollars is "29%", not "$0.29". Without a format of
  // its own the right axis is plain numbers, the way its ticks are drawn.
  const rightFmt = $derived.by<(v: number) => string>(() => {
    const ax = spec.y2Axis
    if (formatValue) return formatValue
    if (ax?.formatter) return (v) => ax.formatter!(v, -1)
    if (ax?.format) return (v) => formatChartValue(v, ax.format!, spec)
    return (v) => (Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v))
  })
  const rightSeries = $derived(new Set(spec.series.filter((s) => s.axis === 'right').map((s) => s.label)))
  /** The formatter for a series' values: the right axis's for a series plotted there, the chart's otherwise. */
  const fmtFor = (series: string | undefined) => (series && rightSeries.has(series) ? rightFmt : fmt)

  // Series that start hidden come from `visible: false`; after that the set
  // is the reader's, through the legend.
  // svelte-ignore state_referenced_locally
  let hidden = $state(new Set<string>(specProp.series.filter((s) => s.visible === false).map((s) => s.label)))
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
    const labels = spec.type === 'pie' ? pieCategories : spec.series.map((s) => s.label)
    return new Set(labels.filter((l) => l !== isolated))
  })

  // ---- Zoom state ------------------------------------------------------
  // `zoom` (a bindable prop) holds inclusive integer category indices
  // [i0, i1] of the visible window, plus an optional value-axis window. null
  // = no zoom (show everything). Pie charts don't support zoom; their
  // pseudo-categories are slices, not an axis. Every path that changes it goes
  // through `setZoom` so the `onZoom` callback fires once per change.
  const isZoomed = $derived(zoom !== null)
  function setZoom(next: ChartZoomWindow | null) {
    const same =
      (next === null && zoom === null) ||
      (next !== null && zoom !== null && next.i0 === zoom.i0 && next.i1 === zoom.i1 &&
        (next.y?.min ?? null) === (zoom.y?.min ?? null) && (next.y?.max ?? null) === (zoom.y?.max ?? null))
    if (same) return
    zoom = next
    onZoom?.(next)
    if (syncGroup && !applyingSync) {
      const n = spec.categories.length
      publishSyncZoom(syncGroup, next, n, me, next ? [spec.categories[next.i0] ?? '', spec.categories[next.i1] ?? ''] : null)
    }
  }
  // ---- Sync group ----------------------------------------------------------
  // Charts in a group publish their hover and window to a shared registry and
  // mirror each other's. `me` tags this chart's writes so it ignores its own
  // echoes; `applyingSync` stops a mirrored zoom from being republished.
  const me = Symbol('svchart')
  let applyingSync = false
  const syncState = $derived(syncGroup ? syncGroupState(syncGroup) : null)
  /** True while the crosshair here comes from another chart in the group. */
  let remoteHover = $state(false)
  /** Zoom to a window from outside: `bind:this={chart}; chart.zoomTo({ i0, i1 })`. */
  export function zoomTo(window: ChartZoomWindow | null) { setZoom(window) }
  /** Show the whole chart again. */
  export function resetZoom() { setZoom(null) }
  /** The category under a client x, in FULL-spec indices (not the window's). */
  function fullIndexAtClientX(clientX: number, target: Element): number | null {
    const i = catAtClientX(clientX, target)
    if (i == null) return null
    return (zoom ? zoom.i0 : 0) + i
  }
  /**
   * Mouse wheel zoom around the pointer. With `wheel: 'modifier'` a plain
   * wheel scrolls the page as usual and Ctrl / Cmd + wheel zooms; with `true`
   * the chart takes every wheel event over the plot.
   */
  function onWheel(e: WheelEvent) {
    if (!zoomCfg?.wheel || !isCartesian || annotating) return
    if (zoomCfg.wheel === 'modifier' && !(e.ctrlKey || e.metaKey)) return
    const p = svgPoint(e)
    if (!p || p.x < geo.plot.x || p.x > geo.plot.x + geo.plot.w) return
    e.preventDefault()
    const anchor = fullIndexAtClientX(e.clientX, e.currentTarget as Element) ?? 0
    const factor = e.deltaY > 0 ? 1.25 : 0.8
    setZoom(wheelWindow(zoom, spec.categories.length, anchor, factor))
  }
  // ---- Pinch: two pointers on the plot. --------------------------------
  const pointers = new Map<number, { x: number; y: number }>()
  let pinch: { dist: number; mid: number; start: ChartZoomWindow | null } | null = null
  let panDrag: { startIndex: number; start: ChartZoomWindow | null } | null = null
  const panActive = (e: PointerEvent) =>
    !!zoomCfg?.pan && isZoomed && (panMode || ((zoomCfg.pan === 'shift' || zoomCfg.pan === true) && e.shiftKey))

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

  function svgPoint(e: { clientX: number; clientY: number }): { x: number; y: number } | null {
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
    // Annotate mode takes the plot pointer over. Without this a click to pin an
    // annotation also starts a zoom drag, and the reader gets both. A drawing
    // tool or a handle drag does the same.
    if (annotating || tool || handleDrag) return
    if (!zoomCfg || !isCartesian) return
    const p = svgPoint(e)
    if (!p) return
    // Only start a drag inside the plot rect.
    if (p.x < geo.plot.x || p.x > geo.plot.x + geo.plot.w ||
        p.y < geo.plot.y || p.y > geo.plot.y + geo.plot.h) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    if (zoomCfg.pinch) {
      pointers.set(e.pointerId, p)
      if (pointers.size === 2) {
        // A second finger turns the drag into a pinch.
        const [a, b] = [...pointers.values()]
        pinch = { dist: Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1, mid: pointToCatIndex({ x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 }) + (zoom ? zoom.i0 : 0), start: zoom }
        dragStart = null
        dragEnd = null
        return
      }
    }
    if (panActive(e)) {
      panDrag = { startIndex: pointToCatIndex(p), start: zoom }
      return
    }
    if (!zoomCfg.drag) return
    dragStart = p
    dragEnd = p
  }
  function onZoomMove(e: PointerEvent) {
    if (pinch && pointers.has(e.pointerId)) {
      const p = svgPoint(e)
      if (p) pointers.set(e.pointerId, p)
      const [a, b] = [...pointers.values()]
      if (a && b) {
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
        setZoom(pinchWindow(pinch.start, spec.categories.length, pinch.mid, dist / pinch.dist))
      }
      return
    }
    if (panDrag) {
      const p = svgPoint(e)
      if (!p) return
      // Categories moved under the pointer since the drag began; the window
      // slides the other way, so the data follows the hand.
      const delta = panDrag.startIndex - pointToCatIndex(p)
      setZoom(panWindow(panDrag.start, spec.categories.length, delta))
      return
    }
    if (!dragStart) return
    dragEnd = svgPoint(e)
  }
  function onZoomUp(e?: PointerEvent) {
    if (e) pointers.delete(e.pointerId)
    if (pinch) { if (pointers.size < 2) pinch = null; return }
    if (panDrag) { panDrag = null; return }
    if (!dragStart || !dragEnd) { dragStart = null; dragEnd = null; return }
    const r = dragRect
    if (r) {
      // Map the drag's main-axis bounds to category indices. When already
      // zoomed, these indices are relative to the visible slice, so
      // translate back to the original `spec.categories` indexing.
      const axis = zoomCfg?.axis ?? 'x'
      const i0v = pointToCatIndex({ x: r.x, y: r.y })
      const i1v = pointToCatIndex({ x: r.x + r.w, y: r.y + r.h })
      const offset = zoom ? zoom.i0 : 0
      const lo = axis === 'y' ? (zoom?.i0 ?? 0) : offset + Math.min(i0v, i1v)
      const hi = axis === 'y' ? (zoom?.i1 ?? spec.categories.length - 1) : offset + Math.max(i0v, i1v)
      // A y window through the inverse scale, when the gesture covers the y axis.
      let y: ChartZoomWindow['y'] | undefined
      if (axis !== 'x' && renderScales && !isHorizontal) {
        const top = renderScales.yInvert(r.y)
        const bottom = renderScales.yInvert(r.y + r.h)
        if (Number.isFinite(top) && Number.isFinite(bottom) && top !== bottom) y = { min: Math.min(top, bottom), max: Math.max(top, bottom) }
      }
      if (hi > lo || y) setZoom({ i0: lo, i1: Math.max(lo, hi), ...(y ? { y } : {}) })
    }
    dragStart = null
    dragEnd = null
  }
  function onPlotDblClick() {
    if (zoomable && isZoomed) resetZoom()
  }

  // ---- Drawing tools -------------------------------------------------------
  // A tool takes the plot click over (like annotate mode) and turns pixels
  // into DATA points, so the drawing the host stores in `spec.drawings` lands
  // on the same values after a zoom, a resize or new data. The component
  // holds nothing but the gesture in flight and which drawing is selected.
  const ALL_TOOLS: ChartDrawingKind[] = ['trend', 'hray', 'fib', 'rect', 'arrow', 'text']
  const TOOL_LABEL = $derived<Record<ChartDrawingKind, string>>({ trend: t.toolTrend, hray: t.toolRay, fib: t.toolFib, rect: t.toolRect, arrow: t.toolArrow, text: t.toolText })
  const toolKinds = $derived<ChartDrawingKind[]>(!drawable ? [] : drawable === true ? ALL_TOOLS : drawable)
  let tool = $state<ChartDrawingKind | null>(null)
  /** The first point of a two-point drawing, waiting for the second. */
  let pending = $state<{ x: number | string; y: number; px: number; py: number } | null>(null)
  /** The pointer while a two-point drawing is being placed, for the preview. */
  let drawCursor = $state<{ x: number; y: number } | null>(null)
  let selectedDrawing = $state<string | null>(null)
  /** A note being typed: its data anchor and where the box sits over the host. */
  let textDraft = $state<{ x: number | string; y: number; left: number; top: number } | null>(null)
  // The typed text lives apart from the draft: a binding into a nullable
  // object reads it once more as the box unmounts.
  let textDraftValue = $state('')
  function commitTextDraft() {
    const d = textDraft
    const text = textDraftValue.trim()
    textDraft = null
    textDraftValue = ''
    if (!d || !text) return
    commitDrawings([...drawingsNow(), { id: `d${Date.now().toString(36)}${drawSeq++}`, kind: 'text', points: [{ x: d.x, y: d.y }], text }])
  }
  /** A handle being dragged: which drawing and which of its points. */
  let handleDrag = $state<{ id: string; index: number } | null>(null)
  let drawSeq = 0
  const drawingsNow = () => spec.drawings ?? []
  /** The data-space x under a plot pixel: a label on a category or ordinal
   *  axis, an ISO date on a time axis, a number on a numeric one. */
  function dataXAt(px: number): string | number | null {
    if (!renderScales) return null
    const ax = geo.axes?.x
    if (ax?.type === 'number') return renderScales.xInvertValue(px)
    if (ax?.type === 'time') return new Date(renderScales.xInvertValue(px)).toISOString()
    const i = Math.round(renderScales.xInvert(px))
    return visibleSpec.categories[i] ?? null
  }
  function dataPointAt(e: { clientX: number; clientY: number }): { x: number | string; y: number; px: number; py: number } | null {
    const vp = svgPoint(e)
    if (!vp || !renderScales) return null
    if (vp.x < geo.plot.x || vp.x > geo.plot.x + geo.plot.w || vp.y < geo.plot.y || vp.y > geo.plot.y + geo.plot.h) return null
    const x = dataXAt(vp.x)
    if (x == null) return null
    const y = renderScales.yInvert(vp.y)
    if (!Number.isFinite(y)) return null
    return { x, y: Math.round(y * 1000) / 1000, px: vp.x, py: vp.y }
  }
  function commitDrawings(next: ChartDrawing[]) {
    onDrawingsChange?.(next)
  }
  function pickTool(kind: ChartDrawingKind) {
    tool = tool === kind ? null : kind
    pending = null
    drawCursor = null
    textDraft = null
  }
  function onDrawClick(e: MouseEvent) {
    if (!tool) return
    const pt = dataPointAt(e)
    if (!pt) return
    if (tool === 'text') {
      // The box is positioned over the host at the click; Enter keeps the
      // note, Escape or an empty box drops it.
      const r = chartEl?.getBoundingClientRect()
      textDraftValue = ''
      textDraft = { x: pt.x, y: pt.y, left: r ? e.clientX - r.left : 0, top: r ? e.clientY - r.top : 0 }
      return
    }
    if (tool === 'hray') {
      commitDrawings([...drawingsNow(), { id: `d${Date.now().toString(36)}${drawSeq++}`, kind: tool, points: [{ x: pt.x, y: pt.y }] }])
      return
    }
    if (!pending) { pending = pt; drawCursor = { x: pt.px, y: pt.py }; return }
    const first = pending
    pending = null
    drawCursor = null
    commitDrawings([...drawingsNow(), { id: `d${Date.now().toString(36)}${drawSeq++}`, kind: tool, points: [{ x: first.x, y: first.y }, { x: pt.x, y: pt.y }] }])
  }
  function onDrawMove(e: PointerEvent) {
    if (handleDrag) {
      const pt = dataPointAt(e)
      if (!pt) return
      const { id, index } = handleDrag
      commitDrawings(drawingsNow().map((d) => (d.id === id ? { ...d, points: d.points.map((q, k) => (k === index ? { x: pt.x, y: pt.y } : q)) } : d)))
      return
    }
    if (pending) {
      const vp = svgPoint(e)
      if (vp) drawCursor = vp
    }
  }
  function removeDrawing(id: string) {
    commitDrawings(drawingsNow().filter((d) => d.id !== id))
    if (selectedDrawing === id) selectedDrawing = null
  }
  function onDrawKey(e: KeyboardEvent, id: string) {
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeDrawing(id) }
  }
  /** Escape drops a half-placed drawing, then the tool. */
  function onSvgKey(e: KeyboardEvent) {
    if (e.key !== 'Escape') return
    if (pinnedTip) { unpinTip(); return }
    if (!tool) return
    if (pending) { pending = null; drawCursor = null } else tool = null
  }
  /** Release a pinned tooltip and clear the hover it was holding. */
  function unpinTip() {
    pinnedTip = null
    clearActive()
  }
  /** Pin the tooltip on a category click, or release it on the same one. */
  function togglePin(i: number) {
    if (!tooltipSticky || !tip) return
    if (pinnedTip && pinnedTip.index === i) { unpinTip(); return }
    pinnedTip = { index: i, series: tip.ctx.series ?? null }
  }
  // While pinned, a pointer down anywhere outside the chart lets go.
  $effect(() => {
    if (!pinnedTip || typeof document === 'undefined') return
    const onDown = (e: PointerEvent) => {
      if (chartEl && e.target instanceof Node && chartEl.contains(e.target)) return
      unpinTip()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  })
  const focusOnMount = (node: HTMLElement) => { node.focus() }


  // Candles are cartesian, and the `isCartesian` negative list below already
  // covers them, so they inherit gridlines, the crosshair, category hit bands,
  // keyboard nav, drag-zoom and double-click reset with no new wiring.
  // Declared up here because the brush spec reads it, and a `$derived` used
  // above its declaration is an error rather than a hoist.
  const isCandle = $derived(spec.type === 'candlestick' || spec.type === 'ohlc')
  /** OHLC draws ticks off a vertical; candlestick draws a body and a wick. */
  const isOhlcBars = $derived(spec.type === 'ohlc')

  /**
   * Roughly how many pixels the plot will have across, for decimation. The
   * real plot width comes out of `buildChart`, which needs the spec this
   * decides - so an estimate (the layout width minus the usual gutters) breaks
   * the loop. Being 10% off just means 10% more or fewer points than pixels.
   */
  const decimateW = $derived(Math.max(50, (layoutW ?? spec.width ?? 520) - 60))

  // ---- Brush state -----------------------------------------------------
  // The brush is a compact second chart showing the FULL data range with
  // a translucent window over the visible slice. Dragging the body pans
  // the window; dragging either edge resizes one side. Eligible for
  // cartesian charts only (heatmap / pie don't have a single x-axis).
  /** The families with no single category axis, where a brush means nothing. */
  const NO_AXIS_TYPES = new Set<string>(['pie', 'heatmap', 'funnel', 'radar', 'calendar', 'gauge', 'treemap', 'sankey', 'sunburst', 'radial-bar', 'radial-column', 'nightingale', 'chord', 'bullet'])
  /** Per-series kinds the brush cannot draw; they read as a line at that scale. */
  const STEM_TYPES = new Set<string>(['lollipop', 'dumbbell', 'range-area', 'range-bar', 'stream', 'pareto'])
  const brushEligible = $derived(brush && !NO_AXIS_TYPES.has(spec.type))
  // Build a separate geometry from the un-zoomed spec at brushHeight.
  const brushSpec = $derived<ChartSpec>({
    ...spec,
    width: layoutW ?? spec.width,
    height: brushHeight,
    // Mute the brush: no titles, axis titles or labels, reference marks,
    // data labels or drawings. A chart title and subtitle alone took 45 of
    // the strip's 88 pixels, the x labels another 30, and the mini-map was
    // a five-pixel smear under an empty band.
    title: undefined, subtitle: undefined, caption: undefined,
    yAxisTitle: undefined, y2AxisTitle: undefined, xAxisTitle: undefined,
    // Axis labels too: at 88px the x labels (auto-rotated for a long
    // category list) took another 30, and the chart above carries them.
    xAxis: { ...spec.xAxis, title: undefined, labels: false },
    yAxis: { ...spec.yAxis, title: undefined, labels: false },
    y2Axis: { ...spec.y2Axis, title: undefined, labels: false },
    referenceLines: undefined,
    referenceBands: undefined,
    annotations: undefined,
    drawings: undefined,
    seriesLabels: undefined,
    dataLabels: { show: false },
    // The mini-map draws candles as a close-price line: at brush scale a
    // candle is a couple of pixels wide and reads as noise, while a close line
    // is the shape a reader actually navigates by.
    // A box gets the same treatment for the same reason: at brush scale it is
    // a smear, while the median line is a shape you can navigate by.
    type: isCandle || spec.type === 'boxplot' || STEM_TYPES.has(spec.type) ? 'line' : spec.type === 'histogram' ? 'bar' : spec.type,
    stackOffset: undefined,
    series: coloredSeries
      .filter((s) => !effectiveHidden.has(s.label))
      .map((s) =>
        s.ohlc || s.boxes
          ? { ...s, ohlc: undefined, boxes: undefined, errors: undefined, type: 'line' as const }
          : s.errors || (s.type && STEM_TYPES.has(s.type)) || s.type === 'scatter'
            ? { ...s, errors: undefined, type: s.type && (STEM_TYPES.has(s.type) || s.type === 'scatter') ? ('line' as const) : s.type }
            : s,
      ),
  })
  const brushGeo = $derived(brushEligible ? buildChart(decimateSpec(brushSpec, decimateW)) : null)
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
    if (i0 === 0 && i1 === n - 1) setZoom(null)
    else setZoom({ i0, i1: Math.max(i0, i1), ...(zoom?.y ? { y: zoom.y } : {}) })
  }
  function onBrushUp(e: PointerEvent) {
    brushDrag = null
    ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
  }

  // ---- Drilldown ------------------------------------------------------
  // A tree map, sunburst or pie can descend into a node: the clicked node
  // becomes the root of what is drawn, and the toolbar breadcrumb climbs back
  // up. A pie draws the current node's children as its slices, so a pie with
  // a `tree` and no categories of its own is a drillable pie of the top level.
  const drillRoot = $derived<TreeNode | null>(spec.tree ?? spec.treemap ?? null)
  const canDrill = $derived(drillable && !!drillRoot && (spec.type === 'sunburst' || spec.type === 'treemap' || spec.type === 'pie'))
  const drilledRoot = $derived<TreeNode | null>(canDrill && drillPath.length ? drillTree(drillRoot!, drillPath) : drillRoot)
  const treeTotal = (n: TreeNode): number => n.value ?? (n.children ?? []).reduce((a, c) => a + treeTotal(c), 0)
  /** A pie's slices: the drilled node's children when it drills, else the spec's categories. */
  const pieTree = $derived(spec.type === 'pie' && canDrill && drilledRoot ? drilledRoot : null)
  const pieCategories = $derived(pieTree ? (pieTree.children ?? []).map((k) => k.name) : spec.categories)
  const sliceDrillable = (label: string) => !!pieTree && !!pieTree.children?.find((k) => k.name === label)?.children?.length
  function drillTo(path: string[]) {
    drillPath = path
  }
  /** Descend into a named node when it has children; false when it is a leaf. */
  function drillInto(path: string[] | null): boolean {
    if (!canDrill || !path || !drillRoot) return false
    const node = drillTree(drillRoot, path)
    if (!node?.children?.length) return false
    drillTo(path)
    return true
  }

  const visibleSpec = $derived.by<ChartSpec>(() => {
    if (pieTree) {
      const kids = pieTree.children ?? []
      const label = spec.series[0]?.label ?? pieTree.name
      const values = kids.map((k) => (effectiveHidden.has(k.name) ? 0 : treeTotal(k)))
      const colors = kids.map((k) => k.color ?? null)
      return { ...spec, categories: pieCategories, series: [{ label, values, ...(colors.some(Boolean) ? { colors } : {}) }] }
    }
    if (canDrill && drilledRoot && drillPath.length) {
      const base = { ...spec, tree: drilledRoot, treemap: drilledRoot }
      return spec.type === 'treemap' ? base : { ...base, series: coloredSeries }
    }
    if (spec.type === 'pie' || arcsByCategory) {
      const s = coloredSeries[0]
      if (!s) return spec
      const values = s.values.map((v, i) => (effectiveHidden.has(spec.categories[i] ?? String(i)) ? 0 : v))
      return { ...spec, series: [{ ...s, values }] }
    }
    const visibleSeries = coloredSeries.filter((s) => !effectiveHidden.has(s.label))
    // Narrow to the zoom window so buildChart re-spreads the visible slice
    // across the full plot. The slicing itself lives in chart.ts: this used to
    // be done by hand here and only covered categories / values / rowIds, so
    // the confidence-band envelopes kept their full length and the band
    // silently vanished as soon as anyone zoomed.
    let windowed = zoom
      ? sliceChartWindow({ ...spec, series: visibleSeries }, zoom.i0, zoom.i1)
      : { ...spec, series: visibleSeries }
    // A y window pins the value axis; the marks outside it are clipped by the
    // plot clip, which is the same rule an explicit yAxis.min / max follows.
    if (zoom?.y) {
      const key = zoom.y.axis === 'right' ? 'y2Axis' : 'yAxis'
      windowed = { ...windowed, [key]: { ...(windowed[key] ?? {}), min: zoom.y.min, max: zoom.y.max, nice: false } }
    }
    // Then thin to about a point per pixel. After the slice, deliberately:
    // zooming into 300 of 100k points should show all 300.
    return decimateSpec(windowed, decimateW)
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
  const geoRaw = $derived(
    buildChart(
      {
        ...visibleSpec,
        palette,
        ...(layoutW || layoutH ? { width: layoutW, height: layoutH } : {}),
        // The prop's label config reaches the engine (a pie lays out callouts
        // for `placement: 'outside'`); the spec's own is the fallback.
        ...(dataLabels !== undefined ? { dataLabels: labelCfg } : {}),
      },
      isDark ? 'dark' : 'light',
    ),
  )
  // ---- Motion ------------------------------------------------------------
  // `animate` resolves to a config; the data-update tween holds the geometry
  // it started from and how far along it is, and `geo` (what the markup
  // draws) is the interpolation while a tween runs and the real layout
  // otherwise. Reduced-motion readers and dense charts never tween.
  const animCfg = $derived<Required<ChartAnimateConfig> | null>(
    !animate
      ? null
      : animate === true
        ? { duration: 400, enter: 'fade', update: true }
        : { duration: animate.duration ?? 400, enter: animate.enter ?? 'fade', update: animate.update ?? true },
  )
  let reducedMotion = $state(false)
  $effect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion = mq.matches
    const onChange = () => (reducedMotion = mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  })
  // The interpolator is a static import on purpose: as a lazy chunk it pulled
  // the arc and line path builders into a shared chunk, and the split cost
  // more (0.8 KB) than the 1.2 KB it moved out.
  let tween = $state<{ from: ChartGeometry; t: number } | null>(null)
  const geo = $derived(tween && tween.t < 1 ? interpolateGeometry(tween.from, geoRaw, tween.t) : geoRaw)
  let prevGeo: ChartGeometry | null = null
  let tweenFrame = 0
  $effect(() => {
    const next = geoRaw
    untrack(() => {
      const from = prevGeo
      prevGeo = next
      if (!from || !animCfg?.update || reducedMotion || animCfg.duration <= 0 || live) return
      // Thousands of marks a frame is not a tween, it is a stall.
      if (next.bars.length + next.arcs.length > 600 || next.lines.some((l) => l.points.length > 600)) return
      if (from.type !== next.type) return
      // Start from wherever the marks are NOW, mid-tween included.
      const start = tween && tween.t < 1 ? interpolateGeometry(tween.from, from, tween.t) : from
      cancelAnimationFrame(tweenFrame)
      const t0 = performance.now()
      const dur = animCfg.duration
      tween = { from: start, t: 0 }
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / dur)
        const eased = 1 - Math.pow(1 - p, 3)
        tween = p >= 1 ? null : { from: start, t: eased }
        if (p < 1) tweenFrame = requestAnimationFrame(step)
      }
      tweenFrame = requestAnimationFrame(step)
    })
  })
  const enterFx = $derived(reducedMotion || live ? 'none' : (animCfg?.enter ?? 'fade'))
  /** Gradient <defs> for area series that asked for one, keyed by the
   *  line's index so the markup can find its own. */
  const gradientDefs = $derived(
    geo.lines.flatMap((l, i) => (l.style?.gradient ? [{ id: `${uid}-grad-${i}`, ...l.style.gradient }] : [])),
  )
  /** The resolved axis titles (the axis object wins over the flat prop). */
  const yTitle = $derived(spec.yAxis?.title ?? spec.yAxisTitle)
  const y2Title = $derived(spec.y2Axis?.title ?? spec.y2AxisTitle)
  const xTitle = $derived(spec.xAxis?.title ?? spec.xAxisTitle)
  /** What the `underlay` / `overlay` snippets are handed. Built from the
   *  laid-out geometry, so a custom mark shares the built-in scale exactly. */
  const renderScales = $derived(chartScales(geo))
  const renderCtx = $derived<ChartRenderContext>({
    geo,
    scales: renderScales,
    xOf: renderScales?.xOf ?? null,
    yOf: renderScales?.yOf ?? null,
  })

  const isCartesian = $derived(!NO_AXIS_TYPES.has(spec.type))
  /** The arc family: sunburst, radial bar / column, nightingale, chord. */
  const isArcs = $derived(spec.type === 'sunburst' || spec.type === 'radial-bar' || spec.type === 'radial-column' || spec.type === 'nightingale' || spec.type === 'chord')
  const isBullet = $derived(spec.type === 'bullet')
  /** Arc types whose legend lists CATEGORIES (one series) rather than series. */
  const arcsByCategory = $derived(
    (spec.type === 'radial-bar' || spec.type === 'radial-column' || spec.type === 'nightingale') && spec.series.length === 1,
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

  /** How many data points the visible window holds BEFORE decimation. The
   *  screen-reader label reports the data, not how many marks survived. */
  const windowCount = $derived(zoom ? zoom.i1 - zoom.i0 + 1 : spec.categories.length)

  /** Positioned data labels for the cartesian marks, thinned for overlap.
   *  Pie slices label themselves in the markup. */
  const dataLabelGeo = $derived(
    labelCfg.show && isCartesian && !isScatter
      ? layoutDataLabels(geo, labelCfg, (v, series) => fmtFor(series)(v), { stacked: !!(spec.stacked || spec.stacked100), dense, share: !!spec.stacked100 })
      : [],
  )

  /** Rows the screen-reader table will actually render before it is capped. */
  const SR_ROW_CAP = 1000

  /** Which category the cursor is over, in dense mode. Binary search over the
   *  first series' point x's, so a non-uniform (time) axis is handled too;
   *  uniform slot maths when there are no line points to search. */
  /** Client px -> viewBox px. The svg scales to its container, so the two
   *  differ whenever the chart is not rendered at its natural size. */
  function toViewBox(clientX: number, clientY: number, target: Element): { x: number; y: number } | null {
    const svg = (target as SVGGraphicsElement).ownerSVGElement ?? (target as SVGSVGElement)
    if (!svg || typeof svg.getBoundingClientRect !== 'function') return null
    const box = svg.getBoundingClientRect()
    if (!box.width || !box.height) return null
    const vb = (svg as SVGSVGElement).viewBox?.baseVal
    const sx = vb && vb.width ? vb.width / box.width : 1
    const sy = vb && vb.height ? vb.height / box.height : 1
    return {
      x: (clientX - box.left) * sx + (vb ? vb.x : 0),
      y: (clientY - box.top) * sy + (vb ? vb.y : 0),
    }
  }

  function catAtClientX(clientX: number, target: Element): number | null {
    const vp = toViewBox(clientX, 0, target)
    if (!vp) return null
    const x = vp.x
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
    if (menuKey(e, denseIndex) || keyZoom(e, denseIndex)) return
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
        catClick(e, denseIndex)
        return
      default: return
    }
    e.preventDefault()
    denseIndex = next
    focusCat(e.currentTarget as Element, next)
  }

  // Opacity for a series when another legend chip is being hovered.
  /** The series under the pointer, for hover highlight; null off the marks. */
  let hoverSeries = $state<string | null>(null)
  const dimActive = $derived(dimmed ?? (hoverHighlight ? hoverSeries : null))
  const dimOf = (seriesLabel: string) => (dimActive && dimActive !== seriesLabel ? 0.18 : 1)
  /** How close (viewBox px) the pointer must be to a line for it to be "the" series. */
  const HOVER_SNAP_PX = 18
  /** The last point reported to `onHover`, so a 60 Hz mousemove reports once. */
  let lastHover: ChartHoverPoint | null = null
  function reportHover(p: ChartHoverPoint | null) {
    if (!onHover) return
    const same =
      p === lastHover ||
      (p !== null && lastHover !== null && p.category === lastHover.category && p.index === lastHover.index && p.series === lastHover.series && p.value === lastHover.value)
    if (same) return
    lastHover = p
    onHover(p)
  }
  // ---- Selection ---------------------------------------------------------
  const selMode = $derived(selectable === 'multi' ? 'multi' : selectable ? 'single' : null)
  // A ref and a mark that both know their category index must agree on it:
  // a grouped axis repeats its leaf labels, and a click on the second Q2
  // used to select the first Q2 with it. A mark without an index (a line
  // dot, a slice) still matches on the labels alone.
  const sameRef = (r: ChartPointRef, category: string, series: string, index?: number) =>
    r.category === category && r.series === series && (r.index === undefined || index === undefined || r.index === index)
  const isSel = (category: string, series: string, index?: number) =>
    selected.some((r) => sameRef(r, category, series, index))
  /** Extra dimming for marks outside a selection (1 when nothing is selected). */
  const selDim = (category: string, series: string, index?: number) =>
    selMode && selected.length && !isSel(category, series, index) ? 0.35 : 1
  function applySelection(category: string, series: string, e?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }, index?: number) {
    if (!selMode) return
    const ref: ChartPointRef = index === undefined ? { category, series } : { category, series, index }
    const additive = selMode === 'multi' || !!(e && (e.ctrlKey || e.metaKey || e.shiftKey))
    let next: ChartPointRef[]
    if (isSel(category, series, index)) next = additive ? selected.filter((r) => !sameRef(r, category, series, index)) : []
    else next = additive ? [...selected, ref] : [ref]
    selected = next
    onSelectionChange?.(next)
  }
  // ---- Series focus (keyboard) --------------------------------------------
  /** The series the arrow keys have stepped onto, or null for the whole category. */
  let activeSeries = $state<string | null>(null)
  /** What the live region says. */
  let liveText = $state('')

  const legendItems = $derived(
    // A heat map or a calendar colours by value and draws its own ramp; a row
    // of series chips in palette colours the cells never use would be a key
    // to nothing.
    spec.type === 'heatmap' || spec.type === 'calendar' || spec.type === 'gauge'
      ? []
      : spec.type === 'pie' || arcsByCategory
      ? pieCategories.map((label, i) => ({ label, color: spec.categoryColors?.[label] ?? visibleSpec.series[0]?.colors?.[i] ?? palette[i % palette.length]!, off: hidden.has(label) }))
      : spec.type === 'sunburst' || spec.type === 'chord'
        // The engine names these (top-level branches, chord groups); they are
        // labels only, since hiding one means re-laying-out a hierarchy.
        ? geo.legend.map((l) => ({ label: l.label, color: l.color, off: false }))
        : coloredSeries.map((s) => ({ label: s.label, color: s.color, off: hidden.has(s.label) })),
  )
  // ---- Range presets, for a time axis ------------------------------------
  const presetList = $derived<ChartRangePreset[]>(
    !rangePresets ? [] : rangePresets === true ? ['1W', '1M', '3M', '6M', 'YTD', '1Y', 'All'] : rangePresets,
  )
  const presetsApply = $derived(
    presetList.length > 0 && isCartesian && (spec.xType === 'time' || spec.xType === 'ordinal-time' || spec.xAxis?.type === 'time' || spec.xAxis?.type === 'ordinal-time'),
  )
  const presetLabel = (p: ChartRangePreset) => (typeof p === 'string' ? p : p.label)
  function applyPreset(p: ChartRangePreset) {
    setZoom(presetWindow(spec.categories, p))
  }

  /** Sunburst and chord chips are a key, not switches. */
  const legendToggles = $derived(spec.type !== 'sunburst' && spec.type !== 'chord')
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
    if (isArcs) return geo.arcs.length === 0
    if (isBullet) return geo.bullets.length === 0
    return geo.bars.length === 0 && geo.stems.length === 0 && geo.lines.every((l) => l.points.every((p) => !p.defined))
  })

  // A double-click arrives as click, click, dblclick, and the two clicks run
  // through toggle() first. From a clean state they cancel out and the
  // dblclick isolates. With a chip isolated, the first click clears the
  // isolation and the second hid the chip, then the dblclick isolated it
  // again: "double-click again to clear" left the chart exactly as it was
  // and the chip hidden underneath. So a click that clears an isolation is
  // remembered for a moment, and the dblclick that follows it on the same
  // chip undoes the second click instead of isolating; on another chip it
  // moves the isolation there.
  let clearedByClick: { label: string; at: number } | null = null
  function toggle(label: string) {
    if (!interactive || !legendToggles) return
    if (isolated != null) {
      clearedByClick = { label: isolated, at: Date.now() }
      isolated = null
      return
    }
    const next = new Set(hidden)
    if (next.has(label)) next.delete(label)
    else next.add(label)
    hidden = next
  }
  // Double-click a legend chip to isolate it (show only that one); double-click
  // again (or the same chip) to clear the isolation.
  function isolate(label: string) {
    if (!interactive || !legendToggles) return
    const cleared = clearedByClick
    clearedByClick = null
    const shown = new Set(hidden)
    shown.delete(label)
    if (cleared && cleared.label === label && Date.now() - cleared.at < 600) {
      hidden = shown
      return
    }
    // Isolating a chip shows it, whatever a click had done to it before.
    hidden = shown
    isolated = isolated === label ? null : label
  }

  // ---- Screen-reader data table -----------------------------------------
  // A visually-hidden table that conveys the same data to assistive tech.
  // A gap is an empty cell. `fmt(NaN)` read "NaN" to a screen reader and a
  // `null` fell back to 0, which told the reader the outage month had no
  // sign-ups when the chart says nothing was measured.
  const srCell = (v: number | null | undefined, series?: string) => (Number.isFinite(v) ? fmtFor(series)(v as number) : '')
  const srTable = $derived.by(() => {
    if (spec.type === 'pie') {
      const s = pieTree ? visibleSpec.series[0] : coloredSeries[0]
      return {
        cols: ['Category', 'Value'],
        rows: pieCategories.map((c, i) => [c, srCell(s?.values[i])]),
      }
    }
    if (isScatter) {
      const rows: string[][] = []
      for (const s of coloredSeries) for (const p of s.points ?? []) rows.push([s.label, fmt(p.x), fmt(p.y), p.r != null ? fmt(p.r) : ''])
      return { cols: ['Series', 'X', 'Y', 'Size'], rows }
    }
    if (isArcs) {
      return {
        cols: [spec.type === 'chord' ? 'Group' : 'Category', 'Series', 'Value'],
        rows: geo.arcs.map((a) => [a.nodePath ? a.nodePath.join(' / ') : a.label, a.series, fmt(a.value)]),
      }
    }
    if (isBullet) {
      return {
        cols: ['Category', 'Value', 'Target'],
        rows: geo.bullets.map((b) => [b.label, fmt(b.value), b.target == null ? '' : fmt(b.target)]),
      }
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
    if (spec.type === 'waterfall') {
      // The drawn values: a total's running sum rather than the 0 it holds.
      const first = coloredSeries[0]
      return {
        cols: ['Category', first?.label ?? 'Value'],
        rows: spec.categories.map((c, i) => {
          const bar = geo.bars.find((b) => b.index === i)
          return [c, bar ? fmt(bar.value) : srCell(first?.values[i])]
        }),
      }
    }
    return {
      cols: ['Category', ...coloredSeries.map((s) => s.label)],
      rows: spec.categories.map((c, i) => [c, ...coloredSeries.map((s) => srCell(s.values[i], s.label))]),
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
  type TipRow = ChartTooltipRow
  let tip = $state<{ left: number; top: number; below: boolean; fixed: boolean; title: string; rows: TipRow[]; ctx: ChartTooltipContext } | null>(null)
  /** The category a click pinned the tooltip on (`tooltipSticky`), or null. */
  let pinnedTip = $state<{ index: number; series: string | null } | null>(null)
  let activeCat = $state<number | null>(null)

  function showTip(clientX: number, clientY: number, title: string, rows: TipRow[], ctx?: Partial<ChartTooltipContext>) {
    if (!interactive || !chartEl || rows.length === 0) return
    // A pinned tooltip ignores the pointer until it is released.
    if (pinnedTip && tip) return
    const r = chartEl.getBoundingClientRect()
    const full: ChartTooltipContext = { category: title, index: -1, rows, ...ctx }
    // A format hook rewrites the default title / rows; a snippet replaces the
    // body outright and gets the same context.
    const fmtd = tooltipFormat?.(full)
    const fixed = tooltipPosition !== 'follow'
    let left: number
    let top: number
    if (fixed && svgEl) {
      // A corner of the plot, in the host's pixels: the plot box scaled by
      // the svg's rendered size, inset by 8px.
      const sb = svgEl.getBoundingClientRect()
      const kx = sb.width / (geo.width || 1)
      const ky = sb.height / (geo.height || 1)
      const inset = 8
      const right = tooltipPosition === 'top-right' || tooltipPosition === 'bottom-right'
      const bottom = tooltipPosition === 'bottom-left' || tooltipPosition === 'bottom-right'
      left = sb.left - r.left + (right ? (geo.plot.x + geo.plot.w) * kx - inset : geo.plot.x * kx + inset)
      top = sb.top - r.top + (bottom ? (geo.plot.y + geo.plot.h) * ky - inset : geo.plot.y * ky + inset)
    } else {
      left = Math.max(70, Math.min(r.width - 70, clientX - r.left))
      top = clientY - r.top
    }
    tip = { left, top, below: !fixed && top < 44, fixed, title: fmtd?.title ?? title, rows: fmtd?.rows ?? rows, ctx: full }
    reportHover({ category: full.category, index: full.index, series: full.series ?? null, value: full.value ?? null })
  }

  /**
   * The series nearest a pointer, by vertical distance to its mark at category
   * i. What 'single' tooltip mode shows: the one line you are pointing at,
   * rather than every series at that x.
   */
  function nearestSeriesAt(i: number, vy: number): { label: string; distance: number } | null {
    let best: string | null = null
    let bestD = Infinity
    for (const l of geo.lines) {
      const p = l.points[i]
      if (!p?.defined) continue
      const d = Math.abs(p.y - vy)
      if (d < bestD) { bestD = d; best = l.label }
    }
    for (const b of geo.bars) {
      if (b.label !== visibleSpec.categories[i]) continue
      const d = vy < b.y ? b.y - vy : vy > b.y + b.h ? vy - (b.y + b.h) : 0
      if (d < bestD) { bestD = d; best = b.series }
    }
    for (const k of geo.candles) {
      if (k.label !== visibleSpec.categories[i]) continue
      const d = vy < k.yHigh ? k.yHigh - vy : vy > k.yLow ? vy - k.yLow : 0
      if (d < bestD) { bestD = d; best = k.series }
    }
    return best === null ? null : { label: best, distance: bestD }
  }

  // Unified tooltip: every visible series' value at one category.
  function catRows(i: number): TipRow[] {
    const rows: TipRow[] = []
    // A waterfall's total bars carry 0 in the data and their height in the
    // geometry, so the tooltip reads the bar: "Gross profit $2,460", not "$0".
    if (spec.type === 'waterfall') {
      const bar = geo.bars.find((b) => b.index === i)
      const s = visibleSpec.series[0]
      if (bar && s) rows.push({ label: s.label, color: bar.color, value: fmt(bar.value) })
      return rows
    }
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
      const f = fmtFor(s.label)
      // A range series reads as "low to high"; a bullet as "value (target)".
      const lo = s.lowValues?.[i]
      if (Number.isFinite(v) && Number.isFinite(lo)) {
        rows.push({ label: s.label, color, value: `${f(lo as number)} to ${f(v as number)}` })
        continue
      }
      const tg = s.targets?.[i]
      if (Number.isFinite(v) && Number.isFinite(tg)) {
        rows.push({ label: s.label, color, value: f(v as number) })
        rows.push({ label: `${s.label} target`, value: f(tg as number) })
        continue
      }
      if (Number.isFinite(v)) {
        rows.push({ label: s.label, color, value: f(v as number) })
        // An error bar is only worth drawing if you can read what it means.
        const e = s.errors?.[i]
        if (e != null) {
          const lo = typeof e === 'number' ? (v as number) - Math.abs(e) : Math.min(e.lo, e.hi)
          const hi = typeof e === 'number' ? (v as number) + Math.abs(e) : Math.max(e.lo, e.hi)
          if (Number.isFinite(lo) && Number.isFinite(hi)) {
            rows.push({ label: `${s.label} range`, value: `${f(lo)} - ${f(hi)}` })
          }
        }
      }
    }
    // Overlays read under their series: the fitted or averaged value at this
    // category, and a regression's R-squared once, so a reader can judge it.
    for (const ovl of geo.overlays) {
      const p = ovl.points[i]
      if (!p?.defined) continue
      const src = visibleSpec.series.find((s) => s.overlay && ovl.label === `${s.label} (${s.overlay})`)
      if (!src?.overlay) continue
      const r2 = ovl.r2 !== undefined ? ` (${msg(t.rSquared, { value: ovl.r2.toFixed(2) })})` : ''
      rows.push({ label: `${src.label} ${overlayName(src.overlay)}`, color: ovl.color, value: `${fmtFor(src.label)(p.value)}${r2}` })
    }
    return rows
  }
  /** The pointer's y in viewBox units while a category is hovered; null from the keyboard. */
  let hoverVy = $state<number | null>(null)
  /** The value pill's text: the axis's own formatter, at a precision the axis range earns. */
  function crosshairValueText(v: number): string {
    const ax = geo.axes?.y
    const range = ax ? Math.abs(ax.max - ax.min) : 100
    const decimals = range >= 100 ? 0 : range >= 10 ? 1 : range >= 1 ? 2 : 3
    const r = Number(v.toFixed(decimals))
    const cfg = spec.yAxis
    if (cfg?.formatter) return cfg.formatter(r, -1)
    if (cfg?.format) return formatChartValue(r, cfg.format, spec)
    return yTickLabel(r, fmt(r))
  }
  // On a date axis the tooltip and the crosshair pill write the category
  // out ("Jun 2025", "Jun 1, 2025") rather than echoing the ISO string the
  // axis labels never show. The raw category still goes out in the hover
  // point and the selection, since that is what the spec calls it.
  const dateAxis = $derived(
    spec.xType === 'time' || spec.xType === 'ordinal-time' || spec.xAxis?.type === 'time' || spec.xAxis?.type === 'ordinal-time',
  )
  const catGrain = $derived(dateAxis ? dateGrain(visibleSpec.categories.map((c) => Date.parse(c))) : 'day')
  /** A calendar day written out ("Apr 7, 2026"), for the tooltip and the cell's name. */
  const calendarDay = (date: string) => { const t = Date.parse(date); return Number.isFinite(t) ? fmtDateFull(t) : date }
  function categoryTitle(i: number): string {
    const c = visibleSpec.categories[i] ?? ''
    if (!dateAxis) return c
    const t = Date.parse(c)
    if (!Number.isFinite(t)) return c
    return spec.xAxis?.formatter ? spec.xAxis.formatter(t, i) : fmtDateFull(t, catGrain)
  }
  function hoverCat(clientX: number, clientY: number, i: number, target?: Element) {
    activeCat = i
    const vy = svgPoint({ clientX, clientY })?.y
    hoverVy = vy != null && Number.isFinite(vy) && vy >= geo.plot.y && vy <= geo.plot.y + geo.plot.h ? vy : null
    const category = visibleSpec.categories[i] ?? ''
    let rows = catRows(i)
    let series: string | undefined
    let value: number | undefined
    // A series stepped onto from the keyboard narrows the tooltip to it, the
    // way 'single' mode narrows it to the series under the pointer.
    const focused = activeSeries && visibleSpec.series.some((sr) => sr.label === activeSeries) ? activeSeries : null
    if (focused) {
      series = focused
      value = visibleSpec.series.find((sr) => sr.label === focused)?.values[i]
      rows = rows.filter((r) => r.label === focused || r.label?.startsWith(focused + ' '))
    } else {
      // The series nearest the pointer: 'single' mode narrows the tooltip to
      // it, and the highlight dims the rest when it is within reach. Off the
      // keyboard (no target) the point is the hit zone's centre, far from
      // any line, so nothing dims.
      const vp = target ? toViewBox(clientX, clientY, target) : svgPoint({ clientX, clientY })
      const near = vp && Number.isFinite(vp.y) ? nearestSeriesAt(i, vp.y) : null
      hoverSeries = near && near.distance <= HOVER_SNAP_PX ? near.label : null
      if (tooltipMode === 'single' && near && target) {
        series = near.label
        value = visibleSpec.series.find((s) => s.label === near.label)?.values[i]
        rows = rows.filter((r) => r.label === near.label || r.label?.startsWith(near.label + ' '))
      }
    }
    showTip(clientX, clientY, categoryTitle(i), rows, { category, index: i, series, value })
    if (syncGroup && !remoteHover) {
      const t = Date.parse(category)
      publishSyncHover(syncGroup, { label: category, index: (zoom ? zoom.i0 : 0) + i, time: Number.isFinite(t) ? t : null, from: me })
    }
  }
  function focusCat(el: Element, i: number) {
    const b = el.getBoundingClientRect()
    hoverCat(b.left + b.width / 2, b.top + 12, i)
    if (!announce) return
    const category = categoryTitle(i)
    if (activeSeries) {
      const v = visibleSpec.series.find((sr) => sr.label === activeSeries)?.values[i]
      liveText = msg(t.seriesAtCategory, { series: activeSeries, value: Number.isFinite(v) ? fmtFor(activeSeries)(v as number) : t.noValue, category })
    } else {
      liveText = `${category}: ${catRows(i).map((r) => `${r.label ?? ''} ${r.value}`).join(', ')}`
    }
  }
  function clearActive() {
    // A pinned tooltip survives the pointer leaving; Escape or a click lets go.
    if (pinnedTip) return
    activeCat = null
    hoverVy = null
    hoverSeries = null
    tip = null
    reportHover(null)
    if (syncGroup && !remoteHover && syncState?.hover?.from === me) publishSyncHover(syncGroup, null)
  }
  // Mirror the group's hover: find the category by label, then by nearest
  // date, and raise the crosshair + tooltip at that column.
  $effect(() => {
    if (!syncState) return
    const h = syncState.hover
    untrack(() => {
      if (!h) {
        if (remoteHover) { remoteHover = false; activeCat = null; tip = null }
        return
      }
      if (h.from === me) return
      let i = visibleSpec.categories.indexOf(h.label)
      if (i < 0 && h.time != null) i = nearestIndexByTime(visibleSpec.categories, h.time)
      if (i < 0 || !svgEl || !renderScales) return
      remoteHover = true
      const r = svgEl.getBoundingClientRect()
      const sx = r.width / geo.width
      const sy = r.height / geo.height
      const x = renderScales.xOf(i)
      hoverCat(r.left + x * sx, r.top + (geo.plot.y + 12) * sy, i)
      remoteHover = true
    })
  })
  // Mirror the group's window: same axis length means the same indices,
  // otherwise the ends are matched by date.
  $effect(() => {
    if (!syncState) return
    const z = syncState.zoom
    untrack(() => {
      if (!z || z.from === me) return
      const n = spec.categories.length
      let next: ChartZoomWindow | null = z.window
      if (next && z.count !== n) {
        if (!z.labels) return
        const i0 = nearestIndexByTime(spec.categories, Date.parse(z.labels[0]))
        const i1 = nearestIndexByTime(spec.categories, Date.parse(z.labels[1]))
        if (i0 < 0 || i1 < 0) return
        next = i0 === 0 && i1 === n - 1 ? null : { i0: Math.min(i0, i1), i1: Math.max(i0, i1) }
      }
      applyingSync = true
      try { setZoom(next) } finally { applyingSync = false }
    })
  })
  function hoverSlice(clientX: number, clientY: number, label: string, value: number, pct: number) {
    showTip(clientX, clientY, label, [{ value: `${fmt(value)} · ${pct.toFixed(1)}%` }], { series: label, value })
  }
  function hoverDot(clientX: number, clientY: number, d: (typeof geo.scatterPoints)[number]) {
    hoverSeries = d.series
    const rows: TipRow[] = [
      { label: 'x', value: fmt(d.x) },
      { label: 'y', value: fmt(d.y) },
    ]
    // The series' regression, once: what the fit says at this x and how well
    // it fits, so a curve that flatters the data is easy to judge.
    const src = visibleSpec.series.find((s) => s.label === d.series && s.overlay)
    const ovl = src?.overlay ? geo.overlays.find((o) => o.label === `${src.label} (${src.overlay})`) : undefined
    if (src?.overlay && ovl) {
      const r2 = ovl.r2 !== undefined ? ` (${msg(t.rSquared, { value: ovl.r2.toFixed(2) })})` : ''
      rows.push({ label: overlayName(src.overlay), color: ovl.color, value: `${ovl.equation ?? ''}${r2}` })
    }
    showTip(clientX, clientY, d.label || d.series, rows, { series: d.series, value: d.y })
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
    showTip(clientX, clientY, seg.label, rows, { value: seg.value })
  }
  function hoverArc(clientX: number, clientY: number, arc: (typeof geo.arcs)[number]) {
    hoverSeries = arcsByCategory || spec.type === 'sunburst' || spec.type === 'chord' ? arc.label : arc.series
    const title = arc.series ? `${arc.label} \u00b7 ${arc.series}` : arc.label
    showTip(clientX, clientY, title, [{ color: arc.color, value: fmt(arc.value) }], { category: arc.label, series: arc.series || undefined, value: arc.value })
  }
  function hoverRibbon(clientX: number, clientY: number, rb: (typeof geo.chordRibbons)[number]) {
    showTip(clientX, clientY, `${rb.source} \u2192 ${rb.target}`, [{ color: rb.color, value: fmt(rb.value) }], { category: rb.source, series: rb.target, value: rb.value })
  }
  function hoverBullet(clientX: number, clientY: number, b: (typeof geo.bullets)[number]) {
    hoverSeries = b.series
    const rows: TipRow[] = [{ color: b.color, label: b.series, value: fmt(b.value) }]
    if (b.target != null) rows.push({ label: 'target', value: fmt(b.target) })
    showTip(clientX, clientY, b.label, rows, { category: b.label, series: b.series, value: b.value })
  }
  function hoverStem(clientX: number, clientY: number, st: (typeof geo.stems)[number]) {
    hoverSeries = st.series
    const rows: TipRow[] = [{ color: st.color, label: st.series, value: st.dumbbell && st.value2 != null ? `${fmt(st.value2)} to ${fmt(st.value)}` : fmt(st.value) }]
    showTip(clientX, clientY, st.label, rows, { category: st.label, series: st.series, value: st.value })
  }
  function hoverRadarPoint(clientX: number, clientY: number, label: string, axis: string, value: number, color: string) {
    hoverSeries = label
    showTip(clientX, clientY, `${label} · ${axis}`, [{ color, value: fmt(value) }], { category: axis, series: label, value })
  }

  /**
   * A click on a category hit zone as a point. The zones sit above the marks,
   * so in a browser a click "on a bar" lands here with no series; for a
   * selection that has to become one: the series the keyboard stepped onto,
   * else the one nearest the pointer, else the only one there is. Without
   * `selectable` the category click stays a category click.
   */
  function catClick(e: MouseEvent | KeyboardEvent, i: number) {
    if (tool) return
    // A sticky tooltip pins on the click; the click still selects below.
    // Annotate mode owns the click, so it pins a note rather than a tooltip.
    if (tooltipSticky && 'clientX' in e && !annotating) {
      if (pinnedTip && pinnedTip.index === i) unpinTip()
      else { pinnedTip = null; hoverCat(e.clientX, e.clientY, i, e.currentTarget as Element); togglePin(i) }
    }
    const category = visibleSpec.categories[i] ?? ''
    if (!selMode) { select(category, '', 0, i, e); return }
    const vp = 'clientX' in e ? svgPoint(e) : null
    const near = vp ? nearestSeriesAt(i, vp.y) : null
    const series = activeSeries ?? near?.label ?? (visibleSpec.series.length === 1 ? visibleSpec.series[0]!.label : '')
    const value = visibleSpec.series.find((sr) => sr.label === series)?.values[i] ?? 0
    select(category, series, value, i, e)
  }
  function select(category: string, series: string, value: number, catIndex?: number, ev?: MouseEvent | KeyboardEvent) {
    applySelection(category, series, ev, catIndex)
    // Annotate mode takes over the category gesture rather than adding one of
    // its own. That is what makes it work from the keyboard: the hit rects
    // already have a roving tabindex and fire this on Enter, so pinning a note
    // is Tab, arrow, Enter - with no extra handler and no click-only feature.
    if (annotating && onAnnotate && catIndex !== undefined) {
      // A CATEGORY click carries no value - `select(cat, '', 0, i)` passes zero
      // because a drill only needs the category - so read the real one off the
      // first series. A click on a specific bar or slice already has one.
      const picked = series ? value : visibleSpec.series[0]?.values[catIndex]
      onAnnotate({ category, index: catIndex, value: Number.isFinite(picked) ? (picked as number) : 0 })
      return
    }
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
    if (menuKey(e, i)) return
    const max = visibleSpec.categories.length - 1
    const src = e.currentTarget as Element
    if (keyZoom(e, i)) return
    // Arrow keys + Home / End navigate; Enter / Space select. PageUp/Down
    // jump a tenth of the range at a time for long datasets.
    // Categories run along the main axis, series across it: on a vertical
    // chart Left / Right step categories and Up / Down step series, on a
    // horizontal one the pairs swap.
    const nextKey = isHorizontal ? 'ArrowDown' : 'ArrowRight'
    const prevKey = isHorizontal ? 'ArrowUp' : 'ArrowLeft'
    const seriesUp = isHorizontal ? 'ArrowRight' : 'ArrowUp'
    const seriesDown = isHorizontal ? 'ArrowLeft' : 'ArrowDown'
    switch (e.key) {
      case nextKey:
        e.preventDefault(); focusCatIndex(src, Math.min(max, i + 1)); return
      case prevKey:
        e.preventDefault(); focusCatIndex(src, Math.max(0, i - 1));   return
      case seriesUp:
      case seriesDown: {
        e.preventDefault()
        const labels = visibleSpec.series.map((sr) => sr.label)
        if (!labels.length) return
        const at = activeSeries ? labels.indexOf(activeSeries) : -1
        const step = e.key === seriesDown ? 1 : -1
        // Cycle through the series and back to "all".
        const nextAt = at + step
        activeSeries = nextAt < 0 || nextAt >= labels.length ? null : labels[nextAt]!
        dimmed = activeSeries
        focusCat(src, i)
        return
      }
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
        if (!onSelect && !selMode) return
        e.preventDefault()
        catClick(e, i)
        return
      case 'Escape':
        if (activeSeries) { activeSeries = null; dimmed = null; focusCat(src, i) }
        return
    }
  }
  // ---- Roving focus across marks ----------------------------------------
  // The non-cartesian families (slices, arcs, cells, segments, nodes, dots)
  // are one Tab stop each, like the category hit zones: the last focused mark
  // keeps tabindex 0 and the arrow keys walk the rest, Home / End jump to the
  // ends, PageUp / PageDown move a tenth. A pie with twenty slices used to be
  // twenty Tab stops and a heat map nine hundred. `grid` makes the walk
  // two-dimensional: a heat map is row-major, a calendar column-major (a week
  // is a column of seven days).
  let rove = $state<{ sel: string; i: number }>({ sel: '', i: 0 })
  const roveTab = (sel: string, i: number) => (!interactive ? undefined : (rove.sel === sel ? rove.i : 0) === i ? 0 : -1)
  function onMarkFocus(sel: string, i: number) {
    if (rove.sel !== sel || rove.i !== i) rove = { sel, i }
  }
  function markKey(
    e: KeyboardEvent,
    sel: string,
    i: number,
    act?: (() => void) | null,
    grid?: { cols: number; colMajor?: boolean },
  ) {
    if (e.key === 'Enter' || e.key === ' ') {
      if (act) { e.preventDefault(); act() }
      return
    }
    const cur = e.currentTarget as SVGElement
    const root = cur.ownerSVGElement ?? cur.closest('svg')
    if (!root) return
    const all = root.querySelectorAll<SVGElement>(sel)
    const n = all.length
    if (!n) return
    const dx = grid ? (grid.colMajor ? grid.cols : 1) : 1
    const dy = grid ? (grid.colMajor ? 1 : grid.cols) : 1
    let next: number
    switch (e.key) {
      case 'ArrowRight': next = i + dx; break
      case 'ArrowLeft': next = i - dx; break
      case 'ArrowDown': next = i + dy; break
      case 'ArrowUp': next = i - dy; break
      case 'Home': next = 0; break
      case 'End': next = n - 1; break
      case 'PageDown': next = i + Math.max(1, Math.floor(n / 10)); break
      case 'PageUp': next = i - Math.max(1, Math.floor(n / 10)); break
      default: return
    }
    e.preventDefault()
    next = Math.max(0, Math.min(n - 1, next))
    if (next === i) return
    rove = { sel, i: next }
    all[next]!.focus?.()
  }
  /** Focus a mark's tooltip at the mark itself, for keyboard readers. */
  const box = (el: Element) => { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top } }

  // ---- Keyboard zoom and pan --------------------------------------------
  // The plot's own keys, on a focused category: + / = zoom in around it, -
  // zooms out, 0 resets, Shift + the category arrows pan a zoomed window a
  // tenth at a time. Focus follows the same category through the change.
  function keyZoom(e: KeyboardEvent, i: number): boolean {
    if (!zoomCfg || !isCartesian) return false
    const n = spec.categories.length
    const at = (zoom?.i0 ?? 0) + i
    let next: ChartZoomWindow | null | undefined
    const nextKey = isHorizontal ? 'ArrowDown' : 'ArrowRight'
    const prevKey = isHorizontal ? 'ArrowUp' : 'ArrowLeft'
    if (e.key === '+' || e.key === '=') next = wheelWindow(zoom, n, at, 0.8)
    else if (e.key === '-' || e.key === '_') next = wheelWindow(zoom, n, at, 1.25)
    else if (e.key === '0') next = null
    else if (e.shiftKey && zoom && (e.key === nextKey || e.key === prevKey)) {
      const span = zoom.i1 - zoom.i0 + 1
      next = panWindow(zoom, n, (e.key === nextKey ? 1 : -1) * Math.max(1, Math.floor(span / 10)))
    }
    if (next === undefined) return false
    e.preventDefault()
    setZoom(next)
    // The window re-slices the categories, so the focused index moves.
    const local = Math.max(0, Math.min((next ? next.i1 - next.i0 : n - 1), at - (next?.i0 ?? 0)))
    // After the re-render the old hit zone is gone, so look the new one up
    // on the svg itself rather than from the stale source element.
    void tick().then(() => {
      const target = svgEl?.querySelector<SVGElement>(dense ? '[data-dense="true"]' : `[data-cat-index="${local}"]`)
      if (!target) return
      target.focus?.()
      if (dense) denseIndex = local
      focusCat(target, local)
    })
    return true
  }

  // ---- Keyboard brush ---------------------------------------------------
  // The brush is a slider to the keyboard: Left / Right pan the window a
  // tenth of it (Shift: the whole window), Up / + narrow it, Down / - widen
  // it, Home / End push it to either end, 0 or Escape reset.
  function onBrushKey(e: KeyboardEvent) {
    const n = spec.categories.length
    if (!n) return
    const win = zoom ?? { i0: 0, i1: n - 1 }
    const span = win.i1 - win.i0 + 1
    const mid = (win.i0 + win.i1) / 2
    const step = e.shiftKey ? span : Math.max(1, Math.floor(span / 10))
    let next: ChartZoomWindow | null | undefined
    switch (e.key) {
      case 'ArrowRight': next = panWindow(zoom, n, step); break
      case 'ArrowLeft': next = panWindow(zoom, n, -step); break
      case 'ArrowUp': case '+': case '=': next = wheelWindow(zoom, n, mid, 0.8); break
      case 'ArrowDown': case '-': case '_': next = wheelWindow(zoom, n, mid, 1.25); break
      case 'Home': next = zoom ? { ...zoom, i0: 0, i1: span - 1 } : null; break
      case 'End': next = zoom ? { ...zoom, i0: n - span, i1: n - 1 } : null; break
      case '0': case 'Escape': next = null; break
      default: return
    }
    e.preventDefault()
    setZoom(next)
  }


  // ---- Export ----------------------------------------------------------
  // PNG / SVG download + copy-as-image. Serialize the live SVG element so
  // the exported file matches the user's current zoom / visibility state.
  let copyStatus = $state<'idle' | 'ok' | 'err'>('idle')

  // ---- Context menu ----------------------------------------------------
  // The menu component is loaded on the first right-click, so a chart that
  // is never right-clicked never pays for it.
  let menu = $state<{ x: number; y: number; target: ChartContextTarget } | null>(null)
  let MenuComp = $state<typeof import('./SvChartMenu.svelte').default | null>(null)
  function onContextMenu(e: MouseEvent) {
    if (!contextMenu) return
    e.preventDefault()
    const i = isCartesian && !isScatter ? catAtClientX(e.clientX, e.currentTarget as Element) : null
    openMenuAt(e.clientX, e.clientY, i)
  }
  function openMenuAt(x: number, y: number, i: number | null) {
    const target: ChartContextTarget = i != null
      ? {
          category: visibleSpec.categories[i],
          index: (zoom ? zoom.i0 : 0) + i,
          ...(activeSeries ? { series: activeSeries, value: visibleSpec.series.find((sr) => sr.label === activeSeries)?.values[i] } : {}),
        }
      : {}
    const open = () => (menu = { x, y, target })
    if (MenuComp) open()
    else import('./SvChartMenu.svelte').then((m) => { MenuComp = m.default; open() })
  }
  /** Shift + F10 and the Menu key open the context menu on the focused category. */
  function menuKey(e: KeyboardEvent, i: number): boolean {
    if (!contextMenu || !(e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) return false
    e.preventDefault()
    const r = (e.currentTarget as Element).getBoundingClientRect()
    openMenuAt(r.left + r.width / 2, r.top + Math.min(r.height / 2, 24), i)
    return true
  }
  const menuItems = $derived.by<MenuItem[]>(() => {
    if (!menu) return []
    const items: MenuItem[] = [
      { label: t.downloadPng, onSelect: () => { void downloadImage('png') } },
      { label: t.downloadSvg, onSelect: () => { void downloadImage('svg') } },
      { label: t.downloadPdf, onSelect: () => { void exportPdf() } },
      ...(chartCsvExportable(spec) ? [{ label: t.downloadCsv, onSelect: () => { downloadChartCsv(spec) } }] : []),
      { label: t.copyAsImage, onSelect: () => { void copyAsImage() } },
      { label: t.print, onSelect: () => { void printIt() } },
      ...(describe && summary ? [{ label: t.describeChart, onSelect: () => { void copySummary() } }] : []),
    ]
    if (zoomable && isZoomed) items.push({ separator: true }, { label: t.resetZoom, onSelect: resetZoom })
    if (presetsApply) {
      items.push({ separator: true }, {
        label: t.range,
        children: presetList.map((pr) => ({ label: presetLabel(pr), onSelect: () => applyPreset(pr) })),
      })
    }
    if (legendToggles && legendItems.length > 1) {
      items.push({ separator: true }, {
        label: t.series,
        children: legendItems.map((it) => ({ label: `${it.off ? '\u2002' : '\u2713'} ${it.label}`, onSelect: () => toggle(it.label) })),
      })
    }
    const custom = typeof contextMenu === 'function' ? contextMenu(menu.target) : Array.isArray(contextMenu) ? contextMenu : []
    if (custom.length) items.push({ separator: true }, ...custom)
    return items
  })
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
    // The rules read tokens; inline the host's resolved values (theme and
    // `spec.style` alike) so a standalone file keeps its colours and font.
    if (chartEl && typeof getComputedStyle === 'function') {
      const cs = getComputedStyle(chartEl)
      const vars = ['--sg-bg', '--sg-fg', '--sg-muted', '--sg-border', '--sg-accent', '--sg-chart-bg', '--sg-chart-font-scale']
        .map((n) => { const v = cs.getPropertyValue(n).trim(); return v ? `${n}:${v}` : '' })
        .filter(Boolean)
      if (cs.fontFamily) vars.push(`font-family:${cs.fontFamily}`)
      if (vars.length) clone.setAttribute('style', vars.join(';'))
    }
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
  /** PDF and print live in their own chunk, fetched on first use. */
  async function exportPdf() {
    if (!chartEl) return
    const m = await import('./chart-export-pdf')
    const stamp = new Date().toISOString().slice(0, 10)
    await m.downloadChartPdf(chartEl, `chart-${stamp}.pdf`, { title: spec.title, subtitle: spec.subtitle, caption: spec.caption })
  }
  async function printIt() {
    if (!chartEl) return
    const m = await import('./chart-export-pdf')
    m.printChart(chartEl, { title: spec.title })
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

<div
  class="sv-grid-chart"
  class:is-autosize={autosize}
  class:is-legend-top={legendPos === 'top'}
  class:is-legend-left={legendPos === 'left'}
  class:is-legend-right={legendPos === 'right'}
  bind:this={chartEl}
  bind:clientWidth={hostW}
  bind:clientHeight={hostH}
  style={chartStyleVars(spec.style) || undefined}
>
  {#snippet crumbs()}
    <nav class="sv-grid-chart-crumbs" aria-label={t.drillPath}>
      <button type="button" class="sv-grid-chart-tool sv-grid-chart-crumb" onclick={() => drillTo([])}>{drillRoot?.name || t.drillRoot}</button>
      {#each drillPath as seg, k (k)}
        <span class="sv-grid-chart-crumb-sep" aria-hidden="true">/</span>
        {#if k === drillPath.length - 1}
          <span class="sv-grid-chart-crumb is-current" aria-current="page">{seg}</span>
        {:else}
          <button type="button" class="sv-grid-chart-tool sv-grid-chart-crumb" onclick={() => drillTo(drillPath.slice(0, k + 1))}>{seg}</button>
        {/if}
      {/each}
    </nav>
  {/snippet}
  {#if showToolbar}
    <div class="sv-grid-chart-toolbar" role="toolbar" bind:clientHeight={toolbarH}>
      {#if canDrill && drillPath.length}
        {@render crumbs()}
      {/if}
      {#if presetsApply}
        <span class="sv-grid-chart-presets" role="group" aria-label={t.dateRange}>
          {#each presetList as p (presetLabel(p))}
            <button type="button" class="sv-grid-chart-tool sv-grid-chart-preset" onclick={() => applyPreset(p)} title={msg(t.showLast, { preset: presetLabel(p) })}>{presetLabel(p)}</button>
          {/each}
        </span>
      {/if}
      {#if zoomCfg && (zoomCfg.pan === 'mode' || zoomCfg.pan === true) && isZoomed}
        <button type="button" class="sv-grid-chart-tool" class:is-on={panMode} aria-pressed={panMode} onclick={() => (panMode = !panMode)} title={t.panTitle}>
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l-3 3 3 3"/><path d="M9 5l3-3 3 3"/><path d="M15 19l-3 3-3-3"/><path d="M19 9l3 3-3 3"/><path d="M2 12h20"/><path d="M12 2v20"/></svg>
          {t.pan}
        </button>
      {/if}
      {#if zoomable && isZoomed}
        <button type="button" class="sv-grid-chart-tool" onclick={resetZoom} title={t.resetZoomTitle}>
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>
          {t.resetZoom}
        </button>
      {/if}
      {#if annotatable}
        <button
          type="button"
          class="sv-grid-chart-tool"
          class:is-on={annotating}
          aria-pressed={annotating}
          onclick={() => (annotating = !annotating)}
          title={annotating ? t.annotateOnTitle : t.annotateOffTitle}
        >
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6"/><circle cx="12" cy="11" r="3"/><path d="M12 14v8"/></svg>
          {t.annotate}
        </button>
      {/if}
      {#if toolKinds.length && isCartesian}
        <span class="sv-grid-chart-drawtools" role="group" aria-label={t.drawingTools}>
          {#each toolKinds as kind (kind)}
            <button type="button" class="sv-grid-chart-tool sv-grid-chart-drawtool" class:is-on={tool === kind} aria-pressed={tool === kind} onclick={() => pickTool(kind)} title={msg(t.draw, { tool: TOOL_LABEL[kind] })}>{TOOL_LABEL[kind]}</button>
          {/each}
          {#if drawingsNow().length}
            <button type="button" class="sv-grid-chart-tool" disabled={!selectedDrawing} onclick={() => selectedDrawing && removeDrawing(selectedDrawing)} title={t.deleteDrawingTitle}>{t.deleteDrawing}</button>
            <button type="button" class="sv-grid-chart-tool" onclick={() => commitDrawings([])} title={t.clearDrawingsTitle}>{t.clearDrawings}</button>
          {/if}
        </span>
      {/if}
      <button type="button" class="sv-grid-chart-tool" onclick={() => downloadImage('png')} title={t.downloadPng}>{t.png}</button>
      <button type="button" class="sv-grid-chart-tool" onclick={() => downloadImage('svg')} title={t.downloadSvg}>{t.svg}</button>
      <button type="button" class="sv-grid-chart-tool" onclick={exportPdf} title={t.downloadPdf}>{t.pdf}</button>
      <button type="button" class="sv-grid-chart-tool" onclick={printIt} title={t.printTitle}>{t.print}</button>
      <button type="button" class="sv-grid-chart-tool" onclick={copyAsImage} title={t.copyTitle}>
        {copyStatus === 'ok' ? t.copied : t.copy}
      </button>
    </div>
  {:else if canDrill && drillPath.length}
    <!-- The toolbar is off, but the breadcrumb is the way back up: a drilled
         chart without it is a room with no door. -->
    <div class="sv-grid-chart-toolbar is-crumbs-only" role="toolbar" bind:clientHeight={toolbarH}>
      {@render crumbs()}
    </div>
  {/if}
  <!-- A group, not an image, while it is interactive: an image's children are
       presentational to assistive technology, which would hide the focusable
       marks inside. A thumbnail (interactive={false}) is one image. -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <svg
    bind:this={svgEl}
    class="sv-grid-chart-svg"
    class:is-interactive={interactive}
    class:is-clickable={!!onSelect || !!onDrill}
    class:is-zoomable={!!zoomCfg?.drag && isCartesian && !annotating && !panMode}
    class:is-pannable={!!zoomCfg?.pan && isCartesian && isZoomed && panMode}
    class:is-annotating={annotating}
    class:is-dragging={!!dragStart}
    viewBox={`0 0 ${geo.width} ${geo.height}`}
    width="100%"
    style:height={autosize ? `${layoutH ?? spec.height ?? 300}px` : null}
    role={interactive ? 'group' : 'img'}
    aria-label={msg(t.chartLabel, { type: spec.type })}
    aria-description={describe && summary ? summary : undefined}
    aria-describedby={`${uid}-table`}
    class:is-drawing={!!tool}
    onpointerdown={onZoomDown}
    onpointermove={(e) => { onZoomMove(e); onDrawMove(e) }}
    onpointerup={(e) => { onZoomUp(e); handleDrag = null }}
    onpointercancel={(e) => { onZoomUp(e); handleDrag = null }}
    onclick={onDrawClick}
    onkeydown={onSvgKey}
    onwheel={onWheel}
    oncontextmenu={onContextMenu}
    ondblclick={onPlotDblClick}
  >
    <!-- Pattern defs: emitted once per series when patternFallback is on
         or a series sets `pattern`. Color is baked into the pattern so
         each series gets a hue-tinted texture without dynamic CSS. -->
    {#if patternDefs.length || gradientDefs.length || isCartesian}
      <defs>
        {#if isCartesian}
          <!-- Marks are clipped to the plot so a pinned axis min / max cuts a
               value off at the edge instead of drawing it over the gutter. A
               few px of slack keeps a dot sitting on the edge whole. -->
          <clipPath id={`${uid}-plot`}>
            <rect class:sv-grid-chart-wipe={enterFx === 'wipe'} x={geo.plot.x - 4} y={geo.plot.y - 4} width={geo.plot.w + 8} height={geo.plot.h + 8} />
          </clipPath>
        {/if}
        {#each gradientDefs as g (g.id)}
          <linearGradient id={g.id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color={g.from} />
            <stop offset="1" stop-color={g.to === 'transparent' ? g.from : g.to} stop-opacity={g.to === 'transparent' ? 0 : 1} />
          </linearGradient>
        {/each}
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
    {#if geo.frame.title}
      <text class="sv-grid-chart-title" x={geo.frame.title.x} y={geo.frame.title.y} text-anchor="middle">{geo.frame.title.text}</text>
    {/if}
    {#if geo.frame.subtitle}
      <text class="sv-grid-chart-subtitle" x={geo.frame.subtitle.x} y={geo.frame.subtitle.y} text-anchor="middle">{geo.frame.subtitle.text}</text>
    {/if}
    {#if geo.frame.caption}
      <text class="sv-grid-chart-caption" x={geo.frame.caption.x} y={geo.frame.caption.y} text-anchor="start">{geo.frame.caption.text}</text>
    {/if}
    {#if isHorizontal}
      <!-- Value axis (vertical gridlines + bottom labels) -->
      {#each geo.valueTicks as t (t.label + t.x)}
        {#if geo.grid.x}
          <line class="sv-grid-chart-gridline" x1={t.x} y1={geo.plot.y} x2={t.x} y2={geo.plot.y + geo.plot.h} />
        {/if}
        <text class="sv-grid-chart-axis is-x" x={t.x} y={geo.plot.y + geo.plot.h + 14} text-anchor="middle">{t.label}</text>
      {/each}
      {#if geo.grid.y}
        {#each geo.catTicks as t (t.value)}
          <line class="sv-grid-chart-gridline" x1={geo.plot.x} y1={t.y} x2={geo.plot.x + geo.plot.w} y2={t.y} />
        {/each}
      {/if}
      <!-- Category labels down the left -->
      {#each geo.catTicks as t (t.value)}
        <text class="sv-grid-chart-axis" x={geo.plot.x - 6} y={t.y + 3} text-anchor="end">{truncate(t.label, 18)}</text>
      {/each}
      {#if yTitle}
        <text class="sv-grid-chart-axis-title" x={13} y={geo.plot.y + geo.plot.h / 2} text-anchor="middle" transform={`rotate(-90 13 ${geo.plot.y + geo.plot.h / 2})`}>{yTitle}</text>
      {/if}
      {#if xTitle}
        <text class="sv-grid-chart-axis-title" x={geo.plot.x + geo.plot.w / 2} y={geo.height - 3 - geo.frame.bottom} text-anchor="middle">{xTitle}</text>
      {/if}
    {:else if isCartesian}
      {#each geo.yTicks as t (t.value)}
        {#if geo.grid.y || t.value === 0}
          <line class="sv-grid-chart-gridline" class:is-zero={t.value === 0} x1={geo.plot.x} y1={t.y} x2={geo.plot.x + geo.plot.w} y2={t.y} />
        {/if}
        {#if t.label}
          <text class="sv-grid-chart-axis" x={geo.plot.x - 6} y={t.y + 3} text-anchor="end">{yTickLabel(t.value, t.label)}</text>
        {/if}
      {/each}
      {#if geo.grid.x}
        {#each geo.xTicks as t (t.label + t.x)}
          <line class="sv-grid-chart-gridline" x1={t.x} y1={geo.plot.y} x2={t.x} y2={geo.plot.y + geo.plot.h} />
        {/each}
      {/if}
      {#if geo.hasRightAxis}
        {#each geo.y2Ticks as t (t.value)}
          {#if t.label}
            <text class="sv-grid-chart-axis" x={geo.plot.x + geo.plot.w + 6} y={t.y + 3} text-anchor="start">{yTickLabel(t.value, t.label)}</text>
          {/if}
        {/each}
      {/if}
      {#each geo.xTicks as t (t.label + t.x)}
        {#if !t.label}
          <!-- `xAxis.labels: false` (a pane above another) keeps the ticks
               for the grid lines and draws no text. -->
        {:else if geo.xLabelRotated}
          <text class="sv-grid-chart-axis is-x" x={t.x} y={geo.plot.y + geo.plot.h + 12} text-anchor={geo.xLabelAngle < 0 ? 'end' : 'start'} transform={`rotate(${geo.xLabelAngle} ${t.x} ${geo.plot.y + geo.plot.h + 12})`}>{truncate(t.label, Math.abs(geo.xLabelAngle) >= 60 ? 18 : 12)}</text>
        {:else}
          <text class="sv-grid-chart-axis is-x" x={t.x} y={geo.plot.y + geo.plot.h + 16} text-anchor="middle">{truncate(t.label, 16)}</text>
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
      {#if yTitle}
        <text class="sv-grid-chart-axis-title" x={13} y={geo.plot.y + geo.plot.h / 2} text-anchor="middle" transform={`rotate(-90 13 ${geo.plot.y + geo.plot.h / 2})`}>{yTitle}</text>
      {/if}
      {#if y2Title}
        <text class="sv-grid-chart-axis-title" x={geo.width - 12} y={geo.plot.y + geo.plot.h / 2} text-anchor="middle" transform={`rotate(90 ${geo.width - 12} ${geo.plot.y + geo.plot.h / 2})`}>{y2Title}</text>
      {/if}
      {#if xTitle}
        <text class="sv-grid-chart-axis-title" x={geo.plot.x + geo.plot.w / 2} y={geo.height - 3 - geo.frame.bottom} text-anchor="middle">{xTitle}</text>
      {/if}
    {/if}

    <!-- Reference bands sit under everything: they are context, not data. -->
    {#each geo.referenceBands as band, bi (bi)}
      <rect class="sv-grid-chart-refband" x={band.x} y={band.y} width={band.w} height={band.h} fill={band.color} fill-opacity={band.opacity} />
      {#if band.label}
        {#if band.axis === 'y'}
          <text class="sv-grid-chart-reflabel" x={band.x + band.w - 3} y={band.y + 10} text-anchor="end" fill={band.color}>{band.label}</text>
        {:else}
          <text class="sv-grid-chart-reflabel" x={band.x + band.w / 2} y={band.y + 10} text-anchor="middle" fill={band.color}>{band.label}</text>
        {/if}
      {/if}
    {/each}

    <g class="sv-grid-chart-marks" class:is-enter-grow={enterFx === 'grow'} class:is-enter-none={enterFx === 'none'} clip-path={isCartesian ? `url(#${uid}-plot)` : undefined}>
    {#each geo.lines as line, li (line.label + li)}
      {@const gradId = line.style?.gradient ? `${uid}-grad-${li}` : null}
      <g style={`opacity:${dimOf(line.label) * (line.style?.opacity ?? 1)}`}>
        {#if line.bandPath}
          <!-- Confidence band: shaded envelope between upperValues / lowerValues. -->
          <path class="sv-grid-chart-band" d={line.bandPath} fill={line.color} fill-opacity="0.12" stroke="none" />
        {/if}
        {#if line.areaPath}
          <!-- A range area's band is the mark, so it fills stronger than the
               wash under a line and its two edges are drawn thin. -->
          <path class="sv-grid-chart-area" d={line.areaPath} fill={gradId ? `url(#${gradId})` : seriesFill[line.label] ?? line.color} fill-opacity={gradId ? 0.6 : line.range ? 0.35 : 0.15} stroke="none" />
        {/if}
        <path class="sv-grid-chart-linepath" d={line.path} fill="none" stroke={line.color} stroke-width={line.style?.strokeWidth ?? (line.range ? 1 : 2)} stroke-dasharray={line.style?.dash} stroke-linejoin="round" stroke-linecap="round" />
        {#if dense}
          <!-- Below ~4px a category the dots touch, so they stop marking the
               points and start hiding the line. Only the hovered one is drawn,
               which is the one a reader is actually asking about. -->
          {@const pt = line.points[activeCat ?? -1]}
          {#if pt?.defined}
            <circle class="sv-grid-chart-dot is-active" cx={pt.x} cy={pt.y} r="4" fill={pt.marker?.color ?? line.color} />
          {/if}
        {:else}
          {#each line.points as pt, pi (pi)}
            {#if pt.defined && pt.marker?.shape !== 'none'}
              {@const shape = pt.marker?.shape ?? 'circle'}
              {@const size = (pt.marker?.size ?? 3) + (activeCat === pi ? 1 : 0)}
              {@const fill = pt.marker?.color ?? line.color}
              {#if shape === 'circle'}
                <circle class="sv-grid-chart-dot" class:is-active={activeCat === pi} class:is-selected={isSel(pt.label, line.label)} cx={pt.x} cy={pt.y} r={size} fill={fill} style={`opacity:${selDim(pt.label, line.label)}`} />
              {:else if shape === 'cross'}
                <path class="sv-grid-chart-dot is-stroked" class:is-active={activeCat === pi} d={markerPath(shape, pt.x, pt.y, size)} fill="none" stroke={fill} stroke-width="1.5" />
              {:else}
                <path class="sv-grid-chart-dot" class:is-active={activeCat === pi} d={markerPath(shape, pt.x, pt.y, size)} fill={fill} />
              {/if}
            {/if}
          {/each}
        {/if}
      </g>
    {/each}

    <!-- Custom-series seam, beneath the built-in marks: shaded regions, bands,
         anything the bars should sit on top of. -->
    {#if underlay}{@render underlay(renderCtx)}{/if}

    {#each geo.bars as bar, bi (bi)}
      <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
      <rect class="sv-grid-chart-bar" class:is-selected={isSel(bar.label, bar.series, bar.index)} x={bar.x} y={bar.y} width={bar.w} height={bar.h} rx="1" fill={seriesFill[bar.series]?.startsWith('url(') ? seriesFill[bar.series] : bar.color} style={`opacity:${dimOf(bar.series) * (bar.opacity ?? 1) * selDim(bar.label, bar.series, bar.index)}`} onclick={selMode ? (e) => { e.stopPropagation(); select(bar.label, bar.series, bar.value, bar.index, e) } : undefined} />
    {/each}

    <!-- Lollipop stems and dumbbells: a rule with a dot (or two). -->
    {#each geo.stems as st, sti (sti)}
      <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events -->
      <g class="sv-grid-chart-stem" style={`opacity:${dimOf(st.series)}`} onmousemove={(e) => hoverStem(e.clientX, e.clientY, st)} onmouseleave={clearActive}>
        <line x1={st.xCenter} y1={st.y0} x2={st.xCenter} y2={st.y1} stroke={st.dumbbell ? 'var(--sg-muted, #94a3b8)' : st.color} stroke-width={st.dumbbell ? 2 : 1.5} />
        {#if st.dumbbell}
          <circle class="sv-grid-chart-dot" cx={st.xCenter} cy={st.y0} r={st.r} fill={st.color2 ?? st.color} fill-opacity="0.55" stroke={st.color2 ?? st.color} />
        {/if}
        <circle class="sv-grid-chart-dot" cx={st.xCenter} cy={st.y1} r={st.r} fill={st.color} />
      </g>
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
        <rect class="sv-grid-chart-candle" x={k.x} y={k.bodyY} width={k.w} height={k.bodyH} fill={k.hollow ? 'none' : k.color} stroke={k.color} style={`opacity:${dimOf(k.series)}`} />
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
      <!-- A point selects like a bar: its label (or its series) is the
           category, its y the value, and Enter does what a click does. The
           dots used to have no click handler, so `selectable` and `onSelect`
           did nothing on a scatter chart. -->
      <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
      <circle
        class="sv-grid-chart-scatter"
        class:is-selected={isSel(dot.label || dot.series, dot.series, di)}
        cx={dot.cx}
        cy={dot.cy}
        r={dot.r}
        fill={dot.color}
        fill-opacity="0.7"
        stroke={dot.color}
        style={`opacity:${dimOf(dot.series) * selDim(dot.label || dot.series, dot.series, di)}`}
        role={selMode || onSelect ? 'button' : 'img'}
        tabindex={roveTab('.sv-grid-chart-scatter', di)}
        aria-label={`${dot.label || dot.series}: ${fmt(dot.x)}, ${fmt(dot.y)}`}
        onmousemove={(e) => hoverDot(e.clientX, e.clientY, dot)}
        onmouseleave={clearActive}
        onclick={selMode || onSelect ? (e) => { e.stopPropagation(); select(dot.label || dot.series, dot.series, dot.y, di, e) } : undefined}
        onfocus={(e) => { onMarkFocus('.sv-grid-chart-scatter', di); const p = box(e.currentTarget); hoverDot(p.x, p.y, dot) }}
        onblur={clearActive}
        onkeydown={(e) => markKey(e, '.sv-grid-chart-scatter', di, selMode || onSelect ? () => select(dot.label || dot.series, dot.series, dot.y, di, e) : null)}
      />
    {/each}
    </g>

    <!-- Reference / target lines paint on top so they read over the bars/areas. -->
    {#each geo.referenceLines as ref, ri (ri)}
      <line class="sv-grid-chart-refline" x1={geo.plot.x} y1={ref.y} x2={geo.plot.x + geo.plot.w} y2={ref.y} stroke={ref.color} stroke-dasharray={ref.dashed ? '5 4' : undefined} />
      {#if ref.pill}
        <!-- A last-price pill: the value in a filled tag at the right end of
             the line, the way a ticker reads it. -->
        {@const pw = Math.max(28, ref.label.length * 6.4 + 10)}
        <g class="sv-grid-chart-refpill">
          <rect x={geo.plot.x + geo.plot.w - pw} y={ref.y - 8} width={pw} height="16" rx="3" fill={ref.color} />
          <text x={geo.plot.x + geo.plot.w - pw / 2} y={ref.y + 3.5} text-anchor="middle" fill="#fff">{ref.label}</text>
        </g>
      {:else}
        <text class="sv-grid-chart-reflabel" x={geo.plot.x + geo.plot.w - 3} y={ref.y - 3} text-anchor="end" fill={ref.color}>{ref.label}</text>
      {/if}
    {/each}
    {#each geo.referenceLinesV as ref, ri (ri)}
      <line class="sv-grid-chart-refline" x1={ref.x} y1={geo.plot.y} x2={ref.x} y2={geo.plot.y + geo.plot.h} stroke={ref.color} stroke-dasharray={ref.dashed ? '5 4' : undefined} />
      <text class="sv-grid-chart-reflabel" x={ref.x + 3} y={geo.plot.y + 9} text-anchor="start" fill={ref.color}>{ref.label}</text>
    {/each}

    <!-- Trend / moving-average overlays. Dashed so they read distinctly
         from the source series, drawn on top of bars + lines. -->
    <g class="sv-grid-chart-marks" class:is-enter-grow={enterFx === 'grow'} class:is-enter-none={enterFx === 'none'} clip-path={isCartesian ? `url(#${uid}-plot)` : undefined}>
    {#each geo.overlays as ovl, oi (ovl.label + oi)}
      {#if ovl.bandPath}
        <path class="sv-grid-chart-overlay-band" d={ovl.bandPath} fill={ovl.color} fill-opacity="0.1" stroke={ovl.color} stroke-opacity="0.35" stroke-width="1" />
      {/if}
      <path class="sv-grid-chart-overlay" d={ovl.path} fill="none" stroke={ovl.color} stroke-width="2" stroke-dasharray="6 4" stroke-linejoin="round" stroke-linecap="round" />
    {/each}
    </g>

    <!-- Data labels, placed and thinned by the engine so bars, lines and combos
         share one rule set. Outside the clip: a label above the top bar may
         legitimately sit in the gutter. -->
    {#each dataLabelGeo as dl, dli (dli)}
      {#if dl.leader}
        <line class="sv-grid-chart-datalabel-leader" x1={dl.leader.x1} y1={dl.leader.y1} x2={dl.leader.x2} y2={dl.leader.y2} style={`opacity:${dimOf(dl.series)}`} />
      {/if}
      <text class="sv-grid-chart-datalabel" class:on-bar={dl.onBar} x={dl.x} y={dl.y} text-anchor={dl.anchor} transform={dl.angle ? `rotate(${dl.angle} ${dl.x} ${dl.y})` : undefined} style={`opacity:${dimOf(dl.series)}`}>{dl.text}</text>
    {/each}

    <!-- Series names at the lines' last points, in the gutter the engine
         reserved for them. Outside the clip on purpose. -->
    {#each geo.seriesLabels as sl (sl.series)}
      <text class="sv-grid-chart-serieslabel" x={sl.x} y={sl.y + 3.5} text-anchor="start" fill={sl.color} style={`opacity:${dimOf(sl.series)}`}>{sl.text}</text>
    {/each}

    <!-- Custom-series seam, above the built-in marks. Deliberately BEFORE the
         crosshair and the hit layer below, so a custom mark cannot swallow the
         tooltips, the keyboard navigation or the drill clicks. -->
    {#if overlay}{@render overlay(renderCtx)}{/if}

    <!-- Pinned annotations: small marker + label. Placement nudges the
         label position so it sits clear of the data point. -->
    {#each geo.annotations as ann, ai (ann.label + ai)}
      {@const dx = ann.placement === 'left' ? -8 : ann.placement === 'right' ? 8 : 0}
      {@const dy = ann.placement === 'bottom' ? 14 : ann.placement === 'top' ? -8 : 0}
      {@const anchor = ann.placement === 'left' ? 'end' : ann.placement === 'right' ? 'start' : 'middle'}
      {@const removable = annotating && !!onAnnotationRemove}
      {@const flagW = Math.max(14, ann.label.length * 6.2 + 8)}
      <!-- The group is the interactive element: removable in annotate mode,
           hoverable / focusable when the note carries longer text. -->
      <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
      <g
        class="sv-grid-chart-annotation-marker"
        class:is-removable={removable}
        class:has-text={!!ann.text}
        role={removable ? 'button' : ann.text ? 'img' : undefined}
        tabindex={removable || ann.text ? 0 : undefined}
        aria-label={removable ? msg(t.removeNote, { label: ann.label }) : ann.text ? `${ann.label}: ${ann.text}` : undefined}
        onclick={(e) => {
          if (!annotating || !onAnnotationRemove) return
          // Or the same click also pins a NEW note where this one is.
          e.stopPropagation()
          onAnnotationRemove(ai)
        }}
        onkeydown={(e) => {
          if (!annotating || !onAnnotationRemove) return
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault()
          e.stopPropagation()
          onAnnotationRemove(ai)
        }}
        onmouseenter={(e) => { if (ann.text) showTip(e.clientX, e.clientY, ann.label, [{ value: ann.text }]) }}
        onmouseleave={() => { if (ann.text) tip = null }}
        onfocus={() => {
          if (!ann.text || !svgEl) return
          const r = svgEl.getBoundingClientRect()
          showTip(r.left + (ann.x * r.width) / geo.width, r.top + (ann.y * r.height) / geo.height, ann.label, [{ value: ann.text }])
        }}
        onblur={() => { if (ann.text) tip = null }}
      >
        {#if ann.shape === 'flag'}
          <line x1={ann.x} y1={ann.y} x2={ann.x} y2={ann.y - 24} stroke={ann.color} stroke-width="1.5" />
          <rect x={ann.x} y={ann.y - 24} width={flagW} height="13" rx="2" fill={ann.color} />
          <text class="sv-grid-chart-annotation-flagtext" x={ann.x + flagW / 2} y={ann.y - 14.5} text-anchor="middle" fill="#fff">{ann.label}</text>
        {:else if ann.shape === 'pin'}
          <path d={`M${ann.x},${ann.y} c-7,-9 -8,-13 -8,-16 a8,8 0 1,1 16,0 c0,3 -1,7 -8,16 z`} fill={ann.color} stroke="var(--sg-bg, #fff)" stroke-width="1.2" />
          <!-- The head fits one glyph, the initial; the label itself sits beside
               the pin like a dot's does, and the tooltip carries the text. -->
          <text class="sv-grid-chart-annotation-flagtext" x={ann.x} y={ann.y - 12.5} text-anchor="middle" fill="#fff">{ann.label.slice(0, 1)}</text>
          <text class="sv-grid-chart-annotation-label" x={ann.x + dx} y={ann.y + dy} text-anchor={anchor} fill={ann.color}>{ann.label}</text>
        {:else if ann.shape === 'square'}
          <rect x={ann.x - 4.5} y={ann.y - 4.5} width="9" height="9" fill={ann.color} stroke="var(--sg-bg, #fff)" stroke-width="1.5" />
          <text class="sv-grid-chart-annotation-label" x={ann.x + dx} y={ann.y + dy} text-anchor={anchor} fill={ann.color}>{ann.label}</text>
        {:else}
          <circle cx={ann.x} cy={ann.y} r={removable ? 6 : 4} fill={ann.color} stroke="var(--sg-bg, #fff)" stroke-width="1.5" />
          <text class="sv-grid-chart-annotation-label" x={ann.x + dx} y={ann.y + dy} text-anchor={anchor} fill={ann.color}>{ann.label}</text>
        {/if}
      </g>
    {/each}

    <!-- Reader drawings, clipped to the plot. Selected ones grow handles that
         drag their points; Delete removes the focused one. -->
    {#if geo.drawings.length || pending}
      <g class="sv-grid-chart-drawings" clip-path={`url(#${uid}-plot)`}>
        {#each geo.drawings as d (d.id)}
          {@const p0 = d.points[0]!}
          {@const p1 = d.points[1]}
          {@const sel = selectedDrawing === d.id}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <g
            class={`sv-grid-chart-drawing is-${d.kind}`}
            class:is-selected={sel}
            role={drawable ? 'button' : undefined}
            tabindex={drawable ? 0 : undefined}
            aria-label={drawable ? `${msg(t.drawing, { tool: TOOL_LABEL[d.kind] })}${d.text ? `: ${d.text}` : ''}` : undefined}
            onclick={(e) => { if (drawable && !tool) { e.stopPropagation(); selectedDrawing = sel ? null : d.id } }}
            onkeydown={(e) => { if (drawable) onDrawKey(e, d.id) }}
          >
            {#if (d.kind === 'trend' || d.kind === 'arrow') && p1}
              {@const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x)}
              <line class="sv-grid-chart-drawing-hit" x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} />
              <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={d.color} stroke-width="1.5" />
              {#if d.kind === 'arrow'}
                <path d={`M${p1.x},${p1.y} L${p1.x - 10 * Math.cos(ang - 0.45)},${p1.y - 10 * Math.sin(ang - 0.45)} L${p1.x - 10 * Math.cos(ang + 0.45)},${p1.y - 10 * Math.sin(ang + 0.45)} Z`} fill={d.color} />
              {/if}
            {:else if d.kind === 'rect' && p1}
              <rect x={Math.min(p0.x, p1.x)} y={Math.min(p0.y, p1.y)} width={Math.abs(p1.x - p0.x)} height={Math.abs(p1.y - p0.y)} fill={d.color} fill-opacity="0.08" stroke={d.color} stroke-width="1.2" />
            {:else if d.kind === 'hray'}
              <line class="sv-grid-chart-drawing-hit" x1={p0.x} y1={p0.y} x2={geo.plot.x + geo.plot.w} y2={p0.y} />
              <line x1={p0.x} y1={p0.y} x2={geo.plot.x + geo.plot.w} y2={p0.y} stroke={d.color} stroke-width="1.2" stroke-dasharray="4 3" />
              <text class="sv-grid-chart-drawing-label" x={geo.plot.x + geo.plot.w - 3} y={p0.y - 3} text-anchor="end" fill={d.color}>{d.label}</text>
            {:else if d.kind === 'fib' && p1 && d.levels}
              {@const x0 = Math.min(p0.x, p1.x)}
              {@const x1 = Math.max(p0.x, p1.x)}
              {#each d.levels as lv (lv.ratio)}
                <line x1={x0} y1={lv.y} x2={x1} y2={lv.y} stroke={d.color} stroke-width="1" stroke-dasharray={lv.ratio === 0 || lv.ratio === 1 ? undefined : '3 3'} />
                <text class="sv-grid-chart-drawing-label" x={x0 + 3} y={lv.y - 2} fill={d.color}>{lv.label}</text>
              {/each}
              <rect class="sv-grid-chart-drawing-hit" x={x0} y={Math.min(p0.y, p1.y)} width={x1 - x0} height={Math.abs(p1.y - p0.y)} />
            {:else if d.kind === 'text'}
              <text class="sv-grid-chart-drawing-text" x={p0.x} y={p0.y} fill={d.color}>{d.text ?? ''}</text>
            {/if}
            {#if sel && drawable}
              {#each d.points as pt, k (k)}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <circle class="sv-grid-chart-drawing-handle" cx={pt.x} cy={pt.y} r="5" fill="var(--sg-bg, #fff)" stroke={d.color} stroke-width="1.5"
                  onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); handleDrag = { id: d.id, index: k }; svgEl?.setPointerCapture?.(e.pointerId) }} />
              {/each}
            {/if}
          </g>
        {/each}
        {#if pending && drawCursor}
          <circle cx={pending.px} cy={pending.py} r="3.5" fill="var(--sg-accent, #2563eb)" />
          {#if tool === 'rect'}
            <rect x={Math.min(pending.px, drawCursor.x)} y={Math.min(pending.py, drawCursor.y)} width={Math.abs(drawCursor.x - pending.px)} height={Math.abs(drawCursor.y - pending.py)} fill="var(--sg-accent, #2563eb)" fill-opacity="0.08" stroke="var(--sg-accent, #2563eb)" stroke-dasharray="4 3" />
          {:else}
            <line x1={pending.px} y1={pending.py} x2={drawCursor.x} y2={drawCursor.y} stroke="var(--sg-accent, #2563eb)" stroke-width="1.5" stroke-dasharray="4 3" />
          {/if}
        {/if}
      </g>
    {/if}

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
        {#if crosshairLabels}
          <!-- The crosshair read off the axes: the category under it on the
               x axis, the value under the pointer on the value axis. -->
          {@const catText = truncate(tip?.title ?? visibleSpec.categories[activeCat] ?? '', 16)}
          {@const cw = Math.max(24, catText.length * 6.2 + 10)}
          <g class="sv-grid-chart-crosshair-label" pointer-events="none">
            <rect x={Math.max(0, Math.min(geo.width - cw, cx - cw / 2))} y={geo.plot.y + geo.plot.h + 2} width={cw} height="15" rx="3" />
            <text x={Math.max(cw / 2, Math.min(geo.width - cw / 2, cx))} y={geo.plot.y + geo.plot.h + 13} text-anchor="middle">{catText}</text>
          </g>
          {#if hoverVy != null && renderScales && geo.axes}
            {@const yText = crosshairValueText(renderScales.yInvert(hoverVy))}
            {@const yw = Math.max(24, yText.length * 6.2 + 10)}
            <g class="sv-grid-chart-crosshair-label" pointer-events="none">
              <rect x={Math.max(0, geo.plot.x - yw - 2)} y={hoverVy - 7.5} width={yw} height="15" rx="3" />
              <text x={Math.max(yw / 2, geo.plot.x - 2 - yw / 2)} y={hoverVy + 3.5} text-anchor="middle">{yText}</text>
            </g>
          {/if}
        {/if}
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
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
        <rect
          class="sv-grid-chart-heatcell"
          x={cell.x} y={cell.y} width={cell.w} height={cell.h}
          fill={cell.color}
          role={onSelect || selMode ? 'button' : 'img'}
          tabindex={roveTab('.sv-grid-chart-heatcell', ci)}
          aria-label={`${cell.rowLabel} ${cell.colLabel}: ${fmt(cell.value)}`}
          onmousemove={(e) => hoverCell(e.clientX, e.clientY, cell)}
          onmouseleave={clearActive}
          onfocus={(e) => { onMarkFocus('.sv-grid-chart-heatcell', ci); const p = box(e.currentTarget); hoverCell(p.x, p.y, cell) }}
          onblur={clearActive}
          onclick={() => select(cell.colLabel, cell.rowLabel, cell.value)}
          onkeydown={(e) => markKey(e, '.sv-grid-chart-heatcell', ci, onSelect || selMode ? () => select(cell.colLabel, cell.rowLabel, cell.value) : null, { cols: geo.heatmapColTicks.length })}
        />
        <!-- The spec's own `dataLabels` counts here too; the cell used to
             read the component prop alone, so `dataLabels: { show: true }`
             in a heat map's spec drew nothing. -->
        {#if labelCfg.show && cell.w > 22 && cell.h > 14}
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
          role={onSelect || selMode ? 'button' : 'img'}
          tabindex={roveTab('.sv-grid-chart-funnel-seg', fi)}
          aria-label={`${seg.label}: ${fmt(seg.value)}`}
          onmousemove={(e) => hoverFunnel(e.clientX, e.clientY, seg)}
          onmouseleave={clearActive}
          onfocus={(e) => { onMarkFocus('.sv-grid-chart-funnel-seg', fi); const p = box(e.currentTarget); hoverFunnel(p.x, p.y, seg) }}
          onblur={clearActive}
          onclick={() => select(seg.label, seg.label, seg.value, fi)}
          onkeydown={(e) => markKey(e, '.sv-grid-chart-funnel-seg', fi, onSelect || selMode ? () => select(seg.label, seg.label, seg.value, fi) : null)}
        />
        <!-- Two lines of text need about 26px of segment; a thumbnail-sized
             funnel keeps the shapes and drops the words. -->
        {#if geo.plot.h / Math.max(1, geo.funnelSegments.length) >= 26}
          <text class="sv-grid-chart-funnel-label" x={seg.cx} y={seg.cy - 3} text-anchor="middle" fill={seg.textColor}>{truncate(seg.label, 24)}</text>
          <text class="sv-grid-chart-funnel-value" x={seg.cx} y={seg.cy + 11} text-anchor="middle" fill={seg.textColor}>
            {fmt(seg.value)} · {(seg.conversion * 100).toFixed(0)}%
          </text>
        {/if}
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
          {@const ri = si * rs.points.length + pi}
          <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
          <circle class="sv-grid-chart-radar-dot" cx={pt.x} cy={pt.y} r="3" fill={rs.color}
            role="img"
            tabindex={roveTab('.sv-grid-chart-radar-dot', ri)}
            aria-label={`${rs.label} ${pt.axis}: ${fmt(pt.value)}`}
            onmousemove={(e) => hoverRadarPoint(e.clientX, e.clientY, rs.label, pt.axis, pt.value, rs.color)}
            onmouseleave={clearActive}
            onfocus={(e) => { onMarkFocus('.sv-grid-chart-radar-dot', ri); const p = box(e.currentTarget); hoverRadarPoint(p.x, p.y, rs.label, pt.axis, pt.value, rs.color) }}
            onblur={clearActive}
            onkeydown={(e) => markKey(e, '.sv-grid-chart-radar-dot', ri)} />
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
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
        <rect
          class="sv-grid-chart-calendar-cell"
          class:is-blank={!cell.defined}
          x={cell.x + 1} y={cell.y + 1}
          width={cell.size - 2} height={cell.size - 2}
          fill={cell.defined ? cell.color : 'transparent'}
          rx="2"
          role="img"
          tabindex={roveTab('.sv-grid-chart-calendar-cell', ci)}
          aria-label={`${calendarDay(cell.date)}: ${cell.defined ? fmt(cell.value) : t.noValue}`}
          onmousemove={(e) => cell.defined && showTip(e.clientX, e.clientY, calendarDay(cell.date), [{ color: cell.color, value: fmt(cell.value) }])}
          onmouseleave={clearActive}
          onfocus={(e) => { onMarkFocus('.sv-grid-chart-calendar-cell', ci); if (cell.defined) { const p = box(e.currentTarget); showTip(p.x, p.y, calendarDay(cell.date), [{ color: cell.color, value: fmt(cell.value) }]) } }}
          onblur={clearActive}
          onkeydown={(e) => markKey(e, '.sv-grid-chart-calendar-cell', ci, null, { cols: 7, colMajor: true })}
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
      <!-- Pointer needle + center hub. Deliberately NOT the value colour: the
           needle used to be filled with the same colour as the arc it sits on
           top of, so on a nearly-full dial it disappeared into it. An
           instrument pointer reads against the face, whatever the face is. -->
      <path class="sv-grid-chart-gauge-needle" d={g.needle.path} />
      <circle class="sv-grid-chart-gauge-hub" cx={g.cx} cy={g.cy} r={g.needle.hubR} />
      <circle class="sv-grid-chart-gauge-hub-dot" cx={g.cx} cy={g.cy} r="2.5" />
      <!-- Scale end labels + center readout. -->
      <text class="sv-grid-chart-axis" x={g.minLabel.x} y={g.minLabel.y} text-anchor="middle">{fmt(g.min)}</text>
      <text class="sv-grid-chart-axis" x={g.maxLabel.x} y={g.maxLabel.y} text-anchor="middle">{fmt(g.max)}</text>
      <!-- A symbol unit hugs the number (99.2%, 21°C); a word unit takes a space (480 ms). -->
      <text class="sv-grid-chart-gauge-value" x={g.cx} y={g.cy + 38} text-anchor="middle">{fmt(g.value)}{g.unit ? (/^[%°′″]/.test(g.unit) ? g.unit : ` ${g.unit}`) : ''}</text>
    {/if}

    {#if isTreemap}
      {#each geo.treemapCells as cell, ti (ti)}
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
        <rect
          class="sv-grid-chart-treemap-cell"
          x={cell.x} y={cell.y} width={cell.w} height={cell.h}
          fill={cell.color}
          role={onSelect || selMode || canDrill ? 'button' : 'img'}
          tabindex={roveTab('.sv-grid-chart-treemap-cell', ti)}
          aria-label={`${cell.name}: ${fmt(cell.value)}`}
          onmousemove={(e) => showTip(e.clientX, e.clientY, cell.name, [{ color: cell.color, value: fmt(cell.value) }])}
          onmouseleave={clearActive}
          onfocus={(e) => { onMarkFocus('.sv-grid-chart-treemap-cell', ti); const p = box(e.currentTarget); showTip(p.x, p.y, cell.name, [{ color: cell.color, value: fmt(cell.value) }]) }}
          onblur={clearActive}
          onclick={(e) => { if (canDrill && drillInto([...drillPath, ...(pathTo(drilledRoot!, cell.name) ?? [])])) return; select(cell.name, '', cell.value, undefined, e) }}
          onkeydown={(e) => markKey(e, '.sv-grid-chart-treemap-cell', ti, () => { if (canDrill && drillInto([...drillPath, ...(pathTo(drilledRoot!, cell.name) ?? [])])) return; if (onSelect || selMode) select(cell.name, '', cell.value, undefined, e) })}
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
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
        <path
          class="sv-grid-chart-sankey-link"
          d={link.path}
          fill="none"
          stroke={link.color}
          stroke-width={link.width}
          stroke-opacity="0.35"
          role="img"
          tabindex={roveTab('.sv-grid-chart-sankey-link', li)}
          aria-label={`${link.source} → ${link.target}: ${fmt(link.value)}`}
          onmousemove={(e) => showTip(e.clientX, e.clientY, `${link.source} → ${link.target}`, [{ color: link.color, value: fmt(link.value) }])}
          onmouseleave={clearActive}
          onfocus={(e) => { onMarkFocus('.sv-grid-chart-sankey-link', li); const p = box(e.currentTarget); showTip(p.x, p.y, `${link.source} → ${link.target}`, [{ color: link.color, value: fmt(link.value) }]) }}
          onblur={clearActive}
          onkeydown={(e) => markKey(e, '.sv-grid-chart-sankey-link', li)}
        />
      {/each}
      <!-- Node rectangles + labels. -->
      {#each geo.sankeyNodes as node, ni (ni)}
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
        <rect
          class="sv-grid-chart-sankey-node"
          x={node.x} y={node.y} width={node.w} height={node.h}
          fill={node.color}
          role="img"
          tabindex={roveTab('.sv-grid-chart-sankey-node', ni)}
          aria-label={msg(t.sankeyNode, { label: node.label, in: fmt(node.totalIn), out: fmt(node.totalOut) })}
          onmousemove={(e) => showTip(e.clientX, e.clientY, node.label, [
            { label: 'in',  value: fmt(node.totalIn) },
            { label: 'out', value: fmt(node.totalOut) },
          ])}
          onmouseleave={clearActive}
          onfocus={(e) => { onMarkFocus('.sv-grid-chart-sankey-node', ni); const p = box(e.currentTarget); showTip(p.x, p.y, node.label, [
            { label: 'in',  value: fmt(node.totalIn) },
            { label: 'out', value: fmt(node.totalOut) },
          ]) }}
          onblur={clearActive}
          onkeydown={(e) => markKey(e, '.sv-grid-chart-sankey-node', ni)}
        />
        <text class="sv-grid-chart-sankey-label"
          x={node.column === 0 ? node.x + node.w + 4 : node.x - 4}
          y={node.y + node.h / 2 + 3}
          text-anchor={node.column === 0 ? 'start' : 'end'}>{node.label}</text>
      {/each}
    {/if}

    {#if isArcs}
      <!-- Polar axis for radial columns / nightingale: faint rings at the
           nice ticks and a category label at each slot's outer edge. -->
      {#if geo.radarCenter && geo.polarRings.length}
        {#each geo.polarRings as pr, pri (pri)}
          <circle class="sv-grid-chart-gridline" cx={geo.radarCenter.cx} cy={geo.radarCenter.cy} r={pr} fill="none" />
        {/each}
      {/if}
      {#each geo.polarAxes as ax, axi (axi)}
        <text class="sv-grid-chart-axis" x={ax.x} y={ax.y + 3} text-anchor={ax.x < (geo.radarCenter?.cx ?? 0) - 2 ? 'end' : ax.x > (geo.radarCenter?.cx ?? 0) + 2 ? 'start' : 'middle'}>{truncate(ax.label, 14)}</text>
      {/each}
      {#each geo.arcs as arc, ai (ai)}
        {#if arc.trackPath}
          <path class="sv-grid-chart-arc-track" d={arc.trackPath} />
        {/if}
      {/each}
      {#each geo.chordRibbons as rb, rbi (rbi)}
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events -->
        <path
          class="sv-grid-chart-ribbon"
          d={rb.path}
          fill={rb.color}
          fill-opacity="0.45"
          stroke={rb.color}
          stroke-opacity="0.6"
          style={`opacity:${dimOf(rb.source) === 1 && dimOf(rb.target) === 1 ? 1 : 0.18}`}
          onmousemove={(e) => hoverRibbon(e.clientX, e.clientY, rb)}
          onmouseleave={clearActive}
        />
      {/each}
      {#each geo.arcs as arc, ai (ai)}
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
        <path
          class="sv-grid-chart-arc"
          class:is-selected={isSel(arc.label, arc.series)}
          class:is-drillable={canDrill && !!arc.nodePath && !!drillTree(drillRoot!, arc.nodePath)?.children?.length}
          d={arc.path}
          fill={arc.color}
          stroke="var(--sg-bg, #fff)"
          stroke-width="1"
          style={`opacity:${dimOf(arcsByCategory || spec.type === 'sunburst' || spec.type === 'chord' ? arc.label : arc.series)}`}
          role={onSelect || selMode || (canDrill && !!arc.nodePath) ? 'button' : 'img'}
          tabindex={roveTab('.sv-grid-chart-arc', ai)}
          aria-label={`${arc.nodePath ? arc.nodePath.join(' / ') : arc.label}${arc.series ? ` ${arc.series}` : ''}: ${fmt(arc.value)}`}
          onmousemove={(e) => hoverArc(e.clientX, e.clientY, arc)}
          onmouseleave={clearActive}
          onfocus={(e) => { onMarkFocus('.sv-grid-chart-arc', ai); const p = box(e.currentTarget); hoverArc(p.x, p.y, arc) }}
          onblur={clearActive}
          onclick={(e) => { if (arc.nodePath && drillInto(arc.nodePath)) return; select(arc.label, arc.series, arc.value, undefined, e) }}
          onkeydown={(e) => markKey(e, '.sv-grid-chart-arc', ai, () => { if (arc.nodePath && drillInto(arc.nodePath)) return; if (onSelect || selMode) select(arc.label, arc.series, arc.value, undefined, e) })}
        />
      {/each}
      <!-- Labels: chord groups sit outside the ring; sunburst nodes and data
           labels sit on the arcs wide enough to hold them. -->
      {#each geo.arcs as arc, ai (ai)}
        {#if spec.type === 'chord'}
          {#if arc.a1 - arc.a0 > 0.12 && spec.xAxis?.labels !== false}
            <text class="sv-grid-chart-axis" x={arc.lx} y={arc.ly + 3} text-anchor={arc.lx < arc.cx - 2 ? 'end' : arc.lx > arc.cx + 2 ? 'start' : 'middle'}>{truncate(arc.label, 14)}</text>
          {/if}
        {:else if (arc.a1 - arc.a0) * (arc.r0 + arc.r1) / 2 > 34 && arc.r1 - arc.r0 > 12 && (spec.type === 'sunburst' || labelCfg.show)}
          <text class="sv-grid-chart-datalabel on-bar" x={arc.lx} y={arc.ly} text-anchor="middle" dominant-baseline="middle" fill={arc.textColor} pointer-events="none">{truncate(labelCfg.show && spec.type !== 'sunburst' ? fmt(arc.value) : arc.label, 12)}</text>
        {/if}
      {/each}
    {/if}

    {#if isBullet}
      {#each geo.bullets as b, bli (bli)}
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events -->
        <g class="sv-grid-chart-bullet" onmousemove={(e) => hoverBullet(e.clientX, e.clientY, b)} onmouseleave={clearActive}>
          {#each b.ranges as rg, rgi (rgi)}
            <rect x={rg.x} y={b.y} width={rg.w} height={b.h} fill={rg.color} />
          {/each}
          <rect class="sv-grid-chart-bar" x={b.x} y={b.y + b.h * 0.3} width={b.measureW} height={b.h * 0.4} fill={b.color} />
          {#if b.targetX != null}
            <line class="sv-grid-chart-bullet-target" x1={b.targetX} y1={b.y + b.h * 0.15} x2={b.targetX} y2={b.y + b.h * 0.85} stroke="var(--sg-fg, #0f172a)" stroke-width="2.5" />
          {/if}
        </g>
      {/each}
    {/if}

    {#each geo.slices as slice, si (si)}
      <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
      <path
        class="sv-grid-chart-slice"
        class:is-selected={isSel(slice.label, slice.label)}
        class:is-drillable={sliceDrillable(slice.label)}
        d={slice.path}
        fill={slice.color}
        style={`opacity:${selDim(slice.label, slice.label)}`}
        stroke="var(--sg-bg, #fff)"
        stroke-width="1"
        role={onSelect || selMode || sliceDrillable(slice.label) ? 'button' : 'img'}
        tabindex={roveTab('.sv-grid-chart-slice', si)}
        aria-label={`${slice.label}: ${fmt(slice.value)}, ${slice.percent.toFixed(1)}%${sliceDrillable(slice.label) ? t.drillIn : ''}`}
        onmousemove={(e) => hoverSlice(e.clientX, e.clientY, slice.label, slice.value, slice.percent)}
        onmouseleave={clearActive}
        onfocus={(e) => { onMarkFocus('.sv-grid-chart-slice', si); const p = box(e.currentTarget); hoverSlice(p.x, p.y, slice.label, slice.value, slice.percent) }}
        onblur={clearActive}
        onclick={(e) => { if (sliceDrillable(slice.label) && drillInto([...drillPath, slice.label])) return; select(slice.label, slice.label, slice.value, si, e) }}
        onkeydown={(e) => { if (menuKey(e, si)) return; markKey(e, '.sv-grid-chart-slice', si, () => { if (sliceDrillable(slice.label) && drillInto([...drillPath, slice.label])) return; if (onSelect || selMode) select(slice.label, slice.label, slice.value, si, e) }) }}
      />
      {#if slice.callout}
        <polyline class="sv-grid-chart-callout" points={`${slice.callout.x1},${slice.callout.y1} ${slice.callout.x2},${slice.callout.y2} ${slice.callout.x3},${slice.callout.y2}`} fill="none" stroke={slice.color} stroke-width="1" />
        <text class="sv-grid-chart-callout-label" x={slice.callout.tx} y={slice.callout.ty + 3.5} text-anchor={slice.callout.anchor}>{labelCfg.formatter ? labelCfg.formatter(slice.value, { category: slice.label, series: slice.label }) : `${truncate(slice.label, Math.min(18, slice.callout.maxChars))} ${slice.percent.toFixed(0)}%`}</text>
      {:else if labelCfg.show && labelCfg.placement !== 'outside' && slice.percent >= 6}
        <text class="sv-grid-chart-datalabel on-bar" x={slice.cx} y={slice.cy} text-anchor="middle" dominant-baseline="middle">{slice.percent.toFixed(0)}%</text>
      {/if}
    {/each}

    {#if geo.donut}
      <text class="sv-grid-chart-donut-total" x={geo.donut.cx} y={geo.donut.cy - 4} text-anchor="middle">{fmt(geo.donut.total)}</text>
      <text class="sv-grid-chart-donut-label" x={geo.donut.cx} y={geo.donut.cy + 11} text-anchor="middle">{t.total}</text>
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
          aria-label={msg(t.densePoints, { count: windowCount, from: visibleSpec.categories[0] ?? '', to: visibleSpec.categories[visibleSpec.categories.length - 1] ?? '' })}
          onmousemove={(e) => {
            const i = catAtClientX(e.clientX, e.currentTarget)
            if (i != null) { denseIndex = i; hoverCat(e.clientX, e.clientY, i) }
          }}
          onmouseleave={clearActive}
          onfocus={(e) => focusCat(e.currentTarget, denseIndex)}
          onblur={clearActive}
          onclick={(e) => catClick(e, denseIndex)}
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
          onmousemove={(e) => hoverCat(e.clientX, e.clientY, i, e.currentTarget)}
          onmouseleave={clearActive}
          onfocus={(e) => focusCat(e.currentTarget, i)}
          onblur={clearActive}
          onclick={(e) => catClick(e, i)}
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
    <!-- The div exists to be measured: an inline svg reports clientHeight 0 in
         Chromium, and autosize needs the brush's real height to subtract. -->
    <div class="sv-grid-chart-brush-host" bind:clientHeight={brushH}>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
    <svg
      class="sv-grid-chart-brush"
      viewBox={`0 0 ${brushGeo.width} ${brushGeo.height}`}
      width="100%"
      role="slider"
      tabindex="0"
      aria-label={t.rangeBrush}
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={Math.max(0, spec.categories.length - 1)}
      aria-valuenow={zoom?.i0 ?? 0}
      aria-valuetext={msg(t.brushRange, { from: spec.categories[zoom?.i0 ?? 0] ?? '', to: spec.categories[zoom?.i1 ?? spec.categories.length - 1] ?? '' })}
      onpointermove={onBrushMove}
      onkeydown={onBrushKey}
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
    </div>
  {/if}

  {#if isEmpty}
    <div class="sv-grid-chart-empty">{t.noData}</div>
  {/if}

  {#if menu && MenuComp}
    <MenuComp items={menuItems} x={menu.x} y={menu.y} onClose={() => (menu = null)} />
  {/if}

  {#if textDraft}
    <input
      class="sv-grid-chart-textdraft"
      type="text"
      placeholder={t.noteText}
      aria-label={t.noteText}
      style={`left:${textDraft.left}px; top:${textDraft.top}px;`}
      bind:value={textDraftValue}
      use:focusOnMount
      onkeydown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commitTextDraft() }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); textDraft = null; textDraftValue = '' }
      }}
      onblur={commitTextDraft}
    />
  {/if}

  {#if tip}
    <div
      class="sv-grid-chart-tooltip"
      role="tooltip"
      class:is-below={tip.below}
      class:is-custom={!!tooltip}
      class:is-fixed={tip.fixed}
      class:is-right={tooltipPosition === 'top-right' || tooltipPosition === 'bottom-right'}
      class:is-bottom={tooltipPosition === 'bottom-left' || tooltipPosition === 'bottom-right'}
      class:is-pinned={!!pinnedTip}
      style={`left:${tip.left}px; top:${tip.top}px;`}
    >
      {#if tooltip}
        {@render tooltip(tip.ctx)}
      {:else}
        <span class="sv-grid-chart-tooltip-title">{tip.title}</span>
        {#each tip.rows as r, ri (ri)}
          <span class="sv-grid-chart-tooltip-row">
            {#if r.color}<span class="sv-grid-chart-tooltip-dot" style={`background:${r.color}`}></span>{/if}
            {#if r.label}<span class="sv-grid-chart-tooltip-row-label">{r.label}</span>{/if}
            <span class="sv-grid-chart-tooltip-row-value">{r.value}</span>
          </span>
        {/each}
      {/if}
    </div>
  {/if}

  {#if legendPos && legendItems.length}
    <div
      class="sv-grid-chart-legend"
      class:is-vertical={legendSide}
      bind:clientWidth={legendW}
      bind:clientHeight={legendH}
    >
      {#each shownLegend as item, index (item.label)}
        <button
          type="button"
          class="sv-grid-chart-legend-item"
          class:is-off={item.off}
          class:is-isolated={isolated === item.label}
          disabled={!interactive || !legendToggles}
          aria-pressed={legendToggles ? !item.off : undefined}
          onclick={() => toggle(item.label)}
          ondblclick={() => isolate(item.label)}
          onpointerenter={() => interactive && (dimmed = item.label)}
          onpointerleave={() => (dimmed = null)}
          title={interactive ? `${item.off ? t.showSeries : t.hideSeries} ${item.label} \u00b7 ${t.isolateHint}` : item.label}
        >
          {#if legendItem}
            {@render legendItem({ label: item.label, color: item.color, off: item.off, index })}
          {:else}
            <span class="sv-grid-chart-swatch" style={`background:${item.off ? 'transparent' : item.color}; border-color:${item.color}`}></span>
            {item.label}
          {/if}
        </button>
      {/each}
      {#if legendOverflow}
        <button type="button" class="sv-grid-chart-legend-more" onclick={() => (legendExpanded = !legendExpanded)}>
          {legendExpanded ? t.showLess : msg(t.showMore, { n: legendItems.length - LEGEND_MAX })}
        </button>
      {/if}
    </div>
  {/if}

  {#if announce}
    <div class="sv-grid-chart-live sv-grid-chart-sr-only" aria-live="polite" aria-atomic="true">{liveText}</div>
  {/if}

  <!-- Visually-hidden data table: the same data for assistive technology.
       Capped, and the caption says so. A table with 100k rows is not an
       accessible version of anything - nobody traverses that with a screen
       reader, and rendering it was a third of the DOM cost of a large chart.
       Saying "first 1000 of 100000" is more use than silently truncating, and
       more honest than pretending the whole set is readable here.

       The visually-hidden recipe sits on a wrapping div, not on the table:
       on a table element `height: 1px` and `width: 1px` are minimums (a table
       is never smaller than its cells) and `overflow: hidden` does not clip
       it, so a 1000-row table stood 17,000px tall, invisible but real, and
       every scroll container around a chart gained that much empty space
       to scroll through. -->
  <div class="sv-grid-chart-sr-only">
  <table id={`${uid}-table`}>
    <caption>
      {msg(t.dataTable, { type: spec.type })}{#if srCapped}{msg(t.dataTableCapped, { shown: SR_ROW_CAP, total: srTable.rows.length })}{/if}{#if describe && summary}. {summary}{/if}
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
</div>

<style>
  .sv-grid-chart {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    background: var(--sg-chart-bg, transparent);
  }
  /* Legend on top: the legend row moves above the plot, the toolbar stays
     first. Left / right: a two-column grid, the legend a column of chips
     beside the plot and the brush, the toolbar spanning both. */
  .sv-grid-chart.is-legend-top .sv-grid-chart-toolbar { order: -2; }
  .sv-grid-chart.is-legend-top .sv-grid-chart-legend { order: -1; }
  .sv-grid-chart.is-legend-left,
  .sv-grid-chart.is-legend-right {
    display: grid;
    grid-template-rows: auto 1fr auto;
    align-items: start;
  }
  .sv-grid-chart.is-legend-left {
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas: 'tb tb' 'lg svg' 'lg br';
  }
  .sv-grid-chart.is-legend-right {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: 'tb tb' 'svg lg' 'br lg';
  }
  .sv-grid-chart.is-legend-left .sv-grid-chart-toolbar,
  .sv-grid-chart.is-legend-right .sv-grid-chart-toolbar { grid-area: tb; }
  .sv-grid-chart.is-legend-left .sv-grid-chart-svg,
  .sv-grid-chart.is-legend-right .sv-grid-chart-svg { grid-area: svg; }
  .sv-grid-chart.is-legend-left .sv-grid-chart-brush-host,
  .sv-grid-chart.is-legend-right .sv-grid-chart-brush-host { grid-area: br; }
  .sv-grid-chart-brush-host {
    display: block;
    min-width: 0;
  }
  .sv-grid-chart.is-legend-left .sv-grid-chart-legend,
  .sv-grid-chart.is-legend-right .sv-grid-chart-legend { grid-area: lg; }
  .sv-grid-chart-legend.is-vertical {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    max-width: 180px;
    padding-top: 6px;
  }
  /* Autosize: the SVG is laid out at the pixel size the host actually has
     (see the dimension bindings in the script), so it needs no aspect-ratio
     scaling of its own. The host takes its height from a flex or grid parent
     that stretches it, never from a percentage: `height: 100%` inside a parent
     with other content over-measures by that content, the SVG grows into the
     gap, and the next measurement grows again, without end. */
  .sv-grid-chart.is-autosize {
    min-height: 0;
  }
  .sv-grid-chart.is-autosize .sv-grid-chart-svg {
    flex: none;
    min-height: 0;
  }
  .sv-grid-chart-svg {
    display: block;
    width: 100%;
    height: auto;
  }
  .sv-grid-chart-title {
    fill: var(--sg-fg, #0f172a);
    font-size: calc(14px * var(--sg-chart-font-scale, 1));
    font-weight: 600;
    font-family: inherit;
  }
  .sv-grid-chart-subtitle {
    fill: var(--sg-muted, #64748b);
    font-size: calc(11.5px * var(--sg-chart-font-scale, 1));
    font-family: inherit;
  }
  .sv-grid-chart-caption {
    fill: var(--sg-muted, #64748b);
    font-size: calc(10px * var(--sg-chart-font-scale, 1));
    font-family: inherit;
  }
  .sv-grid-chart-refband {
    pointer-events: none;
  }
  /* Enter effects. Fade is the per-mark keyframe every mark already has;
     wipe animates the plot clip's width from 0 (a keyframe with only `from`
     ends at the element's own value); grow scales bars up from their base. */
  .sv-grid-chart-wipe {
    animation: sv-grid-chart-wipe 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }
  @keyframes sv-grid-chart-wipe {
    from { width: 0; }
  }
  .sv-grid-chart-marks.is-enter-grow .sv-grid-chart-bar {
    transform-box: fill-box;
    transform-origin: 50% 100%;
    animation: sv-grid-chart-grow 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }
  @keyframes sv-grid-chart-grow {
    from { transform: scaleY(0.02); }
  }
  .sv-grid-chart-marks.is-enter-none *,
  .sv-grid-chart-marks.is-enter-none {
    animation: none !important;
  }
  .sv-grid-chart-svg.is-pannable {
    cursor: grab;
  }
  .sv-grid-chart-svg.is-pannable:active {
    cursor: grabbing;
  }
  .sv-grid-chart-presets {
    display: inline-flex;
    gap: 2px;
    margin-right: 6px;
  }
  .sv-grid-chart-crumbs {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    margin-right: 8px;
    font-size: calc(11.5px * var(--sg-chart-font-scale, 1));
  }
  .sv-grid-chart-crumb.is-current {
    font-weight: 600;
    color: var(--sg-fg, #0f172a);
    padding: 0 4px;
  }
  .sv-grid-chart-crumb-sep {
    color: var(--sg-muted, #64748b);
  }
  .sv-grid-chart-arc.is-drillable,
  .sv-grid-chart-slice.is-drillable {
    cursor: zoom-in;
  }
  .sv-grid-chart-bar.is-selected,
  .sv-grid-chart-slice.is-selected,
  .sv-grid-chart-arc.is-selected {
    stroke: var(--sg-fg, #0f172a);
    stroke-width: 2;
  }
  .sv-grid-chart-dot.is-selected {
    stroke: var(--sg-fg, #0f172a);
    stroke-width: 2;
    r: 5;
  }
  .sv-grid-chart-scatter.is-selected {
    stroke: var(--sg-fg, #0f172a);
    stroke-width: 2;
    fill-opacity: 1;
  }
  .sv-grid-chart-preset {
    padding-inline: 6px;
  }
  .sv-grid-chart-arc-track {
    fill: var(--sg-border, #e2e8f0);
    opacity: 0.45;
    pointer-events: none;
  }
  .sv-grid-chart-arc {
    transition: opacity 0.1s ease;
    animation: sv-grid-chart-in 0.3s ease both;
  }
  .sv-grid-chart-ribbon {
    transition: opacity 0.1s ease;
  }
  .sv-grid-chart-stem line {
    stroke-linecap: round;
  }
  .sv-grid-chart-dot.is-stroked {
    fill: none;
  }
  .sv-grid-chart-tooltip.is-custom {
    padding: 0;
    background: transparent;
    color: inherit;
    border: 0;
    box-shadow: none;
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
    font-size: calc(10px * var(--sg-chart-font-scale, 1));
    font-family: inherit;
  }
  .sv-grid-chart-axis-title {
    fill: var(--sg-muted, #64748b);
    font-size: calc(11px * var(--sg-chart-font-scale, 1));
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
  .sv-grid-chart-callout {
    opacity: 0.8;
    pointer-events: none;
  }
  .sv-grid-chart-callout-label {
    font-size: calc(10.5px * var(--sg-chart-font-scale, 1));
    font-family: inherit;
    fill: var(--sg-fg, #0f172a);
    pointer-events: none;
  }
  .sv-grid-chart-crosshair-label rect {
    fill: var(--sg-fg, #0f172a);
    opacity: 0.85;
  }
  .sv-grid-chart-crosshair-label text {
    fill: var(--sg-bg, #fff);
    font-size: calc(9.5px * var(--sg-chart-font-scale, 1));
    font-weight: 600;
    font-family: inherit;
  }
  .sv-grid-chart-refline {
    stroke-width: 1.5;
    opacity: 0.9;
    pointer-events: none;
  }
  .sv-grid-chart-reflabel {
    font-size: calc(9.5px * var(--sg-chart-font-scale, 1));
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
  .sv-grid-chart-annotation-marker.has-text {
    pointer-events: auto;
    cursor: help;
  }
  .sv-grid-chart-annotation-marker:focus-visible {
    outline: 2px solid var(--sg-accent, #2563eb);
    outline-offset: 2px;
  }
  .sv-grid-chart-annotation-label {
    font-size: calc(10px * var(--sg-chart-font-scale, 1));
    font-weight: 700;
    font-family: inherit;
    pointer-events: none;
  }
  .sv-grid-chart-serieslabel {
    font-size: calc(10.5px * var(--sg-chart-font-scale, 1));
    font-weight: 600;
    font-family: inherit;
    pointer-events: none;
  }
  .sv-grid-chart-annotation-flagtext {
    font-size: calc(9px * var(--sg-chart-font-scale, 1));
    font-weight: 700;
    font-family: inherit;
    pointer-events: none;
  }
  .sv-grid-chart-refpill text {
    font-size: calc(9.5px * var(--sg-chart-font-scale, 1));
    font-weight: 700;
    font-family: inherit;
    pointer-events: none;
  }
  /* Drawings. The hit line is a fat invisible stroke so a 1.5px trend line
     can be clicked; handles only exist on the selected drawing. */
  .sv-grid-chart-drawing-hit {
    stroke: transparent;
    stroke-width: 10;
    fill: transparent;
    pointer-events: stroke;
  }
  .sv-grid-chart-drawing.is-fib .sv-grid-chart-drawing-hit,
  .sv-grid-chart-drawing.is-rect rect,
  .sv-grid-chart-drawing.is-text text {
    pointer-events: all;
  }
  .sv-grid-chart-drawing[role='button'] { cursor: pointer; }
  .sv-grid-chart-drawing:focus-visible { outline: none; }
  .sv-grid-chart-drawing.is-selected line,
  .sv-grid-chart-drawing.is-selected rect,
  .sv-grid-chart-drawing:focus-visible line,
  .sv-grid-chart-drawing:focus-visible rect {
    filter: drop-shadow(0 0 2px var(--sg-accent, #2563eb));
  }
  .sv-grid-chart-drawing-label {
    font-size: calc(9px * var(--sg-chart-font-scale, 1));
    font-weight: 600;
    font-family: inherit;
    pointer-events: none;
  }
  .sv-grid-chart-drawing-text {
    font-size: calc(11px * var(--sg-chart-font-scale, 1));
    font-weight: 600;
    font-family: inherit;
  }
  .sv-grid-chart-drawing-handle { cursor: move; }
  .sv-grid-chart-textdraft {
    position: absolute;
    z-index: 11;
    transform: translate(0, -50%);
    width: 160px;
    font: inherit;
    font-size: calc(12px * var(--sg-chart-font-scale, 1));
    padding: 3px 6px;
    border: 1px solid var(--sg-accent, #2563eb);
    border-radius: 4px;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  .sv-grid-chart-svg.is-drawing { cursor: crosshair; }
  .sv-grid-chart-drawtools {
    display: inline-flex;
    gap: 2px;
    padding-right: 6px;
    margin-right: 2px;
    border-right: 1px solid var(--sg-border, #e2e8f0);
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
    font-size: calc(10px * var(--sg-chart-font-scale, 1));
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
    font-size: calc(11px * var(--sg-chart-font-scale, 1));
    font-weight: 700;
    font-family: inherit;
    pointer-events: none;
  }
  .sv-grid-chart-funnel-value {
    font-size: calc(10px * var(--sg-chart-font-scale, 1));
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
    font-size: calc(22px * var(--sg-chart-font-scale, 1));
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
    fill: var(--sg-fg, #0f172a);
    /* A hairline of the background colour around the needle keeps it legible
       where it crosses the value arc, which is the same weight and often a
       similar tone. */
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
    font-size: calc(11px * var(--sg-chart-font-scale, 1));
    font-weight: 600;
    font-family: inherit;
    pointer-events: none;
  }
  .sv-grid-chart-treemap-value {
    font-size: calc(10px * var(--sg-chart-font-scale, 1));
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
    font-size: calc(11px * var(--sg-chart-font-scale, 1));
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
  .sv-grid-chart-slice:focus-visible,
  .sv-grid-chart-arc:focus-visible,
  .sv-grid-chart-heatcell:focus-visible,
  .sv-grid-chart-funnel-seg:focus-visible,
  .sv-grid-chart-treemap-cell:focus-visible,
  .sv-grid-chart-sankey-node:focus-visible,
  .sv-grid-chart-sankey-link:focus-visible,
  .sv-grid-chart-calendar-cell:focus-visible,
  .sv-grid-chart-radar-dot:focus-visible,
  .sv-grid-chart-scatter:focus-visible,
  .sv-grid-chart-brush:focus-visible {
    outline: 2px solid var(--sg-accent, #2563eb);
    outline-offset: 1px;
  }
  .sv-grid-chart-datalabel {
    fill: var(--sg-fg, #0f172a);
    font-size: calc(9.5px * var(--sg-chart-font-scale, 1));
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    pointer-events: none;
  }
  .sv-grid-chart-datalabel-leader {
    stroke: var(--sg-muted, #64748b);
    stroke-width: 1;
    pointer-events: none;
  }
  .sv-grid-chart-datalabel.on-bar {
    fill: #fff;
  }
  .sv-grid-chart-donut-total {
    fill: var(--sg-fg, #0f172a);
    font-size: calc(16px * var(--sg-chart-font-scale, 1));
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .sv-grid-chart-donut-label {
    fill: var(--sg-muted, #64748b);
    font-size: calc(10px * var(--sg-chart-font-scale, 1));
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
    font-size: calc(13px * var(--sg-chart-font-scale, 1));
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
    font-size: calc(11px * var(--sg-chart-font-scale, 1));
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

  /* Annotate mode: the toggle reads as pressed, the plot as a target, and a
     marker as something you can click to take away. */
  .sv-grid-chart-tool.is-on {
    background: var(--sg-accent, #2563eb);
    border-color: var(--sg-accent, #2563eb);
    color: var(--sg-on-accent, #fff);
  }
  .sv-grid-chart-svg.is-annotating { cursor: copy; }
  .sv-grid-chart-annotation-marker.is-removable { cursor: pointer; }

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
    font-size: calc(11.5px * var(--sg-chart-font-scale, 1));
    line-height: 1.4;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .sv-grid-chart-tooltip.is-below {
    transform: translate(-50%, 16px);
  }
  /* A corner tooltip anchors its own corner to the plot's, no flipping. */
  .sv-grid-chart-tooltip.is-fixed {
    transform: none;
  }
  .sv-grid-chart-tooltip.is-fixed.is-right {
    transform: translate(-100%, 0);
  }
  .sv-grid-chart-tooltip.is-fixed.is-bottom {
    transform: translate(0, -100%);
  }
  .sv-grid-chart-tooltip.is-fixed.is-right.is-bottom {
    transform: translate(-100%, -100%);
  }
  /* Pinned: selectable text, and a ring so a reader sees it is held. */
  .sv-grid-chart-tooltip.is-pinned {
    pointer-events: auto;
    user-select: text;
    box-shadow: 0 0 0 2px var(--sg-accent, #2563eb), 0 6px 18px rgba(0, 0, 0, 0.28);
  }
  .sv-grid-chart-tooltip-title {
    opacity: 0.75;
    font-size: calc(10.5px * var(--sg-chart-font-scale, 1));
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
    font-size: calc(12px * var(--sg-chart-font-scale, 1));
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
    font-size: calc(11px * var(--sg-chart-font-scale, 1));
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

  /* Enter animation. Marks fade in when they are first created; the position
     transitions above then handle everything after that, so a chart appears
     smoothly and moves smoothly rather than popping into place and then
     animating.

     A fade rather than the wipe you would normally reach for. A wipe needs a
     clip-path over all the marks, and the marks here are direct children of the
     <svg> - grouping them is a large edit across every chart type, for a nicer
     version of something already pleasant. Noted rather than done.

     `both` matters: it holds the from-state before the animation starts, so a
     mark cannot flash at full opacity for a frame first. It also means that
     when `animation: none` applies below, the rule stops applying entirely and
     the mark is simply painted - not stuck invisible. */
  @keyframes sv-grid-chart-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .sv-grid-chart-bar,
  .sv-grid-chart-linepath,
  .sv-grid-chart-area,
  .sv-grid-chart-slice,
  .sv-grid-chart-candle,
  .sv-grid-chart-box,
  .sv-grid-chart-funnel-seg,
  .sv-grid-chart-heatcell,
  .sv-grid-chart-treemap-cell {
    animation: sv-grid-chart-in 0.3s ease-out both;
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
    .sv-grid-chart-bar,
    .sv-grid-chart-linepath,
    .sv-grid-chart-area,
    .sv-grid-chart-slice,
    .sv-grid-chart-candle,
    .sv-grid-chart-box,
    .sv-grid-chart-funnel-seg,
    .sv-grid-chart-heatcell,
    .sv-grid-chart-treemap-cell {
      animation: none;
    }
  }

  /* ---- Forced colors (Windows High Contrast) ---------------------------
     The UA forces fill and stroke along with color and background, which
     would paint every series the same. Colour carries the data, so the
     marks keep theirs (forced-color-adjust: none, the one case the spec
     allows it for). Everything that is chrome rather than data takes the
     system palette instead: text, gridlines, the crosshair and its pills,
     focus rings, the legend's swatches and the tooltip. */
  @media (forced-colors: active) {
    .sv-grid-chart-svg,
    .sv-grid-chart-brush,
    .sv-grid-chart-swatch {
      forced-color-adjust: none;
    }
    .sv-grid-chart-axis,
    .sv-grid-chart-axis-title,
    .sv-grid-chart-title,
    .sv-grid-chart-subtitle,
    .sv-grid-chart-caption,
    .sv-grid-chart-datalabel,
    .sv-grid-chart-callout-label,
    .sv-grid-chart-donut-total,
    .sv-grid-chart-donut-label,
    .sv-grid-chart-sankey-label,
    .sv-grid-chart-annotation-label {
      fill: CanvasText;
    }
    .sv-grid-chart-gridline {
      stroke: GrayText;
      opacity: 1;
    }
    .sv-grid-chart-crosshair {
      stroke: Highlight;
      opacity: 1;
    }
    .sv-grid-chart-crosshair-label rect,
    .sv-grid-chart-refpill rect {
      fill: Highlight;
      opacity: 1;
    }
    .sv-grid-chart-crosshair-label text,
    .sv-grid-chart-refpill text {
      fill: HighlightText;
    }
    .sv-grid-chart-cat-hit:focus-visible,
    .sv-grid-chart-slice:focus-visible,
    .sv-grid-chart-arc:focus-visible,
    .sv-grid-chart-heatcell:focus-visible,
    .sv-grid-chart-funnel-seg:focus-visible,
    .sv-grid-chart-treemap-cell:focus-visible,
    .sv-grid-chart-sankey-node:focus-visible,
    .sv-grid-chart-sankey-link:focus-visible,
    .sv-grid-chart-calendar-cell:focus-visible,
    .sv-grid-chart-radar-dot:focus-visible,
    .sv-grid-chart-scatter:focus-visible,
    .sv-grid-chart-brush:focus-visible,
    .sv-grid-chart-annotation-marker:focus-visible {
      outline: 3px solid Highlight;
    }
    .sv-grid-chart-slice.is-selected,
    .sv-grid-chart-arc.is-selected {
      stroke: Highlight;
      stroke-width: 3;
    }
    .sv-grid-chart-brush-mask {
      fill: Canvas;
      fill-opacity: 0.7;
    }
    .sv-grid-chart-brush-window {
      stroke: Highlight;
      fill: Highlight;
      fill-opacity: 0.2;
    }
    .sv-grid-chart-brush-handle {
      fill: Highlight;
    }
    .sv-grid-chart-tooltip {
      border: 1px solid CanvasText;
    }
    .sv-grid-chart-legend-item.is-off .sv-grid-chart-swatch {
      forced-color-adjust: auto;
    }
  }
</style>
