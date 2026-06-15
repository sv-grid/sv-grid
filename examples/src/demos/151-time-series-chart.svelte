<!-- Documented in: docs/help/charts.md -->
<script lang="ts">
  /**
   * 151. Time-series chart (date axis + target line)
   * ------------------------------------------------
   * Set `xType: 'time'` and `SvGridChart` treats the categories as dates: x
   * positions are spaced by ACTUAL time (irregular gaps render proportionally,
   * not evenly) and the axis shows real date ticks. A `referenceLines` entry
   * draws a horizontal target/SLA line across the plot. Toggle 100% stacked to
   * see each day's traffic split as a share of its total.
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
    type ChartType,
  } from 'sv-grid-community'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Row = { id: number; date: string; channel: string; sessions: number }
  // Irregular dates (note the jump after the 5th) so the time axis earns its keep.
  const DATES = ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05', '2024-01-12', '2024-01-19', '2024-01-26', '2024-02-02']
  const CHANNELS = ['Organic', 'Paid', 'Social']
  let seed = 0xbeef11
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0xffffffff)
  const BASE: Record<string, number> = { Organic: 1200, Paid: 700, Social: 450 }
  let nid = 0
  const rows: Row[] = DATES.flatMap((date, di) =>
    CHANNELS.map((channel) => ({
      id: nid++,
      date,
      channel,
      sessions: Math.round(BASE[channel]! * (0.8 + di * 0.06 + rnd() * 0.5)),
    })),
  )

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'date', header: 'Date', width: 130 },
    { field: 'channel', header: 'Channel', width: 130 },
    { field: 'sessions', header: 'Sessions', width: 130, align: 'right', format: { type: 'number', options: { maximumFractionDigits: 0 } } },
  ]

  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let displayed = $state<Row[]>(rows)
  let chartType = $state<ChartType>('line')
  let stacked100 = $state(false)
  let target = $state(2500)
  let showTarget = $state(true)

  function sync() {
    displayed = (api?.getDisplayedRows() as Row[]) ?? rows
  }

  const compactNum = (v: number) => (Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(v % 1e3 ? 1 : 0) + 'k' : String(Math.round(v)))

  const spec = $derived.by<ChartSpec>(() => {
    const s = rowsToChartSpec(displayed, {
      type: chartType,
      category: 'date',
      value: 'sessions',
      series: 'channel',
      reduce: 'sum',
      stacked: chartType !== 'line',
      stacked100: stacked100 && chartType !== 'line',
      width: 540,
      height: 300,
    })
    s.xType = 'time'
    s.xAxisTitle = 'Date'
    s.yAxisTitle = stacked100 && chartType !== 'line' ? 'Share' : 'Sessions'
    if (showTarget && !(stacked100 && chartType !== 'line')) {
      s.referenceLines = [{ value: target, label: `Target ${compactNum(target)}` }]
    }
    return s
  })

  const fmtVal = (v: number) => (stacked100 && chartType !== 'line' ? `${Math.round(v)}` : compactNum(v))
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="shrink-0 rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Time-series with a real date axis (irregular gaps) + a target line
    </p>
    <p class="mt-0.5 text-xs" style="color: var(--sg-muted);">
      The gap after Jan 5 is wider because the dates jump a week - positions track actual time, not row order.
    </p>
    <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <select bind:value={chartType} class="ic-sel">
        <option value="line">Line</option>
        <option value="area">Area (stacked)</option>
        <option value="bar">Bar (stacked)</option>
      </select>
      {#if chartType !== 'line'}
        <label class="ic-chk"><input type="checkbox" bind:checked={stacked100} /> 100% stacked</label>
      {/if}
      <label class="ic-chk"><input type="checkbox" bind:checked={showTarget} /> Target line</label>
      <label class="ic-chk">
        Target
        <input type="range" min="1000" max="4000" step="100" bind:value={target} />
        <span style="color: var(--sg-fg); font-variant-numeric: tabular-nums;">{compactNum(target)}</span>
      </label>
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
        rowHeight={32}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(a) => { api = a; sync() }}
        onFiltersChange={sync}
        onSortingChange={sync}
      />
    </div>
    <div class="shrink-0 rounded-lg border p-3" style="width: 580px; border-color: var(--sg-border); background: var(--sg-bg);">
      <SvGridChart {spec} formatValue={fmtVal} />
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
  .ic-chk input[type='checkbox'] { accent-color: var(--sg-accent); }
</style>
