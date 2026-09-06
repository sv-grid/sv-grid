<script lang="ts">
  /**
   * 77. Smart.Chart integration (htmlelements.com)
   * ---------------------------------------------
   * Real working integration: mounts a `<smart-chart>` web component
   * next to the grid and keeps its `dataSource` in sync with the rows
   * the grid is currently displaying. Filter the grid - the chart
   * re-aggregates. Use the chart-type pills to switch column → stacked
   * column → line → pie without remounting.
   *
   * Loads `smart-webcomponents/source/modules/smart.chart.js` lazily on
   * first paint. The component registers `<smart-chart>` as a custom
   * element; properties are set imperatively after createElement.
   */
  import { onMount, onDestroy } from 'svelte'
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type GridColumns,
    type SvGridApi,
  } from '@svgrid/grid'

  type Region = 'AMER' | 'EMEA' | 'APAC'
  type Sale = { id: string; region: Region; quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'; product: string; amount: number; units: number }

  const PRODUCTS = ['Widgets', 'Gizmos', 'Sprockets', 'Cogs']
  const REGIONS:  Region[] = ['AMER', 'EMEA', 'APAC']
  const QUARTERS  = ['Q1', 'Q2', 'Q3', 'Q4'] as const

  let prng = 0xABBA9911
  function rand() { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function pick<T>(a: readonly T[]): T { return a[Math.floor(rand() * a.length)]! }

  const rows: Sale[] = Array.from({ length: 80 }, (_, i) => ({
    id: `s_${i}`,
    region:  pick(REGIONS),
    quarter: pick(QUARTERS),
    product: pick(PRODUCTS),
    amount:  Math.round(1_000 + rand() * 49_000),
    units:   Math.round(10 + rand() * 290),
  }))

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let api = $state<SvGridApi<typeof features, Sale> | null>(null)
  let displayedRows = $state<Sale[]>(rows)

  type ChartType = 'column' | 'stackedcolumn' | 'line' | 'pie'
  let chartType = $state<ChartType>('column')

  // ---- Aggregator: quarter × region revenue + units totals ------------
  function aggregateByQuarter(src: ReadonlyArray<Sale>) {
    const out = new Map<string, { quarter: string; AMER: number; EMEA: number; APAC: number; units: number }>()
    for (const q of QUARTERS) out.set(q, { quarter: q, AMER: 0, EMEA: 0, APAC: 0, units: 0 })
    for (const r of src) {
      const row = out.get(r.quarter)
      if (row) { row[r.region] += r.amount; row.units += r.units }
    }
    return Array.from(out.values())
  }
  function aggregateByRegion(src: ReadonlyArray<Sale>) {
    const out = new Map<Region, number>(REGIONS.map((r) => [r, 0]))
    for (const r of src) out.set(r.region, out.get(r.region)! + r.amount)
    return Array.from(out.entries()).map(([region, amount]) => ({ region, amount }))
  }

  // ---- KPIs -----------------------------------------------------------
  const totalRevenue = $derived(displayedRows.reduce((a, r) => a + r.amount, 0))
  const totalUnits   = $derived(displayedRows.reduce((a, r) => a + r.units, 0))
  const avgDeal      = $derived(displayedRows.length > 0 ? Math.round(totalRevenue / displayedRows.length) : 0)

  const fmtMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  const fmtNum   = new Intl.NumberFormat('en-US')

  // ---- Smart.Chart life-cycle -----------------------------------------
  let chartHost: HTMLElement | undefined
  let chartEl: HTMLElement | null = null
  let smartLoaded = $state(false)
  let chartError = $state<string | null>(null)

  const SERIES_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444']

  function buildSeriesGroups(type: ChartType): unknown[] {
    if (type === 'pie') {
      // Pie uses a single ring of regions for the current view.
      return [{
        type: 'pie',
        showLabels: true,
        toolTipFormatSettings: { thousandsSeparator: ',' },
        series: [{
          dataField: 'amount',
          displayText: 'region',
          colorFunction: (_v: unknown, ix: number) => SERIES_COLORS[ix % SERIES_COLORS.length],
        }],
      }]
    }
    const t = type === 'stackedcolumn' ? 'stackedcolumn' : type
    return [{
      type: t,
      orientation: 'vertical',
      columnsGapPercent: 35,
      seriesGapPercent: 8,
      valueAxis: {
        unitInterval: 50_000,
        gridLines: { color: 'var(--sg-border, #e2e8f0)' },
        labels: { class: 'sv-axis-label', formatFunction: (v: number) => fmtMoney.format(v) },
      },
      xAxis: { dataField: 'quarter', gridLines: { visible: false }, labels: { class: 'sv-axis-label' } },
      series: REGIONS.map((r, i) => ({
        dataField: r,
        displayText: r,
        symbolType: 'circle',
        lineWidth: 2,
        opacity: 0.92,
        color: SERIES_COLORS[i],
      })),
    }]
  }

  function syncChart() {
    if (!chartEl) return
    const ds = chartType === 'pie' ? aggregateByRegion(displayedRows) : aggregateByQuarter(displayedRows)
    ;(chartEl as unknown as { dataSource: unknown }).dataSource = ds
    ;(chartEl as unknown as { seriesGroups: unknown }).seriesGroups = buildSeriesGroups(chartType)
    ;(chartEl as unknown as { refresh: () => void }).refresh?.()
  }

  function rebuildDisplayed() { if (api) displayedRows = api.getDisplayedRows() as Sale[] }

  onMount(async () => {
    try {
      // @ts-ignore – optional peer dep
      await import('smart-webcomponents/source/modules/smart.chart.js')
      // @ts-ignore – ship the base stylesheet so axis text, tooltip, and
      // legend get their layout. Without this the chart renders as raw SVG.
      await import('smart-webcomponents/source/styles/smart.default.css')
      smartLoaded = true
    } catch (err) {
      chartError = String((err as Error)?.message ?? err)
      return
    }
    if (!chartHost) return
    chartEl = document.createElement('smart-chart')
    Object.assign(chartEl as unknown as Record<string, unknown>, {
      caption: '',
      description: '',
      showLegend: true,
      legendLayout: { position: 'bottom', align: 'center' },
      backgroundColor: 'transparent',
      titlePadding: { left: 0, top: 0, right: 0, bottom: 0 },
      padding: { left: 6, top: 6, right: 6, bottom: 6 },
      colorScheme: 'custom',
    })
    chartHost.appendChild(chartEl)
    syncChart()
  })
  onDestroy(() => { chartEl?.remove() })

  $effect(() => { void displayedRows; void chartType; if (chartEl) syncChart() })

  const columns: GridColumns<Sale> = [
    { field: 'id',      header: 'ID',      editorType: 'text', width: 80 },
    { field: 'region',  header: 'Region',  editorType: 'text', width: 100 },
    { field: 'quarter', header: 'Quarter', editorType: 'text', width: 100 },
    { field: 'product', header: 'Product', editorType: 'text', width: 130 },
    {
      field: 'units', header: 'Units', editorType: 'number', width: 100,
      format: { type: 'number', options: { maximumFractionDigits: 0 } },
    },
    {
      field: 'amount', header: 'Amount', editorType: 'number', width: 140,
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
  ]

  const CHART_TYPES: Array<{ id: ChartType; label: string; icon: string }> = [
    { id: 'column',         label: 'Column',  icon: '▥' },
    { id: 'stackedcolumn',  label: 'Stacked', icon: '▤' },
    { id: 'line',           label: 'Line',    icon: '⌒' },
    { id: 'pie',            label: 'Pie',     icon: '◔' },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3 smart-dash">
  <!-- KPI strip -->
  <div class="kpi-row shrink-0">
    <div class="kpi">
      <div class="kpi-label">Revenue (view)</div>
      <div class="kpi-value">{fmtMoney.format(totalRevenue)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Units</div>
      <div class="kpi-value">{fmtNum.format(totalUnits)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Avg deal</div>
      <div class="kpi-value">{fmtMoney.format(avgDeal)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Records</div>
      <div class="kpi-value">{displayedRows.length}<span class="kpi-of">/ {rows.length}</span></div>
    </div>
  </div>

  <div class="smart-layout flex-1 min-h-0">
    <!-- Grid pane -->
    <div class="smart-grid-pane">
      <SvGrid responsive={true}
      columnResize
        data={rows}
        columns={columns}
        features={features}
        filterMode="menu"
        selectionMode="cell"
        showRowNumbers={false}
        enableInlineEditing={false}
        enableCellSelection={true}
        rowHeight={30}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(next) => { api = next; rebuildDisplayed() }}
        onFiltersChange={() => rebuildDisplayed()}
        onSortingChange={() => rebuildDisplayed()}
      />
    </div>

    <!-- Smart.Chart pane -->
    <aside class="smart-card">
      <header class="smart-head">
        <div class="smart-title">
          <span class="smart-badge">Smart.Chart</span>
          <span class="smart-sub">{chartType === 'pie' ? 'Revenue share by region' : 'Quarterly revenue by region'}</span>
        </div>
        <div class="smart-tabs" role="tablist">
          {#each CHART_TYPES as t (t.id)}
            <button type="button"
              role="tab"
              aria-selected={t.id === chartType}
              class:is-active={t.id === chartType}
              onclick={() => (chartType = t.id)}
            >
              <span class="smart-tab-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          {/each}
        </div>
      </header>

      <div class="smart-chart-wrap">
        {#if !smartLoaded && !chartError}
          <div class="smart-empty">Loading chart engine…</div>
        {/if}
        {#if chartError}
          <div class="smart-error">
            <strong>Smart.Chart failed to load.</strong>
            <pre>{chartError}</pre>
          </div>
        {/if}
        <div bind:this={chartHost} class="smart-host" style={smartLoaded ? '' : 'visibility: hidden'}></div>
      </div>

      <footer class="smart-foot">
        Filter or sort the grid - the chart re-aggregates from <code>api.getDisplayedRows()</code>.
      </footer>
    </aside>
  </div>
</section>

<style>
  /* ---- KPI strip ---- */
  .kpi-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px;
    padding: 10px 14px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .kpi-label { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--sg-muted, #64748b); }
  .kpi-value { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--sg-fg, #0f172a); line-height: 1.1; }
  .kpi-of    { font-size: 12px; color: var(--sg-muted, #94a3b8); margin-left: 4px; font-weight: 500; }

  /* Side-by-side layout. The grid pane gets all remaining horizontal
     room; the chart pane is fixed-width so it never starves the grid. */
  .smart-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 440px;
    gap: 12px;
    min-height: 0;
  }
  @media (max-width: 1100px) {
    .smart-layout { grid-template-columns: 1fr; grid-template-rows: 1fr auto; }
    .smart-card   { max-height: 380px; }
  }
  /* Phone: the 380px cap left no room for the chart's own footer once the
     title and tabs wrapped; let the card take its content height (the page
     scrolls) instead of clipping the footer. */
  @media (max-width: 639px), (max-height: 500px) and (pointer: coarse) {
    .smart-card { max-height: none; }
  }
  .smart-grid-pane { min-height: 0; }

  /* ---- Chart card ---- */
  .smart-card {
    display: flex; flex-direction: column;
    min-height: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px;
    overflow: hidden;
  }
  .smart-head {
    display: flex; align-items: center; justify-content: space-between;
    gap: 8px; flex-wrap: wrap;
    padding: 10px 12px 8px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .smart-title { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
  .smart-badge {
    background: var(--sg-accent, #6366f1);
    color: var(--sg-on-accent, #fff); font-size: 10px; font-weight: 700; letter-spacing: 0.06em;
    padding: 3px 8px; border-radius: 999px; text-transform: uppercase;
  }
  .smart-sub  { font-size: 13px; color: var(--sg-fg, #0f172a); font-weight: 500; }

  .smart-tabs {
    display: inline-flex; align-items: center;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-row-alt-bg, #f8fafc);
    border-radius: 8px;
    padding: 2px;
  }
  .smart-tabs button {
    display: inline-flex; align-items: center; gap: 4px;
    background: transparent; border: 0;
    color: var(--sg-muted, #64748b);
    padding: 4px 10px; font-size: 12px; font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
  }
  .smart-tabs button:hover { color: var(--sg-fg, #0f172a); }
  .smart-tabs button.is-active {
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  }
  .smart-tab-icon { font-size: 14px; line-height: 1; }

  .smart-chart-wrap { flex: 1; min-height: 280px; position: relative; padding: 6px 4px; }
  .smart-host       { position: absolute; inset: 0; padding: 4px 6px; }
  .smart-host :global(smart-chart) {
    display: block; width: 100%; height: 100%;
    font-family: inherit;
    --smart-background: transparent;
    --smart-surface: transparent;
    --smart-primary: var(--sg-accent, #6366f1);
    background: transparent;
  }
  .smart-host :global(.sv-axis-label) { font-size: 11px; fill: var(--sg-muted, #64748b); }

  .smart-empty   { position: absolute; inset: 0; display: grid; place-items: center;
                   color: var(--sg-muted, #94a3b8); font-size: 13px; }
  .smart-error   { padding: 12px; }
  .smart-error pre { font-size: 11px; white-space: pre-wrap; color: #b91c1c; margin-top: 4px; }

  .smart-foot {
    padding: 8px 12px;
    border-top: 1px solid var(--sg-border, #e2e8f0);
    font-size: 11px; color: var(--sg-muted, #64748b);
  }
  .smart-foot code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--sg-fg, #0f172a); background: var(--sg-row-alt-bg, #f8fafc); padding: 1px 4px; border-radius: 3px; }
  /* Phone: with the 1fr row the chart card only got what the grid left. Content-sized rows. */
  @media (max-width: 639px), (max-height: 500px) and (pointer: coarse) {
    .smart-layout { grid-template-rows: auto auto; }
    /* The chart itself is absolutely positioned inside a flex-basis-0
       wrapper, so the card contributes only its header (86px) to the row
       and the chart + footer fell outside it. Title + tabs + 280px chart +
       footer is ~420px; reserve it. */
    .smart-card { min-height: 430px; }
  }
</style>
