<!-- Documented in: docs/help/charts.md -->
<script lang="ts">
  /**
   * 147. Integrated charts
   * ----------------------
   * Chart the grid's data with no external charting library. `SvGridChart`
   * renders a `ChartSpec`; `rowsToChartSpec` aggregates the grid's CURRENT
   * (filtered/sorted) rows. Bar / line / area / pie + donut, grouped or
   * stacked, combo (bar + line on a 2nd axis), signed Y axis (negatives),
   * tooltips, clickable legend, data labels, click-to-drill, and SVG/PNG
   * export.
   */
  import {
    SvGrid,
    SvGridChart,
    rowsToChartSpec,
    downloadChartSvg,
    downloadChartPng,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
    type ChartType,
    type ChartSpec,
    type ChartSelection,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Row = { id: number; rep: string; region: string; product: string; revenue: number; deals: number; growth: number }
  const REGIONS = ['Americas', 'EMEA', 'APAC']
  const PRODUCTS = ['PLC', 'Drivers', 'Rivets', 'Stock']
  const NAMES = ['Ada', 'Grace', 'Alan', 'Margaret', 'Linus', 'Donald', 'Brian', 'Dennis', 'Barbara', 'Ken']
  let seed = 0xc0ffee
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0xffffffff)
  // Per-product growth trend so some categories aggregate NEGATIVE (group by
  // Product + Growth % to see the signed axis).
  const TREND: Record<string, number> = { PLC: 16, Drivers: -9, Rivets: 5, Stock: -13 }
  const rows: Row[] = Array.from({ length: 60 }, (_, id) => {
    const product = PRODUCTS[id % 4]!
    return {
      id,
      rep: NAMES[id % NAMES.length]!,
      region: REGIONS[id % 3]!,
      product,
      revenue: Math.round(10_000 + rnd() * 190_000),
      deals: Math.round(2 + rnd() * 40),
      growth: Math.round(TREND[product]! + (rnd() - 0.5) * 14),
    }
  })

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'rep', header: 'Rep', width: 110 },
    { field: 'region', header: 'Region', width: 110 },
    { field: 'product', header: 'Product', width: 110 },
    { field: 'revenue', header: 'Revenue', width: 140, align: 'right', format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { field: 'deals', header: 'Deals', width: 90, align: 'right' },
    { field: 'growth', header: 'Growth %', width: 100, align: 'right' },
  ]

  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let displayed = $state<Row[]>(rows)
  let chartType = $state<ChartType>('bar')
  let category = $state<'region' | 'product' | 'rep'>('region')
  let measure = $state<'revenue' | 'deals' | 'growth' | 'both'>('revenue')
  // Revenue (millions) and Deals (dozens) live on wildly different scales, so
  // "Revenue + Deals" defaults to combo: Deals becomes a line on a secondary
  // right axis. Uncheck Combo to compare them on one (shared) axis.
  let stacked = $state(false)
  let stacked100 = $state(false)
  let combo = $state(true)
  let dataLabels = $state(false)
  let donut = $state(false)
  let topN = $state(false)
  let avgLine = $state(false)
  let horizontal = $state(false)
  let drill = $state<string | null>(null)
  let chartWrap = $state<HTMLElement | null>(null)
  // Rows covered by the current cell-selection range(s). When non-empty the
  // chart aggregates ONLY these - the "select a range, chart it" loop.
  let selectedRows = $state<Row[]>([])

  function sync() {
    displayed = (api?.getDisplayedRows() as Row[]) ?? rows
  }

  // Map selection rectangles ([rowStart, _, rowEnd, _]) to the displayed rows.
  function onSelectionChange(ranges: Array<[number, number, number, number]>) {
    const idx = new Set<number>()
    for (const [r0, , r1] of ranges) {
      const lo = Math.min(r0, r1)
      const hi = Math.max(r0, r1)
      for (let r = lo; r <= hi; r++) idx.add(r)
    }
    selectedRows = [...idx].map((i) => displayed[i]).filter((r): r is Row => !!r)
  }

  // Aggregate the selection when there is one, otherwise the full displayed set.
  const chartRows = $derived(selectedRows.length ? selectedRows : displayed)

  // Compact + currency-aware so the Y-axis ticks and tooltips match (e.g.
  // "$2M" on the axis, "$2.1M" in the tooltip - never "2000000").
  const compactNum = (v: number) => {
    const a = Math.abs(v)
    if (a >= 1e6) return (v / 1e6).toFixed(a % 1e6 ? 1 : 0) + 'M'
    if (a >= 1e3) return (v / 1e3).toFixed(a % 1e3 ? 1 : 0) + 'k'
    return String(Math.round(v))
  }
  const fmtVal = (v: number) => (Math.abs(v) >= 1000 ? '$' + compactNum(v) : compactNum(v))

  const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)
  const measureTitle = $derived(measure === 'deals' ? 'Deals' : measure === 'growth' ? 'Growth %' : 'Revenue')

  const spec = $derived.by<ChartSpec>(() => {
    const measures = measure === 'both' ? (['revenue', 'deals'] as const) : [measure]
    const s = rowsToChartSpec(chartRows, {
      type: chartType,
      category,
      value: measures as any,
      reduce: 'sum',
      stacked: stacked && chartType !== 'pie',
      stacked100: stacked100 && stacked && chartType !== 'pie',
      // Rank categories and bucket the long tail into "Other" (great for `by Rep`).
      sort: topN ? 'value-desc' : 'none',
      topN: topN ? 5 : undefined,
      width: 520,
      height: 300,
    })
    // Horizontal bars suit long category labels (e.g. by Rep). Only bars.
    const isHoriz = horizontal && chartType === 'bar' && measure !== 'both'
    if (isHoriz) {
      s.orientation = 'horizontal'
      s.yAxisTitle = cap(category)
      s.xAxisTitle = stacked100 && stacked ? 'Share' : measureTitle
    } else {
      s.yAxisTitle = stacked100 && stacked ? 'Share' : measureTitle
      s.xAxisTitle = cap(category)
    }
    // Combo: draw the 2nd measure as a line on the secondary (right) axis.
    if (combo && !stacked && measure === 'both' && chartType !== 'pie' && s.series[1]) {
      s.series[1] = { ...s.series[1], type: 'line', axis: 'right' }
      s.y2AxisTitle = 'Deals'
    }
    // Average reference line across the categories (single-measure, not 100%).
    if (avgLine && chartType !== 'pie' && !(stacked100 && stacked) && s.series[0]) {
      const vals = s.series[0].values.filter((v) => Number.isFinite(v))
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
      s.referenceLines = [{ value: Math.round(avg), label: `Avg ${fmtVal(avg)}` }]
    }
    if (chartType === 'pie') s.innerRadius = donut ? 0.62 : 0
    return s
  })

  function onChartSelect(sel: ChartSelection) {
    drill = sel.category
    api?.setFacetFilter(category, [sel.category])
  }
  function resetDrill() {
    drill = null
    api?.clearAllFilters()
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="shrink-0 rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Live chart bound to the grid via <code>rowsToChartSpec</code> + <code>SvGridChart</code>
    </p>
    <p class="mt-0.5 text-xs" style="color: var(--sg-muted);">
      Hover for a unified tooltip + crosshair · click a legend chip to toggle, double-click to isolate · click a bar to drill · <strong>drag a cell range to chart just that selection</strong>.
    </p>
    <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <select bind:value={chartType} class="ic-sel">
        <option value="bar">Bar</option>
        <option value="line">Line</option>
        <option value="area">Area</option>
        <option value="pie">Pie</option>
      </select>
      <select bind:value={category} class="ic-sel">
        <option value="region">by Region</option>
        <option value="product">by Product</option>
        <option value="rep">by Rep</option>
      </select>
      <select bind:value={measure} class="ic-sel">
        <option value="revenue">Revenue</option>
        <option value="deals">Deals</option>
        <option value="growth">Growth % (signed)</option>
        <option value="both">Revenue + Deals</option>
      </select>
      {#if chartType !== 'pie'}
        <label class="ic-chk"><input type="checkbox" bind:checked={stacked} disabled={measure !== 'both'} onchange={() => stacked && (combo = false)} /> Stacked</label>
        <label class="ic-chk"><input type="checkbox" bind:checked={stacked100} disabled={!stacked || measure !== 'both'} /> 100%</label>
        <label class="ic-chk"><input type="checkbox" bind:checked={combo} disabled={measure !== 'both'} onchange={() => combo && (stacked = false)} /> Combo (2nd axis)</label>
        <label class="ic-chk"><input type="checkbox" bind:checked={avgLine} /> Avg line</label>
        {#if chartType === 'bar'}
          <label class="ic-chk"><input type="checkbox" bind:checked={horizontal} disabled={measure === 'both'} /> Horizontal</label>
        {/if}
      {:else}
        <label class="ic-chk"><input type="checkbox" bind:checked={donut} /> Donut</label>
      {/if}
      <label class="ic-chk"><input type="checkbox" bind:checked={topN} /> Top 5 + Other</label>
      <label class="ic-chk"><input type="checkbox" bind:checked={dataLabels} /> Data labels</label>
      <span class="mx-1 h-4 w-px" style="background: var(--sg-border)"></span>
      <button type="button" class="ic-btn" onclick={() => chartWrap && downloadChartSvg(chartWrap, 'chart.svg')}>SVG</button>
      <button type="button" class="ic-btn" onclick={() => chartWrap && downloadChartPng(chartWrap, 'chart.png')}>PNG</button>
      {#if selectedRows.length}
        <span class="ic-badge" style="background: var(--sg-accent, #2563eb)">Charting {selectedRows.length} selected row{selectedRows.length === 1 ? '' : 's'}</span>
        <button type="button" class="ic-clear" onclick={() => { selectedRows = []; api?.selectCells([]) }}>clear</button>
      {/if}
      {#if drill}
        <span class="ic-badge">Drilled: {drill}</span>
        <button type="button" class="ic-clear" onclick={resetDrill}>reset</button>
      {/if}
    </div>
  </div>

  <div class="flex flex-1 min-h-0 gap-3">
    <div class="flex-1 min-h-0">
      <SvGrid responsive={true}
        data={rows}
        columns={columns}
        features={features}
        sortable
        filterable
        selectionMode="cell"
        enableRowSummaries={false}
        rowHeight={32}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(a) => { api = a; sync() }}
        onFiltersChange={() => { sync(); selectedRows = [] }}
        onSortingChange={() => { sync(); selectedRows = [] }}
        onCellSelectionChange={onSelectionChange}
      />
    </div>
    <div class="shrink-0 rounded-lg border p-3" style="width: 560px; border-color: var(--sg-border); background: var(--sg-bg);" bind:this={chartWrap}>
      <SvGridChart {spec} {dataLabels} formatValue={fmtVal} onSelect={onChartSelect} />
    </div>
  </div>
</section>

<style>
  .ic-sel {
    border: 1px solid var(--sg-input-border, var(--sg-border));
    background: var(--sg-input-bg, var(--sg-bg));
    color: var(--sg-fg);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 12px;
  }
  .ic-chk {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--sg-fg);
  }
  .ic-chk input { accent-color: var(--sg-accent); }
  .ic-chk:has(input:disabled) { opacity: 0.45; }
  .ic-btn {
    border: 1px solid var(--sg-border);
    background: var(--sg-bg);
    color: var(--sg-fg);
    border-radius: 6px;
    padding: 3px 9px;
    font-size: 12px;
    cursor: pointer;
  }
  .ic-btn:hover { border-color: var(--sg-accent); }
  .ic-badge {
    font-size: 11px;
    font-weight: 700;
    color: #fff;
    background: var(--sg-accent, #2563eb);
    border-radius: 999px;
    padding: 2px 9px;
  }
  .ic-clear {
    font-size: 11px;
    color: var(--sg-muted);
    background: transparent;
    border: 0;
    text-decoration: underline;
    cursor: pointer;
  }
</style>
