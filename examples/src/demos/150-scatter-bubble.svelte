<!-- Documented in: docs/help/charts.md -->
<script lang="ts">
  /**
   * 150. Scatter / bubble chart
   * ---------------------------
   * A scatter plot maps two numeric measures against each other (x vs y); a
   * bubble chart adds a third via the dot radius. `SvGridChart` renders a
   * `type: 'scatter'` spec whose series carry `points: [{ x, y, r }]`. Here
   * each rep is one bubble: marketing spend (x) vs revenue (y), sized by deals
   * closed, coloured by region. A reference line marks the average revenue.
   */
  import {
    SvGrid,
    SvGridChart,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type GridColumns,
    type SvGridApi,
    type ChartSpec,
    type ScatterPoint,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Row = { id: number; rep: string; region: string; spend: number; revenue: number; deals: number }
  const REGIONS = ['Americas', 'EMEA', 'APAC']
  const NAMES = ['Ada', 'Grace', 'Alan', 'Margaret', 'Linus', 'Donald', 'Brian', 'Dennis', 'Barbara', 'Ken', 'Edsger', 'Tim', 'Niklaus', 'John', 'Ada II']
  let seed = 0x5eed42
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0xffffffff)
  const rows: Row[] = NAMES.map((rep, id) => {
    const spend = Math.round(5_000 + rnd() * 45_000)
    // Revenue loosely tracks spend (with noise) so the cloud trends upward.
    const revenue = Math.round(spend * (3 + rnd() * 4) + (rnd() - 0.5) * 40_000)
    return { id, rep, region: REGIONS[id % 3]!, spend, revenue: Math.max(8_000, revenue), deals: Math.round(3 + rnd() * 45) }
  })

  const columns: GridColumns<Row> = [
    { field: 'rep', header: 'Rep', width: 120 },
    { field: 'region', header: 'Region', width: 120 },
    { field: 'spend', header: 'Marketing', width: 130, align: 'right', format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { field: 'revenue', header: 'Revenue', width: 140, align: 'right', format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { field: 'deals', header: 'Deals', width: 90, align: 'right' },
  ]

  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let displayed = $state<Row[]>(rows)
  let bubble = $state(true)
  let showAvg = $state(true)

  function sync() {
    displayed = (api?.getDisplayedRows() as Row[]) ?? rows
  }

  const compactNum = (v: number) => {
    const a = Math.abs(v)
    if (a >= 1e6) return (v / 1e6).toFixed(a % 1e6 ? 1 : 0) + 'M'
    if (a >= 1e3) return (v / 1e3).toFixed(a % 1e3 ? 1 : 0) + 'k'
    return String(Math.round(v))
  }
  const fmtVal = (v: number) => '$' + compactNum(v)

  // One series per region so the points are coloured by region.
  const spec = $derived.by<ChartSpec>(() => {
    const byRegion = new Map<string, ScatterPoint[]>()
    for (const r of displayed) {
      const pts = byRegion.get(r.region) ?? byRegion.set(r.region, []).get(r.region)!
      pts.push({ x: r.spend, y: r.revenue, r: bubble ? r.deals : undefined, label: r.rep })
    }
    const avg = displayed.length ? displayed.reduce((a, r) => a + r.revenue, 0) / displayed.length : 0
    return {
      type: 'scatter',
      categories: [],
      series: [...byRegion.entries()].map(([label, points]) => ({ label, values: [], points })),
      width: 520,
      height: 320,
      xAxisTitle: 'Marketing spend',
      yAxisTitle: 'Revenue',
      referenceLines: showAvg ? [{ value: Math.round(avg), label: `Avg ${fmtVal(avg)}` }] : [],
    }
  })
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="shrink-0 rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Scatter / bubble: spend vs revenue, sized by deals, coloured by region
    </p>
    <p class="mt-0.5 text-xs" style="color: var(--sg-muted);">
      Hover a bubble for its x / y · double-click a legend region to isolate it · filter the grid and the cloud re-plots.
    </p>
    <div class="mt-2 flex flex-wrap items-center gap-3 text-xs">
      <label class="ic-chk"><input type="checkbox" bind:checked={bubble} /> Bubble (size = deals)</label>
      <label class="ic-chk"><input type="checkbox" bind:checked={showAvg} /> Average revenue line</label>
    </div>
  </div>

  <div class="flex flex-1 min-h-0 gap-3">
    <div class="flex-1 min-h-0">
      <SvGrid responsive={true}
      columnResize
        data={rows}
        columns={columns}
        features={features}
        sortable
        filterable
        selectionMode="none"
        rowHeight={32}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(a) => { api = a; sync() }}
        onFiltersChange={sync}
        onSortingChange={sync}
      />
    </div>
    <div class="shrink-0 rounded-lg border p-3" style="width: 560px; border-color: var(--sg-border); background: var(--sg-bg);">
      <SvGridChart {spec} formatValue={fmtVal} />
    </div>
  </div>
</section>

<style>
  .ic-chk {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--sg-fg);
  }
  .ic-chk input { accent-color: var(--sg-accent); }
</style>
