<!-- Documented in: docs/help/charts.md -->
<script lang="ts">
  /**
   * 152. Chart wizard (chart from the grid)
   * ---------------------------------------
   * A data grid on the left, a chart wizard on the right. The wizard builds a
   * chart from the grid's CURRENT (filtered / sorted) rows via rowsToChartSpec:
   * pick the chart type from a gallery (whose thumbnails are themselves live
   * mini SvGridChart instances), choose the group-by + measure + aggregation in
   * Customize, and a palette. Filter the grid and the chart re-aggregates live.
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
    rowSelectionFeature,
    type GridColumns,
    type SvGridApi,
    type ChartSpec,
    type ChartType,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature, rowSelectionFeature })

  type Row = { id: number; rep: string; region: string; product: string; revenue: number; deals: number; growth: number }
  const REGIONS = ['Americas', 'EMEA', 'APAC']
  const PRODUCTS = ['PLC', 'Drives', 'Rivets', 'Stock']
  const NAMES = ['Ada', 'Grace', 'Alan', 'Margaret', 'Linus', 'Donald', 'Brian', 'Dennis', 'Barbara', 'Ken']
  let seed = 0xc0ffee
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0xffffffff)
  const TREND: Record<string, number> = { PLC: 16, Drives: -9, Rivets: 5, Stock: -13 }
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

  const columns: GridColumns<Row> = [
    { field: 'rep', header: 'Rep', width: 100 },
    { field: 'region', header: 'Region', width: 100 },
    { field: 'product', header: 'Product', width: 100 },
    { field: 'revenue', header: 'Revenue', width: 130, align: 'right', format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { field: 'deals', header: 'Deals', width: 80, align: 'right' },
    { field: 'growth', header: 'Growth %', width: 90, align: 'right' },
  ]

  // ---- Chart-type gallery -------------------------------------------------
  type Variant = { key: string; label: string; title: string; type: ChartType; stacked?: boolean; stacked100?: boolean; orientation?: 'horizontal'; innerRadius?: number }
  type GalleryGroup = { group: string; items: Variant[] }
  const GROUPS: GalleryGroup[] = [
    {
      group: 'Column',
      items: [
        { key: 'column', label: 'Grouped', title: 'Column', type: 'bar' },
        { key: 'column-stacked', label: 'Stacked', title: 'Stacked Column', type: 'bar', stacked: true },
        { key: 'column-100', label: '100%', title: '100% Column', type: 'bar', stacked: true, stacked100: true },
      ],
    },
    {
      group: 'Bar',
      items: [
        { key: 'bar', label: 'Grouped', title: 'Bar', type: 'bar', orientation: 'horizontal' },
        { key: 'bar-stacked', label: 'Stacked', title: 'Stacked Bar', type: 'bar', orientation: 'horizontal', stacked: true },
        { key: 'bar-100', label: '100%', title: '100% Bar', type: 'bar', orientation: 'horizontal', stacked: true, stacked100: true },
      ],
    },
    {
      group: 'Line',
      items: [
        { key: 'line', label: 'Line', title: 'Line', type: 'line' },
        { key: 'area', label: 'Area', title: 'Area', type: 'area' },
        { key: 'area-stacked', label: 'Stacked Area', title: 'Stacked Area', type: 'area', stacked: true },
      ],
    },
    {
      group: 'Pie',
      items: [
        { key: 'pie', label: 'Pie', title: 'Pie', type: 'pie' },
        { key: 'donut', label: 'Donut', title: 'Donut', type: 'pie', innerRadius: 0.62 },
      ],
    },
  ]

  const PALETTES: { key: string; label: string; colors: string[] }[] = [
    { key: 'classic', label: 'Classic', colors: ['#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#8b5cf6'] },
    { key: 'ocean', label: 'Ocean', colors: ['#0ea5e9', '#14b8a6', '#6366f1', '#8b5cf6', '#06b6d4'] },
    { key: 'sunset', label: 'Sunset', colors: ['#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#f97316'] },
    { key: 'forest', label: 'Forest', colors: ['#16a34a', '#65a30d', '#0d9488', '#4d7c0f', '#0891b2'] },
    { key: 'slate', label: 'Slate', colors: ['#475569', '#0ea5e9', '#64748b', '#38bdf8', '#94a3b8'] },
  ]

  // Sample data for the gallery thumbnails (shape preview, not grid data).
  const THUMB: ChartSpec = {
    type: 'bar',
    categories: ['A', 'B', 'C'],
    series: [
      { label: 'a', values: [4, 6, 5] },
      { label: 'b', values: [5, 3, 6] },
      { label: 'c', values: [3, 5, 4] },
    ],
    width: 128,
    height: 70,
  }

  // ---- State --------------------------------------------------------------
  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let displayed = $state<Row[]>(rows)
  let tab = $state<'type' | 'customize'>('type')
  let selectedKey = $state('column')
  let paletteKey = $state('classic')
  let category = $state<'region' | 'product' | 'rep'>('region')
  let measure = $state<'revenue' | 'deals' | 'growth' | 'both'>('revenue')
  let reduce = $state<'sum' | 'avg' | 'count'>('sum')
  let dataLabels = $state(false)
  let showLegend = $state(true)
  let chartWrap = $state<HTMLElement | null>(null)
  // Rows covered by a cell-range selection and by row-checkbox selection. When
  // either is non-empty the chart is built from the UNION - "chart the selection".
  let cellRows = $state<Row[]>([])
  let checkedRows = $state<Row[]>([])

  function sync() {
    displayed = (api?.getDisplayedRows() as Row[]) ?? rows
  }

  // Map cell-selection rectangles ([rowStart, _, rowEnd, _]) to displayed rows.
  function onCellSelectionChange(ranges: Array<[number, number, number, number]>) {
    const idx = new Set<number>()
    for (const [r0, , r1] of ranges) {
      const lo = Math.min(r0, r1)
      const hi = Math.max(r0, r1)
      for (let r = lo; r <= hi; r++) idx.add(r)
    }
    cellRows = [...idx].map((i) => displayed[i]).filter((r): r is Row => !!r)
  }

  // Union the cell-range rows and the checkbox rows, de-duped by id.
  const selectedRows = $derived.by(() => {
    const map = new Map<number, Row>()
    for (const r of cellRows) map.set(r.id, r)
    for (const r of checkedRows) map.set(r.id, r)
    return [...map.values()]
  })
  // Build the chart from the selection when there is one, else all visible rows.
  const chartRows = $derived(selectedRows.length ? selectedRows : displayed)

  function clearSelection() {
    cellRows = []
    checkedRows = []
    api?.selectCells([])
    api?.clearRowSelection()
  }

  const allVariants = $derived(GROUPS.flatMap((g) => g.items))
  const selected = $derived(allVariants.find((v) => v.key === selectedKey) ?? allVariants[0]!)
  const palette = $derived(PALETTES.find((p) => p.key === paletteKey)?.colors ?? PALETTES[0]!.colors)

  const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)
  const measureLabel = $derived(
    measure === 'deals' ? 'Deals' : measure === 'growth' ? 'Growth %' : measure === 'both' ? 'Revenue + Deals' : 'Revenue',
  )
  const panelTitle = $derived(`${measureLabel} by ${cap(category)} · ${selected.title}`)

  const compact = (v: number) => {
    const a = Math.abs(v)
    if (a >= 1e6) return (v / 1e6).toFixed(a % 1e6 ? 1 : 0) + 'M'
    if (a >= 1e3) return (v / 1e3).toFixed(0) + 'k'
    return String(Math.round(v))
  }
  const fmtVal = (v: number) => (measure === 'deals' || measure === 'growth' ? compact(v) : '$' + compact(v))

  // Build the chart from the grid's current rows.
  const mainSpec = $derived.by<ChartSpec>(() => {
    const fields = measure === 'both' ? (['revenue', 'deals'] as const) : ([measure] as const)
    const valueFields = selected.type === 'pie' ? [fields[0]!] : fields
    const s = rowsToChartSpec(chartRows, {
      type: selected.type,
      category,
      value: valueFields as any,
      reduce,
      stacked: !!selected.stacked,
      stacked100: !!selected.stacked100,
      palette,
      width: 380,
      height: 260,
    })
    if (selected.orientation) s.orientation = selected.orientation
    if (selected.innerRadius) s.innerRadius = selected.innerRadius
    if (selected.type !== 'pie') {
      const valueTitle = selected.stacked100 ? 'Share' : measureLabel
      if (selected.orientation === 'horizontal') {
        s.yAxisTitle = cap(category)
        s.xAxisTitle = valueTitle
      } else {
        s.xAxisTitle = cap(category)
        s.yAxisTitle = valueTitle
      }
    }
    return s
  })

  function thumbSpec(v: Variant): ChartSpec {
    return {
      ...THUMB,
      type: v.type,
      stacked: v.stacked,
      stacked100: v.stacked100,
      orientation: v.orientation,
      innerRadius: v.innerRadius,
      palette,
    }
  }
</script>

<section class="flex flex-1 min-h-0 gap-3">
  <div class="flex flex-col flex-1 min-h-0">
    <p class="shrink-0 mb-2 text-xs" style="color: var(--sg-muted);">
      Drag a cell range or tick row checkboxes to chart just the selection · otherwise the chart uses all visible rows · filter / sort re-aggregates live.
    </p>
    <div class="flex-1 min-h-0">
      <SvGrid responsive={true}
      columnResize
        data={rows}
        columns={columns}
        features={features}
        sortable
        filterable
        selectionMode="both"
        showRowSelection={true}
        rowHeight={32}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(a) => { api = a; sync() }}
        onFiltersChange={() => { sync(); clearSelection() }}
        onSortingChange={() => { sync(); clearSelection() }}
        onCellSelectionChange={onCellSelectionChange}
        onRowSelectionChange={(_, rs) => (checkedRows = rs as Row[])}
      />
    </div>
  </div>

  <div class="cw-panel">
    <div class="cw-titlebar">
      <span class="cw-title">{panelTitle}</span>
      {#if selectedRows.length}
        <span class="cw-sel">
          <span class="cw-sel-badge">{selectedRows.length} selected</span>
          <button type="button" class="cw-sel-clear" onclick={clearSelection}>clear</button>
        </span>
      {/if}
    </div>

    <div class="cw-preview" bind:this={chartWrap}>
      <SvGridChart spec={mainSpec} {dataLabels} legend={showLegend} formatValue={fmtVal} />
    </div>

    <div class="cw-tabs" role="tablist">
      <button type="button" class="cw-tab" class:is-active={tab === 'type'} role="tab" aria-selected={tab === 'type'} onclick={() => (tab = 'type')}>Type</button>
      <button type="button" class="cw-tab" class:is-active={tab === 'customize'} role="tab" aria-selected={tab === 'customize'} onclick={() => (tab = 'customize')}>Customize</button>
    </div>

    <div class="cw-tabpanel">
      {#if tab === 'type'}
        {#each GROUPS as g (g.group)}
          <div class="cw-group-label">{g.group}</div>
          <div class="cw-gallery">
            {#each g.items as v (v.key)}
              <button
                type="button"
                class="cw-thumb"
                class:is-selected={selectedKey === v.key}
                title={v.title}
                aria-label={v.title}
                aria-pressed={selectedKey === v.key}
                onclick={() => (selectedKey = v.key)}
              >
                <div class="cw-thumb-chart">
                  <SvGridChart spec={thumbSpec(v)} interactive={false} legend={false} />
                </div>
              </button>
            {/each}
          </div>
        {/each}
      {:else}
        <label class="cw-field">
          <span>Group by</span>
          <select bind:value={category}>
            <option value="region">Region</option>
            <option value="product">Product</option>
            <option value="rep">Rep</option>
          </select>
        </label>
        <label class="cw-field">
          <span>Measure</span>
          <select bind:value={measure}>
            <option value="revenue">Revenue</option>
            <option value="deals">Deals</option>
            <option value="growth">Growth %</option>
            <option value="both">Revenue + Deals</option>
          </select>
        </label>
        <label class="cw-field">
          <span>Aggregate</span>
          <select bind:value={reduce}>
            <option value="sum">Sum</option>
            <option value="avg">Average</option>
            <option value="count">Count</option>
          </select>
        </label>
        <label class="cw-check"><input type="checkbox" bind:checked={dataLabels} /> Data labels</label>
        <label class="cw-check"><input type="checkbox" bind:checked={showLegend} /> Legend</label>
        {#if selected.type === 'pie' && measure === 'both'}
          <p class="cw-hint">Pie / donut uses the first measure only.</p>
        {/if}
      {/if}
    </div>

    <div class="cw-palette-row">
      <div class="cw-palettes">
        {#each PALETTES as p (p.key)}
          <button
            type="button"
            class="cw-palette"
            class:is-selected={paletteKey === p.key}
            title={p.label}
            aria-label={`${p.label} palette`}
            aria-pressed={paletteKey === p.key}
            onclick={() => (paletteKey = p.key)}
          >
            {#each p.colors.slice(0, 5) as c (c)}
              <span class="cw-dot" style={`background:${c}`}></span>
            {/each}
          </button>
        {/each}
      </div>
      <div class="cw-dl">
        <button type="button" class="cw-iconbtn" title="Download SVG" onclick={() => chartWrap && downloadChartSvg(chartWrap, 'chart.svg')}>SVG</button>
        <button type="button" class="cw-iconbtn" title="Download PNG" onclick={() => chartWrap && downloadChartPng(chartWrap, 'chart.png', { scale: 2 })}>PNG</button>
      </div>
    </div>
  </div>
</section>

<style>
  .cw-panel {
    width: 360px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border: 1px solid var(--sg-border);
    border-radius: 10px;
    background: var(--sg-bg);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.12);
    overflow: hidden;
  }
  .cw-titlebar {
    padding: 9px 12px;
    border-bottom: 1px solid var(--sg-border);
    background: var(--sg-header-bg);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .cw-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--sg-fg);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cw-sel {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .cw-sel-badge {
    font-size: 11px;
    font-weight: 700;
    color: var(--sg-on-accent, #fff);
    background: var(--sg-accent, #2563eb);
    border-radius: 999px;
    padding: 2px 8px;
    white-space: nowrap;
  }
  .cw-sel-clear {
    font-size: 11px;
    color: var(--sg-muted);
    background: transparent;
    border: 0;
    text-decoration: underline;
    cursor: pointer;
  }
  .cw-preview {
    padding: 10px 12px;
    border-bottom: 1px solid var(--sg-border);
  }

  .cw-tabs {
    display: flex;
    border-bottom: 1px solid var(--sg-border);
  }
  .cw-tab {
    flex: 1;
    border: 0;
    background: transparent;
    color: var(--sg-muted);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 9px 0;
    cursor: pointer;
    border-bottom: 2px solid transparent;
  }
  .cw-tab.is-active {
    color: var(--sg-accent, #2563eb);
    border-bottom-color: var(--sg-accent, #2563eb);
  }

  .cw-tabpanel {
    flex: 1;
    overflow-y: auto;
    padding: 10px 12px;
    min-height: 0;
  }
  .cw-group-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--sg-fg);
    margin: 6px 0 4px;
  }
  .cw-gallery {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin-bottom: 8px;
  }
  .cw-thumb {
    border: 1.5px solid var(--sg-border);
    border-radius: 6px;
    background: var(--sg-bg);
    padding: 3px;
    cursor: pointer;
    transition: border-color 0.12s ease, box-shadow 0.12s ease;
  }
  .cw-thumb:hover {
    border-color: var(--sg-accent, #2563eb);
  }
  .cw-thumb.is-selected {
    border-color: var(--sg-accent, #2563eb);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-accent, #2563eb) 30%, transparent);
  }
  .cw-thumb-chart {
    pointer-events: none;
    line-height: 0;
  }

  .cw-field {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-bottom: 9px;
    font-size: 12px;
    color: var(--sg-muted);
  }
  .cw-field select {
    border: 1px solid var(--sg-input-border, var(--sg-border));
    background: var(--sg-input-bg, var(--sg-bg));
    color: var(--sg-fg);
    border-radius: 6px;
    padding: 5px 8px;
    font-size: 13px;
  }
  .cw-check {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--sg-fg);
    margin-bottom: 8px;
  }
  .cw-check input {
    accent-color: var(--sg-accent);
  }
  .cw-hint {
    font-size: 11px;
    color: var(--sg-muted);
    margin-top: 4px;
  }

  .cw-palette-row {
    border-top: 1px solid var(--sg-border);
    padding: 8px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .cw-palettes {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
  }
  .cw-palette {
    display: inline-flex;
    border: 1.5px solid transparent;
    border-radius: 999px;
    padding: 2px;
    background: transparent;
    cursor: pointer;
  }
  .cw-palette.is-selected {
    border-color: var(--sg-accent, #2563eb);
  }
  .cw-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    display: inline-block;
    margin: 0 -1px;
    box-shadow: 0 0 0 1px var(--sg-bg);
  }
  .cw-dl {
    display: inline-flex;
    gap: 5px;
  }
  .cw-iconbtn {
    border: 1px solid var(--sg-border);
    background: var(--sg-bg);
    color: var(--sg-fg);
    border-radius: 6px;
    padding: 3px 8px;
    font-size: 11px;
    cursor: pointer;
  }
  .cw-iconbtn:hover {
    border-color: var(--sg-accent, #2563eb);
  }
  /* Phone: the wizard panel is stretched to a stage shorter than its content and hides
     the rest; let it scroll inside itself. */
  @media (max-width: 639px), (max-height: 500px) and (pointer: coarse) {
    .cw-panel { overflow-y: auto; }
  }
</style>
