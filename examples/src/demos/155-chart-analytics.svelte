<!-- Documented in: docs/help/charts.md -->
<script lang="ts">
  /**
   * 155. Chart analytics: trendline, annotations, log scale, drill
   * --------------------------------------------------------------
   * Four chart features that turn a raw line into a story:
   *
   *  - `overlay: 'sma:7' | 'ema:14' | 'linear'` adds a smoothing / trend
   *    line on top of the source series, dashed and tinted.
   *  - `annotations` pins text + markers at named events (releases,
   *    incidents) so the chart explains itself.
   *  - `yScale: 'log'` plots base-10 - essential for wide-range data
   *    (here: signups that ride from a few dozen to many thousands).
   *  - `onDrill` fires with the `rowIds` that produced the clicked
   *    category - we filter the grid down to the source rows.
   *
   * Click any point on the chart to drill the grid to that day's signups.
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
    type ChartSelection,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Row = { id: number; day: string; signups: number; channel: string }
  const CHANNELS = ['Organic', 'Paid', 'Referral']
  let seed = 0xdead42
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0xffffffff)
  // 90 days, exponential growth with weekly seasonality + product-launch spike.
  const rows: Row[] = Array.from({ length: 90 * 3 }, (_, i) => {
    const day = Math.floor(i / 3)
    const channel = CHANNELS[i % 3]!
    const d = new Date(2026, 2, 1 + day)
    const base = 25 * Math.pow(1.035, day)             // exponential climb
    const wkly = 1 + Math.sin((day / 7) * 2 * Math.PI) * 0.18
    const spike = day === 38 ? 4.5 : 1                  // product launch on Apr 8
    const mult = channel === 'Paid' ? 0.6 : channel === 'Referral' ? 0.35 : 1
    return {
      id: i,
      day: d.toISOString().slice(0, 10),
      channel,
      signups: Math.max(1, Math.round(base * wkly * spike * mult * (0.8 + rnd() * 0.4))),
    }
  })

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'day', header: 'Day', width: 130 },
    { field: 'channel', header: 'Channel', width: 130 },
    { field: 'signups', header: 'Signups', width: 120, align: 'right' },
  ]

  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let displayed = $state<Row[]>(rows)
  let logScale = $state(true)
  let overlay = $state<'none' | 'sma:7' | 'sma:14' | 'linear'>('sma:7')
  let drilledTo = $state<string | null>(null)

  function sync() {
    displayed = (api?.getDisplayedRows() as Row[]) ?? rows
  }

  const spec = $derived.by<ChartSpec>(() => {
    const s = rowsToChartSpec(displayed, {
      type: 'line',
      category: 'day',
      value: 'signups',
      reduce: 'sum',
      idField: 'id',                  // <-- track row ids per category for drill
      width: 720,
      height: 320,
    })
    s.xType = 'time'
    s.xAxisTitle = 'Day'
    s.yAxisTitle = `Signups (${logScale ? 'log' : 'linear'})`
    s.yScale = logScale ? 'log' : 'linear'
    // Add the overlay on the (single) total-signups series.
    if (overlay !== 'none' && s.series[0]) {
      s.series[0].overlay = overlay
      s.series[0].overlayColor = '#94a3b8'
    }
    // Pinned annotations.
    s.annotations = [
      { at: { category: '2026-04-08' }, label: 'v2 launch', color: '#16a34a', placement: 'top' },
      { at: { category: '2026-05-05' }, label: 'Outage',    color: '#ef4444', placement: 'bottom' },
    ]
    return s
  })

  function onDrill(sel: ChartSelection) {
    if (!sel.rowIds?.length) return
    const ids = new Set(sel.rowIds.map(Number))
    displayed = rows.filter((r) => ids.has(r.id))
    drilledTo = sel.category
  }
  function clearDrill() {
    drilledTo = null
    sync()
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="shrink-0 rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Trendline · annotations · log axis · click-to-drill
    </p>
    <p class="mt-0.5 text-xs" style="color: var(--sg-muted);">
      The log axis flattens 90 days of exponential growth so the pattern is readable. Click any
      day on the chart to drill the grid to that day's signups. Toggle to linear to see the
      late-period spike dominate the small-value early days.
    </p>
    <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <label class="ic-chk"><input type="checkbox" bind:checked={logScale} /> Log scale</label>
      <select bind:value={overlay} class="ic-sel">
        <option value="none">No overlay</option>
        <option value="sma:7">7-day SMA</option>
        <option value="sma:14">14-day SMA</option>
        <option value="linear">Linear trend</option>
      </select>
      {#if drilledTo}
        <span class="ic-drill">Showing rows for <strong>{drilledTo}</strong>
          <button type="button" onclick={clearDrill}>clear</button>
        </span>
      {/if}
    </div>
  </div>

  <div class="flex flex-1 min-h-0 gap-3">
    <div class="flex-1 min-h-0">
      <SvGrid responsive={true}
      columnResize
        data={displayed}
        columns={columns}
        features={features}
        sortable
        filterable
        selectionMode="none"
        rowHeight={28}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(a) => { api = a; sync() }}
      />
    </div>
    <div class="shrink-0 rounded-lg border p-3" style="width: 760px; border-color: var(--sg-border); background: var(--sg-bg);">
      <SvGridChart {spec} {onDrill} />
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
  .ic-chk { display: inline-flex; align-items: center; gap: 4px; color: var(--sg-fg); }
  .ic-chk input[type='checkbox'] { accent-color: var(--sg-accent); }
  .ic-drill {
    color: var(--sg-fg);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 6px;
    border: 1px solid var(--sg-border);
    border-radius: 5px;
  }
  .ic-drill button {
    color: var(--sg-accent, #2563eb);
    background: none;
    border: 0;
    cursor: pointer;
    text-decoration: underline;
    font-size: 11px;
    padding: 0;
  }
</style>
