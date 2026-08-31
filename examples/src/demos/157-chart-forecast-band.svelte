<!-- Documented in: docs/help/charts.md -->
<script lang="ts">
  /**
   * 157. Forecast with smooth lines + confidence band
   * --------------------------------------------------
   * Two chart options that turn a raw forecast into something readable:
   *
   *  - `smooth: true` on a series swaps the polyline for a monotone cubic
   *    curve. The curve still passes through every data point but flows
   *    smoothly between them - no overshoots.
   *
   *  - `upperValues[]` + `lowerValues[]` give the chart a translucent
   *    band that shades the forecast envelope. Pair with `smooth` and the
   *    band itself curves to match the trend line.
   *
   * The grid feeds the forecast; flip "actuals only" to clip the chart
   * to the historical part of the same series.
   */
  import {
    SvGrid,
    SvGridChart,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
    type ChartSpec,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Row = {
    id: number; week: string;
    actual: number | null; forecast: number | null;
    upper: number | null; lower: number | null;
  }
  // 12 weeks of actuals + 8 weeks of forecast with widening uncertainty.
  let seed = 0xfeedface
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0xffffffff)
  const HIST = 12
  const FCST = 8
  const rows: Row[] = Array.from({ length: HIST + FCST }, (_, i) => {
    const d = new Date(2026, 2, 1 + i * 7)
    const week = d.toISOString().slice(0, 10)
    const base = 4200 + i * 95
    const seasonal = Math.sin((i / 4) * 2 * Math.PI) * 220
    const value = Math.round(base + seasonal + (rnd() - 0.5) * 180)
    const forecast = i >= HIST ? value : null
    // Spread widens after the actuals run out.
    const k = i >= HIST ? (i - HIST + 1) : 0
    const spread = 220 + k * 95
    return {
      id: i,
      week,
      actual:   i < HIST ? value : null,
      forecast,
      upper:    forecast != null ? forecast + spread : null,
      lower:    forecast != null ? Math.max(0, forecast - spread) : null,
    }
  })

  const fmtCurrency = (v: number | null) => v == null ? '' : v.toLocaleString('en-US', { maximumFractionDigits: 0 })

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'week', header: 'Week', width: 130 },
    { field: 'actual',   header: 'Actual',   width: 110, align: 'right' },
    { field: 'forecast', header: 'Forecast', width: 110, align: 'right' },
    { field: 'lower',    header: 'Lower',    width: 100, align: 'right' },
    { field: 'upper',    header: 'Upper',    width: 100, align: 'right' },
  ]

  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let displayed = $state<Row[]>(rows)
  let smooth = $state(true)
  let actualsOnly = $state(false)
  function sync() { displayed = (api?.getDisplayedRows() as Row[]) ?? rows }

  const spec = $derived.by<ChartSpec>(() => {
    const cats = displayed.map((r) => r.week)
    const actuals = displayed.map((r) => (r.actual ?? NaN) as number)
    const forecasts = actualsOnly ? [] : [{
      label: 'Forecast',
      values:      displayed.map((r) => (r.forecast ?? NaN) as number),
      upperValues: displayed.map((r) => (r.upper    ?? NaN) as number),
      lowerValues: displayed.map((r) => (r.lower    ?? NaN) as number),
      color: '#94a3b8',
      smooth,
    }]
    return {
      type: 'line',
      categories: cats,
      series: [
        { label: 'Actual', values: actuals, color: '#2563eb', smooth },
        ...forecasts,
      ],
      width: 720,
      height: 320,
      xType: 'time',
      xAxisTitle: 'Week',
      yAxisTitle: 'Weekly bookings',
    }
  })

  const compact = (v: number) => (Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(v % 1e3 ? 1 : 0) + 'k' : String(Math.round(v)))
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="shrink-0 rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Forecast with smooth curves + a shaded confidence band
    </p>
    <p class="mt-0.5 text-xs" style="color: var(--sg-muted);">
      The forecast series has `upperValues` + `lowerValues` set, which shade the envelope between
      them. Toggle smoothing to compare monotone cubic curves vs. straight polylines.
    </p>
    <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <label class="ic-chk"><input type="checkbox" bind:checked={smooth} /> Smooth curves</label>
      <label class="ic-chk"><input type="checkbox" bind:checked={actualsOnly} /> Actuals only</label>
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
        selectionMode="none"
        rowHeight={28}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(a) => { api = a; sync() }}
        onFiltersChange={sync}
        onSortingChange={sync}
      />
    </div>
    <div class="shrink-0 rounded-lg border p-3" style="width: 760px; border-color: var(--sg-border); background: var(--sg-bg);">
      <SvGridChart {spec} formatValue={compact} />
    </div>
  </div>
</section>

<style>
  .ic-chk { display: inline-flex; align-items: center; gap: 4px; color: var(--sg-fg); font-size: 12px; }
  .ic-chk input[type='checkbox'] { accent-color: var(--sg-accent); }
</style>
