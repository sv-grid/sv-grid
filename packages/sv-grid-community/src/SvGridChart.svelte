<script lang="ts">
  /**
   * SvGridChart - renders a `ChartSpec` as inline SVG. Supports grouped +
   * stacked bars, line, area, pie / donut, combo charts (per-series type),
   * a secondary Y axis, signed Y domains, and axis titles. Interactive: a
   * unified crosshair tooltip (hover a category -> all series at once),
   * focus tooltips, a clickable legend that toggles series, optional data
   * labels, and an `onSelect` drill hook. No external charting dependency.
   */
  import { buildChart, DEFAULT_PALETTE, type ChartSpec, type ChartSelection } from './chart'

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
  }
  let {
    spec,
    legend = true,
    interactive = true,
    dataLabels = false,
    formatValue,
    onSelect,
  }: Props = $props()

  const fmt = (v: number) =>
    formatValue
      ? formatValue(v)
      : Number.isFinite(v)
        ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : String(v)

  let hidden = $state(new Set<string>())
  const palette = $derived(spec.palette ?? DEFAULT_PALETTE)

  const coloredSeries = $derived(
    spec.series.map((s, i) => ({ ...s, color: s.color ?? palette[i % palette.length]! })),
  )

  const visibleSpec = $derived.by<ChartSpec>(() => {
    if (spec.type === 'pie') {
      const s = coloredSeries[0]
      if (!s) return spec
      const values = s.values.map((v, i) => (hidden.has(spec.categories[i] ?? String(i)) ? 0 : v))
      return { ...spec, series: [{ ...s, values }] }
    }
    return { ...spec, series: coloredSeries.filter((s) => !hidden.has(s.label)) }
  })

  const geo = $derived(buildChart(visibleSpec))
  const isCartesian = $derived(spec.type !== 'pie')
  const slot = $derived(geo.plot.w / Math.max(1, spec.categories.length))

  const legendItems = $derived(
    spec.type === 'pie'
      ? spec.categories.map((label, i) => ({ label, color: palette[i % palette.length]!, off: hidden.has(label) }))
      : coloredSeries.map((s) => ({ label: s.label, color: s.color, off: hidden.has(s.label) })),
  )

  const isEmpty = $derived.by(() => {
    if (spec.type === 'pie') return geo.slices.every((s) => s.value <= 0)
    return geo.bars.length === 0 && geo.lines.every((l) => l.points.every((p) => !p.defined))
  })

  function toggle(label: string) {
    if (!interactive) return
    const next = new Set(hidden)
    if (next.has(label)) next.delete(label)
    else next.add(label)
    hidden = next
  }
  function truncate(s: string, n = 12): string {
    return s.length > n ? s.slice(0, n - 1) + '…' : s
  }
  const yTickLabel = (value: number, fallback: string) => (formatValue ? formatValue(value) : fallback)

  // ---- Tooltip + crosshair ----------------------------------------------
  let chartEl: HTMLElement | null = $state(null)
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
    showTip(clientX, clientY, spec.categories[i] ?? '', catRows(i))
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

  function select(category: string, series: string, value: number) {
    onSelect?.({ category, series, value })
  }
  function onCatKey(e: KeyboardEvent, i: number) {
    if (!onSelect) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      select(spec.categories[i] ?? '', '', 0)
    }
  }
  function onSliceKey(e: KeyboardEvent, label: string, value: number) {
    if (!onSelect) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      select(label, label, value)
    }
  }
</script>

<div class="sv-grid-chart" bind:this={chartEl}>
  <svg
    class="sv-grid-chart-svg"
    class:is-interactive={interactive}
    class:is-clickable={!!onSelect}
    viewBox={`0 0 ${geo.width} ${geo.height}`}
    width="100%"
    role="img"
    aria-label={`${spec.type} chart`}
  >
    {#if isCartesian}
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
      {#if line.areaPath}
        <path class="sv-grid-chart-area" d={line.areaPath} fill={line.color} fill-opacity="0.15" stroke="none" />
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
    {/each}

    {#each geo.bars as bar, bi (bi)}
      <rect class="sv-grid-chart-bar" x={bar.x} y={bar.y} width={bar.w} height={bar.h} rx="1" fill={bar.color} />
      {#if dataLabels && bar.h > 13}
        <text class="sv-grid-chart-datalabel" class:on-bar={spec.stacked} x={bar.x + bar.w / 2} y={spec.stacked ? bar.y + bar.h / 2 + 3 : bar.value >= 0 ? bar.y - 3 : bar.y + bar.h + 11} text-anchor="middle">{fmt(bar.value)}</text>
      {/if}
    {/each}

    {#if isCartesian && activeCat !== null}
      {@const cx = geo.plot.x + slot * activeCat + slot / 2}
      <line class="sv-grid-chart-crosshair" x1={cx} y1={geo.plot.y} x2={cx} y2={geo.plot.y + geo.plot.h} />
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
        onclick={() => select(slice.label, slice.label, slice.value)}
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

    {#if isCartesian}
      <!-- Per-category hover/focus zones drive the unified crosshair tooltip. -->
      {#each spec.categories as cat, i (cat + i)}
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_mouse_events_have_key_events a11y_no_noninteractive_tabindex -->
        <rect
          class="sv-grid-chart-cat-hit"
          x={geo.plot.x + slot * i}
          y={geo.plot.y}
          width={slot}
          height={geo.plot.h}
          role={onSelect ? 'button' : 'presentation'}
          tabindex={onSelect ? 0 : undefined}
          aria-label={`${cat}: ${catRows(i).map((r) => `${r.label} ${r.value}`).join(', ')}`}
          onmousemove={(e) => hoverCat(e.clientX, e.clientY, i)}
          onmouseleave={clearActive}
          onfocus={(e) => focusCat(e.currentTarget, i)}
          onblur={clearActive}
          onclick={() => select(cat, '', 0)}
          onkeydown={(e) => onCatKey(e, i)}
        />
      {/each}
    {/if}
  </svg>

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
      {#each legendItems as item (item.label)}
        <button
          type="button"
          class="sv-grid-chart-legend-item"
          class:is-off={item.off}
          disabled={!interactive}
          aria-pressed={!item.off}
          onclick={() => toggle(item.label)}
          title={interactive ? (item.off ? `Show ${item.label}` : `Hide ${item.label}`) : item.label}
        >
          <span class="sv-grid-chart-swatch" style={`background:${item.off ? 'transparent' : item.color}; border-color:${item.color}`}></span>
          {item.label}
        </button>
      {/each}
    </div>
  {/if}
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
  .sv-grid-chart-crosshair {
    stroke: var(--sg-accent, #2563eb);
    stroke-width: 1;
    stroke-dasharray: 3 3;
    opacity: 0.65;
    pointer-events: none;
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
  .sv-grid-chart-swatch {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    border: 1.5px solid transparent;
    display: inline-block;
    box-sizing: border-box;
  }
</style>
