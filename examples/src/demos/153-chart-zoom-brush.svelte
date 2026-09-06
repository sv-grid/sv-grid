<!-- Documented in: docs/help/charts.md -->
<script lang="ts">
  /**
   * 153. Chart zoom + brush (mini-map)
   * ----------------------------------
   * Long time-series get unreadable when every point fights for the same
   * horizontal pixels. `zoomable` lets the user drag a rect over the plot
   * area to zoom in (double-click resets). `brush` adds a compact mini-map
   * below the chart with a draggable window - drag the window body to pan,
   * drag either edge to resize. The two interactions stay in sync via the
   * chart's internal zoom state. Crosshair tooltip + PNG/SVG export round
   * out the interactive surface.
   */
  import {
    SvGrid,
    SvGridChart,
    rowsToChartSpec,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type GridColumns,
    type SvGridApi,
    type ChartSpec,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Row = { id: number; day: string; revenue: number; sessions: number }
  // 180 days of synthetic web traffic so zoom + brush actually earn their keep.
  let seed = 0xabc123
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0xffffffff)
  const rows: Row[] = Array.from({ length: 180 }, (_, i) => {
    const d = new Date(2026, 0, 1 + i)
    const trend = 1200 + i * 6                  // slow climb
    const weekly = Math.sin((i / 7) * 2 * Math.PI) * 180   // weekly cycle
    const noise = (rnd() - 0.5) * 240
    const sessions = Math.max(200, Math.round(trend + weekly + noise))
    return {
      id: i,
      day: d.toISOString().slice(0, 10),
      sessions,
      revenue: Math.round(sessions * (8 + rnd() * 4)),
    }
  })

  const columns: GridColumns<Row> = [
    { field: 'day', header: 'Day', width: 130 },
    { field: 'sessions', header: 'Sessions', width: 130, align: 'right' },
    { field: 'revenue', header: 'Revenue', width: 140, align: 'right',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
  ]

  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let displayed = $state<Row[]>(rows)
  let metric = $state<'sessions' | 'revenue'>('sessions')
  function sync() { displayed = (api?.getDisplayedRows() as Row[]) ?? rows }

  const compact = (v: number) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(v % 1e3 ? 1 : 0) + 'k' : String(Math.round(v)))

  const spec = $derived.by<ChartSpec>(() => {
    const s = rowsToChartSpec(displayed, {
      type: 'line',
      category: 'day',
      value: metric,
      reduce: 'sum',
      width: 720,
      height: 320,
    })
    s.xType = 'time'
    s.xAxisTitle = 'Day'
    s.yAxisTitle = metric === 'revenue' ? 'Revenue (USD)' : 'Sessions'
    return s
  })
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="shrink-0 rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Drag-rect zoom + brush mini-map for long time-series
    </p>
    <p class="mt-0.5 text-xs" style="color: var(--sg-muted);">
      Drag a rectangle over the chart to zoom in. Double-click to reset. The brush below shows
      the full series with a draggable window - drag the body to pan, drag the edges to resize.
    </p>
    <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <select bind:value={metric} class="ic-sel">
        <option value="sessions">Sessions</option>
        <option value="revenue">Revenue</option>
      </select>
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
        rowHeight={28}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(a) => { api = a; sync() }}
        onFiltersChange={sync}
        onSortingChange={sync}
      />
    </div>
    <div class="shrink-0 rounded-lg border p-3" style="width: 760px; border-color: var(--sg-border); background: var(--sg-bg);">
      <SvGridChart {spec} formatValue={compact} zoomable brush brushHeight={96} />
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
</style>
