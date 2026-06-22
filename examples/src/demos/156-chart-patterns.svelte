<!-- Documented in: docs/help/charts.md -->
<script lang="ts">
  /**
   * 156. Chart pattern fills (colorblind-safe)
   * ------------------------------------------
   * Color alone is a fragile encoding for readers with red/green or
   * blue/yellow color vision deficiency. SvGrid lets you layer SVG
   * pattern fills (`stripe`, `crosshatch`, `dots`, `diagonal`) over the
   * series color so two series with similar hues still read as distinct.
   *
   * Two ways to opt in:
   *  - `series[i].pattern: 'stripe'` per series, OR
   *  - `spec.patternFallback: true` cycles four patterns across every
   *    unflagged series. One flag, instant accessibility upgrade.
   */
  import {
    SvGrid,
    SvGridChart,
    rowsToChartSpec,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
    type ChartSpec,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Row = { id: number; quarter: string; region: string; revenue: number }
  const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']
  const REGIONS = ['Americas', 'EMEA', 'APAC', 'LATAM']
  let seed = 0xfeedbeef
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0xffffffff)
  let nid = 0
  const rows: Row[] = QUARTERS.flatMap((q, qi) =>
    REGIONS.map((region) => ({
      id: nid++,
      quarter: q,
      region,
      revenue: Math.round(80_000 + qi * 22_000 + rnd() * 80_000),
    })),
  )

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'quarter', header: 'Quarter', width: 100 },
    { field: 'region', header: 'Region', width: 130 },
    { field: 'revenue', header: 'Revenue', width: 140, align: 'right',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
  ]

  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let displayed = $state<Row[]>(rows)
  let patternFallback = $state(true)
  let stacked = $state(false)
  function sync() { displayed = (api?.getDisplayedRows() as Row[]) ?? rows }

  const compact = (v: number) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(v % 1e3 ? 1 : 0) + 'k' : String(Math.round(v)))

  const spec = $derived.by<ChartSpec>(() => {
    const s = rowsToChartSpec(displayed, {
      type: 'bar',
      category: 'quarter',
      value: 'revenue',
      series: 'region',
      reduce: 'sum',
      stacked,
      width: 560,
      height: 320,
    })
    s.patternFallback = patternFallback
    s.yAxisTitle = 'Revenue (USD)'
    return s
  })
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="shrink-0 rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Pattern fills - color-blind-safe series
    </p>
    <p class="mt-0.5 text-xs" style="color: var(--sg-muted);">
      Toggle the pattern fallback. Each series gets a distinct texture (stripe / crosshatch /
      dots / diagonal) layered over its color so it stays distinguishable in grayscale or for
      readers with deuteranopia / protanopia. Try it stacked - the textures preserve series
      identity even when the colors touch.
    </p>
    <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <label class="ic-chk"><input type="checkbox" bind:checked={patternFallback} /> Pattern fallback</label>
      <label class="ic-chk"><input type="checkbox" bind:checked={stacked} /> Stacked</label>
    </div>
  </div>

  <div class="flex flex-1 min-h-0 gap-3">
    <div class="flex-1 min-h-0">
      <SvGrid
        data={rows}
        columns={columns}
        features={features}
        sortable
        filterable
        selectionMode="none"
        enableRowSummaries={false}
        rowHeight={28}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(a) => { api = a; sync() }}
        onFiltersChange={sync}
        onSortingChange={sync}
      />
    </div>
    <div class="shrink-0 rounded-lg border p-3" style="width: 600px; border-color: var(--sg-border); background: var(--sg-bg);">
      <SvGridChart {spec} formatValue={compact} />
    </div>
  </div>
</section>

<style>
  .ic-chk { display: inline-flex; align-items: center; gap: 4px; color: var(--sg-fg); font-size: 12px; }
  .ic-chk input[type='checkbox'] { accent-color: var(--sg-accent); }
</style>
